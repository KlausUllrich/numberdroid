import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');
const statusSource = source.slice(source.indexOf('let roomMoveResultNotice = null;'), source.indexOf('function renderRoomToolOptions('));
function statusHarness() {
  const state = { project: { projectId: 'project', revision: 8 }, roomUi: { shapeConflict: null } };
  const context = { state };
  runInNewContext(`${statusSource}; this.status = roomEditorStatusText; this.notice = value => { roomMoveResultNotice = value; }; this.getNotice = () => roomMoveResultNotice;`, context);
  const room = { roomVariantId: 'room', version: 5, lifecycle: 'DRAFT' };
  return { context, state, room, status: (draft, move = { pending: false, message: 'Saved' }) => context.status(room, draft, move),
    notice: () => context.notice({ projectId: 'project', revision: 8, roomVariantId: 'room', version: 5, message: 'Rejected move. Two further changes were not saved.' }) };
}

test('completed Move cannot mask subsequent dirty shape, conflict or read-only status', () => {
  const h = statusHarness();
  assert.equal(h.status({ dirty: false }), 'Saved · room version 5');
  assert.equal(h.status({ dirty: true }), 'Unsaved shape changes');
  h.state.roomUi.shapeConflict = 'External change';
  assert.equal(h.status({ dirty: true }), 'Conflict · reload the saved shape');
  h.room.lifecycle = 'FINAL';
  assert.equal(h.status({ dirty: false }), 'Read-only · FINAL room version 5');
});

test('idle failure notice is exact-context scoped and permanently cleared by new shape work', () => {
  const h = statusHarness(); h.notice();
  assert.match(h.status({ dirty: false }), /Two further changes were not saved/);
  assert.equal(h.status({ dirty: true }), 'Unsaved shape changes');
  assert.equal(h.context.getNotice(), null);
  assert.equal(h.status({ dirty: false }), 'Saved · room version 5', 'discarding shape does not resurrect old Move error');
  h.notice(); h.state.project.revision += 1;
  assert.equal(h.status({ dirty: false }), 'Saved · room version 5');
  assert.equal(h.context.getNotice(), null);
});

test('active uncertain Move still explains required recovery instead of claiming Saved', () => {
  const h = statusHarness();
  assert.equal(h.status({ dirty: false }, { pending: true, message: 'Save not confirmed. Retry the same move.' }), 'Save not confirmed. Retry the same move.');
  const options = source.slice(source.indexOf('function renderRoomToolOptions('), source.indexOf('function renderRoomDockNavigation('));
  assert.match(options, /status\.dataset\.moveNotice = String\(Boolean\(moveState\.pending \|\| roomMoveResultNotice\)\)/);
  assert.match(options, /retry\.dataset\.roomFocusKey = 'room-move-retry'/);
  const display = source.slice(source.indexOf('function renderRoomMoveDisplay('), source.indexOf('const roomMoveTools ='));
  assert.match(display, /captureRoomDomState\(\{ preserveActiveKey: true \}\)/);
});

test('retry focus survives disabled request interval and returns when recovery still needs retry', () => {
  const state = { workspace: 'rooms', project: { projectId: 'project' }, roomNavigation: { route: 'editor' },
    roomUi: { selectedRoomVariantId: 'room', selectedProposalId: null } };
  const body = { closest: () => null };
  const document = { activeElement: body };
  let retry = { dataset: { roomFocusKey: 'room-move-retry' }, disabled: false, closest() { return this; },
    focus() { if (!this.disabled) document.activeElement = this; } };
  const root = { querySelectorAll: selector => selector === '[data-room-scroll]' ? [] : [retry] };
  const context = { state, document, elements: { 'workspace-content': root }, window: { scrollX: 0, scrollY: 0, scrollTo() {} } };
  const domSource = source.slice(source.indexOf('function captureRoomDomState('), source.indexOf('function textOffsetWithin('));
  runInNewContext(`${domSource}; this.capture = captureRoomDomState; this.restore = restoreRoomDomState;`, context);
  document.activeElement = retry; context.capture({ preserveActiveKey: true });
  retry.disabled = true; document.activeElement = body; context.restore();
  context.capture({ preserveActiveKey: true });
  assert.equal(state.roomUi.domState.activeKey, 'room-move-retry');
  retry.disabled = false; context.restore(); assert.equal(document.activeElement, retry);
});

test('Move recovery guidance uses a readable bounded wrapping row instead of the compact status pill', () => {
  const rule = styles.match(/\.room-tool-options \.room-editor-status\[data-move-notice="true"\]\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule);
  for (const declaration of ['grid-column: 1 / -1', 'min-width: 0', 'max-width: 100%', 'white-space: normal', 'overflow-wrap: anywhere', 'font: 13px/1.5']) assert.ok(rule.includes(declaration), declaration);
});
