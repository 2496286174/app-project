import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const statePath = path.join(repoRoot, '.liars-bar-dev-instance.json');
const nextDevLockPath = path.join(repoRoot, 'apps', 'web-client', '.next', 'dev', 'lock');
const defaultPorts = [3000, 3001];
const normalizedRepoRoot = normalizeText(repoRoot);

const pids = new Set();
const ports = new Set(defaultPorts);

const state = readState();
if (state) {
  addPid(state.coordinatorPid);
  addPid(state.processes?.shared);
  addPid(state.processes?.ui);
  addPid(state.processes?.host);
  addPid(state.processes?.web);
  addPort(state.webPort);
  addPort(state.hostPort);
}

if (process.platform === 'win32') {
  collectWindowsPortOwners();
  collectWindowsRepoDevProcesses();
} else {
  collectUnixPortOwners();
}

if (pids.size === 0) {
  console.log("No Liar's Bar dev process found.");
} else {
  console.log(`Stopping ${pids.size} dev process group(s): ${[...pids].join(', ')}`);
  for (const pid of [...pids]) {
    stopPid(pid);
  }
}

cleanupFiles();
console.log('Dev cleanup finished.');

function readState() {
  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (parsed?.repoRoot && path.resolve(parsed.repoRoot) !== repoRoot) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function addPid(value) {
  const pid = Number(value);
  if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
    pids.add(pid);
  }
}

function addPort(value) {
  const port = Number(value);
  if (Number.isInteger(port) && port > 0) {
    ports.add(port);
  }
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\\/g, '/');
}

function runPowerShellJson(command) {
  try {
    const output = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true
      }
    ).trim();

    if (!output) {
      return [];
    }

    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function collectWindowsPortOwners() {
  const portList = [...ports].join(',');
  const listeners = runPowerShellJson(
    `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ` +
      `Where-Object { @(${portList}) -contains $_.LocalPort } | ` +
      `Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress`
  );

  for (const listener of listeners) {
    addPid(listener?.OwningProcess);
  }
}

function collectWindowsRepoDevProcesses() {
  const processes = runPowerShellJson(
    'Get-CimInstance Win32_Process | ' +
      'Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'
  );

  const markers = [
    'run-dev-browser.mjs',
    'run-browser-host.mjs',
    'next dev',
    '@liars-bar/shared',
    '@liars-bar/ui',
    '@liars-bar/web-client',
    'typescript/bin/tsc',
    'postcss.js'
  ];

  for (const processInfo of processes) {
    const commandLine = normalizeText(processInfo?.CommandLine);
    if (!commandLine.includes(normalizedRepoRoot)) {
      continue;
    }

    if (markers.some((marker) => commandLine.includes(marker))) {
      addPid(processInfo?.ProcessId);
    }
  }
}

function collectUnixPortOwners() {
  for (const port of ports) {
    try {
      const output = execFileSync('lsof', ['-ti', `tcp:${port}`], {
        cwd: repoRoot,
        encoding: 'utf8'
      });
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach(addPid);
    } catch {}
  }
}

function stopPid(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      cwd: repoRoot,
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
}

function cleanupFiles() {
  fs.rmSync(statePath, { force: true });
  fs.rmSync(nextDevLockPath, { force: true });
}
