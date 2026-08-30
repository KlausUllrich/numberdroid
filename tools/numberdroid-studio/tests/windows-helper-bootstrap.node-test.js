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

test('Windows descendant files stop after the no-follow reparse proof', async () => {
  const source = await readFile(new URL(helpers[0], import.meta.url), 'utf8');
  const reparseRejection = source.indexOf(
    'if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)',
  );
  const regularFileReturn = source.indexOf('if (!isDirectory)');
  const directoryIdentityProof = source.indexOf('FILE_ID_INFO identity =');
  assert.notEqual(reparseRejection, -1);
  assert.notEqual(regularFileReturn, -1);
  assert.notEqual(directoryIdentityProof, -1);
  assert.ok(reparseRejection < regularFileReturn);
  assert.ok(regularFileReturn < directoryIdentityProof);
  assert.match(source, /if \(\$entry\.IsDirectory\) \{\s+if \(\$entry\.FileSystem -cne 'NTFS'/);
});
