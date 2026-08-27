import test from 'node:test';
import assert from 'node:assert/strict';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = resolve(studioRoot, 'packages');
const allowedDependencies = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  persistence: new Set(['persistence', 'application', 'domain']),
  preview: new Set(['preview', 'domain']),
  'mcp-server': new Set(['mcp-server', 'application', 'domain']),
  'numberdroid-adapter': new Set(['numberdroid-adapter', 'domain']),
};

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith('.js') ? [path] : [];
  }));
  return nested.flat();
}

test('standalone package imports obey inward dependency direction and isolate Numberdroid coupling in its pure adapter', async () => {
  const files = await javascriptFiles(packagesRoot);
  assert.ok(files.length > 0);
  for (const file of files) {
    const sourcePackage = relative(packagesRoot, file).split(sep)[0];
    const source = await readFile(file, 'utf8');
    const imports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of imports) {
      if (sourcePackage === 'numberdroid-adapter') {
        assert.doesNotMatch(specifier, /^(?:node:)?(?:fs|fs\/promises|child_process|net|http|https|tls|dgram|cluster|worker_threads)$/, `${relative(studioRoot, file)} gives the pure candidate adapter operational I/O authority`);
        assert.doesNotMatch(specifier, /(?:octokit|github|simple-git|isomorphic-git)/i, `${relative(studioRoot, file)} gives the pure candidate adapter Git or GitHub authority`);
      } else {
        assert.doesNotMatch(specifier, /numberdroid/i, `${relative(studioRoot, file)} imports Numberdroid internals`);
      }
      if (!specifier.startsWith('.')) continue;
      const resolvedImport = resolve(dirname(file), specifier);
      if (!resolvedImport.startsWith(packagesRoot + sep)) continue;
      const targetPackage = relative(packagesRoot, resolvedImport).split(sep)[0];
      assert.ok(
        allowedDependencies[sourcePackage]?.has(targetPackage),
        `${sourcePackage} must not depend on outward package ${targetPackage} (${relative(studioRoot, file)})`,
      );
    }
  }
});
