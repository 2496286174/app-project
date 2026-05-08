import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const packageManagerCommand = 'pnpm';
const useShell = process.platform === 'win32';
const requestedWebPort = Number(process.env.WEB_PORT || process.env.PORT || 3000);
const requestedHostPort = Number(process.env.HOST_PORT || 3001);
const webHost = process.env.WEB_HOST?.trim() || '';
const lanIp = getLanIp();
const nextDevLockPath = path.join(repoRoot, 'apps', 'web-client', '.next', 'dev', 'lock');
const devInstanceStatePath = path.join(repoRoot, '.liars-bar-dev-instance.json');
const normalizedRepoRoot = normalizeCommandText(repoRoot);
const normalizedWebStartScript = normalizeCommandText(path.join(repoRoot, 'node_modules', 'next', 'dist', 'server', 'lib', 'start-server.js'));

if (requestedWebPort === requestedHostPort) {
  console.error(`WEB_PORT (${requestedWebPort}) and HOST_PORT (${requestedHostPort}) must be different in development mode.`);
  process.exit(1);
}

const reusableDevInstance = await findReusableDevInstance(requestedWebPort);
if (reusableDevInstance) {
  printReusableBanner(reusableDevInstance);
  process.exit(0);
}

await removeStaleNextDevLock(requestedWebPort);

if (await isPortInUse(requestedWebPort)) {
  console.error(`WEB_PORT ${requestedWebPort} is already in use. Stop the existing frontend dev server or set WEB_PORT to another port.`);
  process.exit(1);
}

const hostPort = await resolveAvailablePort(requestedHostPort, new Set([requestedWebPort]));
const webPort = String(requestedWebPort);
const devUrls = buildDevUrls();
const devJoinUrl = lanIp
  ? `http://${lanIp}:${webPort}/login`
  : `http://127.0.0.1:${webPort}/login`;
const hostDevMessage = [
  'Static web hosting is disabled in development mode.',
  `Open the Next.js dev server instead: ${devUrls.local}`,
  lanIp ? `LAN access: ${devUrls.lan}` : null,
  `Game host WebSocket port: ${hostPort}`
]
  .filter(Boolean)
  .join('\n');
const devInstanceState = {
  repoRoot,
  coordinatorPid: process.pid,
  startedAt: new Date().toISOString(),
  webPort: requestedWebPort,
  hostPort: Number(hostPort),
  webHost,
  lanIp,
  urls: devUrls,
  processes: {
    shared: null,
    ui: null,
    host: null,
    web: null
  }
};

const children = new Set();
const managedProcesses = new Map();
let shuttingDown = false;
let pendingExitCode = 0;
let sharedDistWatcher = null;

writeDevInstanceState();

printBanner();
await runCommand(['run', 'build:shared']);
await runCommand(['run', 'build:ui']);

startProcess('shared', ['--filter', '@liars-bar/shared', 'run', 'dev']);
startProcess('ui', ['--filter', '@liars-bar/ui', 'run', 'dev']);
startProcess('host', ['exec', 'node', './scripts/run-browser-host.mjs'], {
  HOST_PORT: hostPort,
  HOST_DISABLE_STATIC_WEB: '1',
  HOST_DEV_MESSAGE: hostDevMessage,
  HOST_DEV_JOIN_URL: devJoinUrl
});
startProcess(
  'web',
  buildWebDevArgs(),
  {
    PORT: webPort,
    NEXT_PUBLIC_HOST_PORT: hostPort,
    ...(process.env.NEXT_PUBLIC_HOST_ADDRESS
      ? { NEXT_PUBLIC_HOST_ADDRESS: process.env.NEXT_PUBLIC_HOST_ADDRESS }
      : {})
  },
  {
    rewriteOutput: rewriteWebDevOutput
  }
);
watchSharedDistForHostRestart();

