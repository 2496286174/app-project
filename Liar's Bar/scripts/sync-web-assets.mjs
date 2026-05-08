import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(repoRoot, 'apps', 'web-client', 'out');

const allTargets = {
  pc: path.join(repoRoot, 'apps', 'pc-host', 'build'),
  android: path.join(repoRoot, 'apps', 'android-host', 'web-assets', 'web')
};

const requestedTargets = process.argv.slice(2);
const targetNames = requestedTargets.length > 0 ? requestedTargets : Object.keys(allTargets);
const targets = targetNames.map((name) => {
  const target = allTargets[name];
  if (!target) {
    throw new Error(`Unknown web asset target "${name}". Use one of: ${Object.keys(allTargets).join(', ')}`);
  }

  return target;
});

function ensureSourceExists() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Web bundle not found: ${sourceDir}. Run "pnpm build:web-client" first.`);
  }
}

function copyDir(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`Synced web assets -> ${path.relative(repoRoot, target)}`);
}

function main() {
  ensureSourceExists();
  targets.forEach((target) => copyDir(sourceDir, target));
}

main();
