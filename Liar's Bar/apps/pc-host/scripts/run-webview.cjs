const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createHostRuntime } = require('@liars-bar/host-runtime');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const webRoot = process.env.HOST_WEB_ROOT
  ? path.resolve(repoRoot, process.env.HOST_WEB_ROOT)
  : path.join(appRoot, 'build');

const runtime = createHostRuntime({
  platform: 'pc-webview',
  hostName: "Liar's Bar PC WebView Host",
  port: Number(process.env.HOST_PORT || 3000),
  webRoot
});

let webviewProcess = null;
let shuttingDown = false;

runtime.ready
  .then((hostInfo) => {
    console.log(`PC host ready at ${hostInfo.localUrl}`);
    console.log(`LAN join URL: ${hostInfo.joinUrl}`);
    openWebViewWindow(hostInfo.localUrl);
  })
  .catch((error) => {
    console.error('Failed to start PC WebView host:', error);
    process.exit(1);
  });

function openWebViewWindow(url) {
  const edgeExecutable = findEdgeExecutable();
  if (!edgeExecutable) {
    console.warn('Microsoft Edge/WebView2 runtime was not found. Open this URL manually:');
    console.warn(url);
    return;
  }

  const profileDir = path.join(repoRoot, '.dev-logs', 'pc-webview-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  webviewProcess = spawn(
    edgeExecutable,
    [
      `--app=${url}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--disable-extensions'
    ],
    {
      cwd: repoRoot,
      stdio: 'ignore',
      windowsHide: false
    }
  );

  webviewProcess.on('error', (error) => {
    console.warn(`Failed to launch Microsoft Edge/WebView2 runtime: ${error.message}`);
    console.warn(`Open this URL manually: ${url}`);
  });

  webviewProcess.on('exit', () => {
    if (!shuttingDown) {
      void shutdown();
    }
  });
}

function findEdgeExecutable() {
  const candidates = [
    process.env.LIARS_BAR_WEBVIEW_EXE,
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    (process.env.LOCALAPPDATA || process.env.LocalAppData) &&
      path.join(process.env.LOCALAPPDATA || process.env.LocalAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await runtime.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
