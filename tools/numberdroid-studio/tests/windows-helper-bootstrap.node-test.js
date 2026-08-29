import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helpers = [
  '../packages/persistence/src/operations/windows-root-inspect.ps1',
  '../packages/persistence/src/operations/windows-publish.ps1',
];

test('Windows helpers redirect stderr through the valid static Console API', async () => {
  for (const helper of helpers) {
    const source = await readFile(new URL(helper, import.meta.url), 'utf8');
    assert.match(source, /^\[Console\]::SetError\(\[System\.IO\.TextWriter\]::Null\)$/m);
    assert.doesNotMatch(source, /\[Console\]::Error\.SetOut\(/);
  }
});
