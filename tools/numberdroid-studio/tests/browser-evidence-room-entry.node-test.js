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

function surfaceClickGuard() {
  const directStart = capture.indexOf('const directSetup = await devtools.send(');
  const directEnd = capture.indexOf('const directPoints = await devtools.send(', directStart);
  assert.ok(directStart >= 0 && directEnd > directStart);
  const direct = capture.slice(directStart, directEnd);
  const guard = direct.match(/await waitFor\(\(\) => window\.__numberdroidStudioVisualTest\.roomDirectManipulationState\(\)\.suppressCanvasClick === false,\s*'surface canvas click suppression to settle'\);/);
  assert.ok(guard, 'Extract the real direct-manipulation suppression wait, not a replacement predicate');
  const paletteClick = direct.indexOf('document.querySelector(surfaceSelector)?.click();');
  const cellLookup = direct.indexOf("document.querySelector('.room-cell[data-x=\"' + widthBefore");
  const cellClick = direct.indexOf('surfaceCell.click();', cellLookup);
  assert.ok(paletteClick >= 0 && guard.index > paletteClick && cellLookup > guard.index && cellClick > cellLookup,
    'Wait after arming the Surface palette and before its first canvas-cell click');
  return (waitFor, readState) => runInNewContext(`(async () => { ${guard[0]} })()`, {
    waitFor,
    window: { __numberdroidStudioVisualTest: { roomDirectManipulationState: readState } },
  }, { timeout: 1000 });
}

test('Surface evidence waits while canvas clicks are suppressed, then continues only after suppression clears', async () => {
  const execute = surfaceClickGuard();
  let state = { suppressCanvasClick: true }, completed = false, poll, checks = 0;
  const result = execute((predicate, label) => {
    assert.equal(label, 'surface canvas click suppression to settle');
    return new Promise(resolve => {
      poll = () => { checks += 1; if (predicate()) resolve(); };
      poll();
    });
  }, () => state).then(() => { completed = true; });
  await Promise.resolve(); assert.equal(completed, false);
  poll(); await Promise.resolve(); assert.equal(completed, false);
  state = {}; poll(); await Promise.resolve(); assert.equal(completed, false, 'Absent suppression state is not readiness');
  state = { suppressCanvasClick: false }; poll(); await result;
  assert.equal(completed, true); assert.equal(checks, 4);
});

test('Surface evidence continues immediately when canvas clicks are explicitly ready', async () => {
  let checks = 0;
  await surfaceClickGuard()(async predicate => {
    checks += 1; assert.equal(predicate(), true);
  }, () => ({ suppressCanvasClick: false }));
  assert.equal(checks, 1);
});

test('Surface evidence propagates bounded wait failure for suppressed or unavailable state', async () => {
  for (const state of [{ suppressCanvasClick: true }, {}]) {
    const timeout = new Error('Deterministic suppression deadline exceeded');
    await assert.rejects(surfaceClickGuard()(async predicate => {
      for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(predicate(), false);
      throw timeout;
    }, () => state), error => error === timeout);
  }
});
