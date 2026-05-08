import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const dependencyPaths = [
  'node_modules',
  'apps/android-host/node_modules',
  'apps/pc-host/node_modules',
  'apps/web-client/node_modules',
  'packages/host-runtime/node_modules',
  'packages/shared/node_modules',
  'packages/ui/node_modules'
];

for (const relativePath of dependencyPaths) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  if (!isInsideRepo(absolutePath)) {
    throw new Error(`Refusing to clean outside repo: ${absolutePath}`);
  }

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  fs.rmSync(absolutePath, { recursive: true, force: true });
  console.log(`removed: ${relativePath}`);
}

console.log('Dependency folders cleaned.');

function isInsideRepo(absolutePath) {
  return absolutePath === repoRoot || absolutePath.startsWith(`${repoRoot}${path.sep}`);
}