process.on('SIGINT', () => stopAll(0, 'SIGINT'));
process.on('SIGTERM', () => stopAll(0, 'SIGTERM'));
process.on('exit', () => removeOwnedDevInstanceState());

function getLanIp() {
  const networkInterfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) {
        continue;
      }

      candidates.push(entry.address);
    }
  }

  return candidates.find(isPrivateLanAddress) || candidates[0] || null;
}

function isPrivateLanAddress(address) {
  if (address.startsWith('10.') || address.startsWith('192.168.')) {
    return true;
  }

  const match = /^172\.(\d+)\./.exec(address);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function buildDevUrls() {
  return {
    local: `http://127.0.0.1:${webPort}/`,
    lan: lanIp ? `http://${lanIp}:${webPort}/` : null
  };
}

function normalizeCommandText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\\/g, '/');
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function normalizeReusableDevInstance(candidate) {
  const webPortValue = Number(candidate?.webPort);
  const hostPortValue = Number(candidate?.hostPort);

  if (!Number.isFinite(webPortValue) || !Number.isFinite(hostPortValue)) {
    return null;
  }

  return {
    webPort: webPortValue,
    hostPort: hostPortValue,
    localUrl: candidate?.localUrl || candidate?.urls?.local || `http://127.0.0.1:${webPortValue}/`,
    lanUrl: candidate?.lanUrl || candidate?.urls?.lan || (candidate?.lanIp ? `http://${candidate.lanIp}:${webPortValue}/` : null),
    hostReady: candidate?.hostReady !== false
  };
}

function writeDevInstanceState() {
  try {
    fs.writeFileSync(devInstanceStatePath, JSON.stringify(devInstanceState, null, 2));
  } catch (error) {
    console.warn(`[dev-state] failed to write ${path.basename(devInstanceStatePath)}: ${error.message}`);
  }
}

function removeOwnedDevInstanceState() {
  if (!fs.existsSync(devInstanceStatePath)) {
    return;
  }

  try {
    const rawState = fs.readFileSync(devInstanceStatePath, 'utf8');
    const savedState = JSON.parse(rawState);
    if (Number(savedState?.coordinatorPid) !== process.pid || savedState?.repoRoot !== repoRoot) {
      return;
    }

    fs.rmSync(devInstanceStatePath, { force: true });
  } catch {}
}

async function findReusableDevInstance(webPortValue) {
  const stateFileMatch = await findReusableDevInstanceFromStateFile(webPortValue);
  if (stateFileMatch) {
    return stateFileMatch;
  }

  if (process.platform === 'win32') {
    return findReusableDevInstanceFromWindowsProcesses(webPortValue);
  }

  return null;
}

async function findReusableDevInstanceFromStateFile(webPortValue) {
  if (!fs.existsSync(devInstanceStatePath)) {
    return null;
  }

  let savedState;
  try {
    savedState = JSON.parse(fs.readFileSync(devInstanceStatePath, 'utf8'));
  } catch {
    fs.rmSync(devInstanceStatePath, { force: true });
    return null;
  }

  if (savedState?.repoRoot !== repoRoot) {
    return null;
  }

  const savedWebPort = Number(savedState?.webPort);
  const savedHostPort = Number(savedState?.hostPort);

  if (!Number.isFinite(savedWebPort) || savedWebPort !== webPortValue) {
    return null;
  }

  const trackedPids = [
    Number(savedState?.coordinatorPid),
    Number(savedState?.processes?.shared),
    Number(savedState?.processes?.ui),
    Number(savedState?.processes?.host),
    Number(savedState?.processes?.web)
  ].filter((pid) => Number.isInteger(pid) && pid > 0);

  const anyTrackedPidAlive = trackedPids.some(isProcessAlive);
  const webBusy = await isPortInUse(savedWebPort);
  const hostBusy = Number.isFinite(savedHostPort) ? await isPortInUse(savedHostPort) : false;

  if (webBusy && (anyTrackedPidAlive || hostBusy)) {
    return normalizeReusableDevInstance({
      ...savedState,
      hostReady: hostBusy
    });
  }

  if (!webBusy && !hostBusy && !anyTrackedPidAlive) {
    fs.rmSync(devInstanceStatePath, { force: true });
  }

  return null;
}

