import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(repoRoot, 'apps', 'web-client', 'out');

const targets = [
  path.join(repoRoot, 'apps', 'pc-host', 'build'),
  path.join(repoRoot, 'apps', 'android-host', 'web-assets', 'web')
];

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
