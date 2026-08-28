import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['packages', 'apps', 'scripts', 'tests'];
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to skip symbolic link in JavaScript source roots: ${target}`);
    } else if (entry.isDirectory()) {
      collect(target);
    } else if (entry.isFile() && /\.(?:cjs|js|mjs)$/.test(entry.name)) {
      files.push(target);
    }
  }
}

for (const root of roots) {
  const stats = fs.lstatSync(root);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`JavaScript source root must be a real directory, not a symbolic link: ${root}`);
  }
  collect(root);
}

files.sort();
if (files.length === 0) {
  throw new Error('No JavaScript files found under packages/, apps/, or scripts/.');
}

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`JavaScript syntax checked: ${files.length} files.`);