async function findReusableDevInstanceFromWindowsProcesses(webPortValue) {
  try {
    const [processesResult, listenersResult] = await Promise.all([
      runPowerShellJson(
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'
      ),
      runPowerShellJson(
        'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress'
      )
    ]);

    const processes = toArray(processesResult);
    const listeners = toArray(listenersResult);
    const processesById = new Map(
      processes
        .map((item) => [Number(item?.ProcessId), item])
        .filter(([pid]) => Number.isInteger(pid) && pid > 0)
    );
    const webOwner = listeners.find((listener) => Number(listener?.LocalPort) === webPortValue);

    if (!webOwner) {
      return null;
    }

    const webProcess = processesById.get(Number(webOwner.OwningProcess));
    if (!matchesReusableWebProcess(webProcess)) {
      return null;
    }

    const hostProcess = findReusableHostProcess(processesById);
    if (!hostProcess) {
      return null;
    }

    const hostPorts = listeners
      .filter((listener) => Number(listener?.OwningProcess) === Number(hostProcess.ProcessId))
      .map((listener) => Number(listener?.LocalPort))
      .filter((port, index, ports) => Number.isFinite(port) && port !== webPortValue && ports.indexOf(port) === index)
      .sort((left, right) => left - right);
    const resolvedHostPort = hostPorts[0] || requestedHostPort;

    return normalizeReusableDevInstance({
      webPort: webPortValue,
      hostPort: resolvedHostPort,
      localUrl: `http://127.0.0.1:${webPortValue}/`,
      lanUrl: lanIp ? `http://${lanIp}:${webPortValue}/` : null,
      hostReady: hostPorts.length > 0
    });
  } catch {
    return null;
  }
}

function matchesReusableWebProcess(processInfo) {
  const commandLine = normalizeCommandText(processInfo?.CommandLine);

  if (!commandLine) {
    return false;
  }

  return commandLine.includes(normalizedWebStartScript) || (commandLine.includes(normalizedRepoRoot) && commandLine.includes('@liars-bar/web-client'));
}

function hasAncestorCommand(processesById, processInfo, predicate, maxDepth = 3) {
  let current = processInfo;
  let depth = 0;

  while (current && depth < maxDepth) {
    const parentProcess = processesById.get(Number(current?.ParentProcessId));
    if (!parentProcess) {
      return false;
    }

    if (predicate(parentProcess)) {
      return true;
    }

    current = parentProcess;
    depth += 1;
  }

  return false;
}

function findReusableHostProcess(processesById) {
  const matchingProcesses = [];

  for (const processInfo of processesById.values()) {
    const commandLine = normalizeCommandText(processInfo?.CommandLine);
    if (!commandLine.includes('scripts/run-browser-host.mjs')) {
      continue;
    }

    if (
      hasAncestorCommand(
        processesById,
        processInfo,
        (ancestor) => {
          const ancestorCommandLine = normalizeCommandText(ancestor?.CommandLine);
          return ancestorCommandLine.includes('run-dev-browser.mjs');
        }
      )
    ) {
      matchingProcesses.push(processInfo);
    }
  }

  return (
    matchingProcesses.find((processInfo) => normalizeCommandText(processInfo?.Name).includes('node')) ||
    matchingProcesses[0] ||
    null
  );
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function runPowerShellJson(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      }
    );
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `PowerShell command failed with exit code ${code ?? 'unknown'}`));
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }

      resolve(JSON.parse(trimmed));
    });
  });
}

