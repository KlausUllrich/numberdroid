import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function normalizeNumberdroidLevelCompilerAuthoritySource(source) {
  return source.replace(/\r\n/g, '\n');
}

export function numberdroidLevelCompilerVersion(repositoryRootUrl) {
  const repositoryRoot = fileURLToPath(repositoryRootUrl);
  const levelgenRoot = join(repositoryRoot, 'src', 'levelgen');
  const authorityFiles = readdirSync(levelgenRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map((entry) => join(levelgenRoot, entry.name));
  authorityFiles.push(join(repositoryRoot, 'src', 'game', 'types.ts'));
  const normalized = authorityFiles
    .map((absolutePath) => ({
      absolutePath,
      relativePath: relative(repositoryRoot, absolutePath).split(sep).join('/'),
    }))
    .sort((left, right) => (left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0));
  const hash = createHash('sha256');
  for (const file of normalized) {
    hash.update(`${file.relativePath}\0`);
    hash.update(normalizeNumberdroidLevelCompilerAuthoritySource(readFileSync(file.absolutePath, 'utf8')));
    hash.update('\0');
  }
  return `numberdroid-level-compiler.sha256:${hash.digest('hex')}`;
}
