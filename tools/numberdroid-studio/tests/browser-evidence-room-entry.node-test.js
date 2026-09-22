import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const capture = await readFile(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8');
const helperStart = capture.indexOf('function assert(condition, message) {');
const helperEnd = capture.indexOf('\nconst chrome = spawn(', helperStart);
const branchStart = capture.indexOf("if (mode === 'checkpoint-3' && expectedWorkspace === 'rooms') {");
const entryStart = capture.indexOf('    const opened = await devtools.send(', branchStart);
const entryEnd = capture.indexOf("    await devtools.send('Runtime.evaluate', {", entryStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart && branchStart >= 0
  && entryStart > branchStart && entryEnd > entryStart, 'Extract the real assertion helper and exact Room-entry fragment');
const source = `${capture.slice(helperStart, helperEnd)}\n(async () => {\n${capture.slice(entryStart, entryEnd)}\n})()`;
const roomSelector = '[data-room-nav-action="open-room"][data-room-nav-id="room.family-gathering"]';
const entryFailure = /Checkpoint 3 must deliberately open its exact Room from the collection/;

async function enterRoom({ selection = 'room.family-gathering', cardPresent = true } = {}) {
  let clicked = false;
  const selectors = [];
  const document = {
    querySelector(selector) {
      selectors.push(selector);
      if (selector === roomSelector) return cardPresent ? { click() { clicked = true; } } : null;
      if (selector === '[data-room-board]') return clicked ? {} : null;
      if (selector === '[data-room-variant-select]') return clicked && selection !== null ? { value: selection } : null;
      throw new Error(`Unexpected Room-entry selector: ${selector}`);
    },
  };
  let commands = 0;
  const devtools = {
    async send(method, parameters, sessionId) {
      commands += 1;
      assert.equal(method, 'Runtime.evaluate');
      assert.equal(sessionId, 'room-entry-session');
      assert.equal(parameters.awaitPromise, true);
      assert.equal(parameters.returnByValue, true);
      try {
        const value = await runInNewContext(parameters.expression, { document, setTimeout }, { timeout: 1000 });
        return { result: { value } };
      } catch (error) {
        // CDP returns a page exception as metadata, rather than rejecting send.
        return { exceptionDetails: { text: error.message } };
      }
    },
  };
  await runInNewContext(source, { devtools, sessionId: 'room-entry-session' }, { timeout: 1000 });
  assert.equal(commands, 1);
  assert.equal(clicked, true);
  assert.equal(selectors[0], roomSelector);
}

test('Checkpoint 3 collection entry opens the exact Room using the capture script assertion helper', async () => {
  await enterRoom();
});

test('Checkpoint 3 collection entry rejects a different saved Room', async () => {
  await assert.rejects(enterRoom({ selection: 'room.other' }), entryFailure);
});

test('Checkpoint 3 collection entry rejects missing selection and page exceptions', async () => {
  await assert.rejects(enterRoom({ selection: null }), entryFailure);
  await assert.rejects(enterRoom({ cardPresent: false }), entryFailure);
});