function printReusableBanner(instance) {
  console.log('Detected an existing development instance for this repo.');
  console.log(`Reuse Web UI: ${instance.localUrl}`);
  if (instance.lanUrl) {
    console.log(`Reuse LAN UI: ${instance.lanUrl}`);
  }
  console.log(`Reuse game host port: ${instance.hostPort}`);
  if (!instance.hostReady) {
    console.log('Game host is still starting. Reuse the page and wait a moment before connecting from other devices.');
  }
  console.log('Run "pnpm dev:stop" to stop the previous dev instance.');
  console.log('Run "pnpm dev:restart" if you need a clean restart.');
}

function printBanner() {
  console.log('Development mode (browser only)');
  console.log(`Web UI: ${devUrls.local}`);
  if (devUrls.lan) {
    console.log(`LAN UI: ${devUrls.lan}`);
  }
  if (webHost) {
    console.log(`WEB_HOST override: ${webHost}`);
  }
  console.log(`Game host port: ${hostPort}`);
  if (Number(hostPort) !== requestedHostPort) {
    console.log(`HOST_PORT ${requestedHostPort} is occupied, switched to ${hostPort}`);
  }
  console.log('Android testing uses pnpm run:android-host; PC candidate uses pnpm run:pc-host with Edge/WebView2.');
}

function buildWebDevArgs() {
  const args = ['--filter', '@liars-bar/web-client', 'run', 'dev', '--port', webPort];

  if (webHost) {
    args.push('--hostname', webHost);
  }

  return args;
}

async function removeStaleNextDevLock(port) {
  if (!fs.existsSync(nextDevLockPath)) {
    return;
  }

  if (await isPortInUse(port)) {
    return;
  }

  fs.rmSync(nextDevLockPath, { force: true });
  console.log(`Removed stale Next.js dev lock: ${path.relative(repoRoot, nextDevLockPath)}`);
}

async function isPortInUse(port) {
  const hostsToProbe = ['::', '0.0.0.0'];

  for (const host of hostsToProbe) {
    const probe = await probePortOnHost(port, host);
    if (!probe.available) {
      return true;
    }
  }

  return false;
}

function probePortOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;

    server.unref();

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        finish({ available: false });
        return;
      }

      if (error && (error.code === 'EAFNOSUPPORT' || error.code === 'EINVAL')) {
        finish({ available: true });
        return;
      }

      finish({ available: true });
    });

    server.once('listening', () => {
      server.close(() => finish({ available: true }));
    });

    try {
      server.listen({ port, host, exclusive: true });
    } catch (error) {
      if (error && error.code === 'EADDRINUSE') {
        finish({ available: false });
        return;
      }

      finish({ available: true });
    }
  });
}

async function waitForPortRelease(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isPortInUse(port))) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Port ${port} did not become available before restart timeout`);
}

async function resolveAvailablePort(startPort, reservedPorts = new Set()) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (reservedPorts.has(port)) {
      continue;
    }

    if (!(await isPortInUse(port))) {
      return String(port);
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

function runCommand(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManagerCommand, args, {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: useShell
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${packageManagerCommand} ${args.join(' ')} (${code ?? 'unknown'})`));
    });
  });
}

function terminateChildProcess(child, signal = 'SIGTERM') {
  if (!child || child.killed || !child.pid) {
    return;
  }

  if (process.platform !== 'win32') {
    child.kill(signal);
    return;
  }

  const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
    cwd: repoRoot,
    stdio: 'ignore',
    shell: false
  });

  killer.on('error', (error) => {
    console.error(`[process-kill] failed to terminate pid ${child.pid}`, error);
  });
}

function startProcess(label, args, extraEnv = {}, options = {}) {
  const entry = {
    label,
    args,
    extraEnv,
    options,
    child: null,
    restarting: false
  };

  managedProcesses.set(label, entry);
  launchManagedProcess(entry);
}

