import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const generatedPaths = [
  '.dev-logs',
  '.next',
  'apps/web-client/.next',
  'apps/web-client/out',
  'apps/pc-host/build',
  'apps/android-host/web-assets',
  'apps/android-host/android/.gradle',
  'apps/android-host/android/app/build',
  'packages/shared/dist',
  'packages/ui/dist'
];

for (const relativePath of generatedPaths) {
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

console.log('Generated files cleaned.');

function isInsideRepo(absolutePath) {
  return absolutePath === repoRoot || absolutePath.startsWith(`${repoRoot}${path.sep}`);
}