function launchManagedProcess(entry) {
  const { label, args, extraEnv, options } = entry;
  const stdio = options.rewriteOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit';
  const child = spawn(packageManagerCommand, args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio,
    shell: useShell
  });

  entry.child = child;
  children.add(child);
  if (Object.hasOwn(devInstanceState.processes, label)) {
    devInstanceState.processes[label] = child.pid ?? null;
    writeDevInstanceState();
  }

  if (options.rewriteOutput) {
    attachRewrittenOutput(child.stdout, process.stdout, options.rewriteOutput);
    attachRewrittenOutput(child.stderr, process.stderr, options.rewriteOutput);
  }

  child.on('error', (error) => {
    console.error(`[${label}] failed to start`, error);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (entry.child === child) {
      entry.child = null;
    }
    if (Object.hasOwn(devInstanceState.processes, label) && devInstanceState.processes[label] === (child.pid ?? null)) {
      devInstanceState.processes[label] = null;
      writeDevInstanceState();
    }

    if (!shuttingDown) {
      if (entry.restarting) {
        entry.restarting = false;
        void relaunchManagedProcess(entry);
        return;
      }

      const exitCode = signal ? 1 : code ?? 0;
      if (exitCode !== 0) {
        console.error(`[${label}] exited with ${signal || exitCode}`);
      }
      stopAll(exitCode);
      return;
    }

    if (children.size === 0) {
      process.exit(pendingExitCode);
    }
  });
}

async function relaunchManagedProcess(entry) {
  try {
    if (entry.label === 'host') {
      await waitForPortRelease(Number(hostPort));
    }

    if (!shuttingDown) {
      launchManagedProcess(entry);
    }
  } catch (error) {
    console.error(`[${entry.label}] failed to restart cleanly`, error);
    stopAll(1);
  }
}

function restartProcess(label) {
  if (shuttingDown) {
    return;
  }

  const entry = managedProcesses.get(label);
  if (!entry || entry.restarting) {
    return;
  }

  if (!entry.child) {
    launchManagedProcess(entry);
    return;
  }

  entry.restarting = true;
  console.log(`[${label}] restarting to apply shared logic changes`);
  terminateChildProcess(entry.child, 'SIGTERM');
}

function stopAll(exitCode, signal = 'SIGTERM') {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  pendingExitCode = exitCode;

  if (sharedDistWatcher) {
    sharedDistWatcher.close();
    sharedDistWatcher = null;
  }

  if (children.size === 0) {
    process.exit(pendingExitCode);
    return;
  }

  for (const child of children) {
    terminateChildProcess(child, signal);
  }
}

function watchSharedDistForHostRestart() {
  const sharedDistPath = path.join(repoRoot, 'packages', 'shared', 'dist');
  if (!fs.existsSync(sharedDistPath)) {
    return;
  }

  const ignoreChangesBefore = Date.now() + 1000;
  let restartTimer = null;

  sharedDistWatcher = fs.watch(sharedDistPath, { recursive: true }, () => {
    if (Date.now() < ignoreChangesBefore || shuttingDown) {
      return;
    }

    if (restartTimer) {
      clearTimeout(restartTimer);
    }

    restartTimer = setTimeout(() => {
      restartTimer = null;
      restartProcess('host');
    }, 250);
  });

  sharedDistWatcher.on('error', (error) => {
    console.error('[shared-watch] failed to watch packages/shared/dist for host restarts', error);
  });
}

function rewriteWebDevOutput(text) {
  if (!lanIp) {
    return text;
  }

  return text
    .replace(/- Local:\s+http:\/\/localhost:(\d+)/g, `- Local:         ${devUrls.local}`)
    .replace(/- Network:\s+http:\/\/[^\s]+:(\d+)/g, `- Network:       ${devUrls.lan}`);
}

function attachRewrittenOutput(input, output, rewrite) {
  if (!input) {
    return;
  }

  let buffer = '';

  input.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      output.write(`${rewrite(line)}\n`);
    }
  });

  input.on('end', () => {
    if (buffer) {
      output.write(rewrite(buffer));
      buffer = '';
    }
  });
}
