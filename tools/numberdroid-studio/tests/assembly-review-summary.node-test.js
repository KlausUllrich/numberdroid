import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblyReviewChanges } from '../apps/studio-server/public/assembly-review-summary.js';

const pin = (assetId, assetVersion = 1, metadataVersion = 1) => ({ assetId, assetVersion, metadataVersion });
function fixture() {
  const component = (componentId, name) => ({ componentId, name, asset: pin(`asset.${componentId}`), position: { x: 0, y: 0 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [] });
  const current = { assetId: 'assembly.coffee', name: 'Counter coffee station', kind: 'prop', metadata: { role: 'coffee station', tags: ['domestic', 'coffee'] },
    assembly: { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64, placementBounds: { x: -40, y: -96, width: 80, height: 112 }, anchor: { x: 0, y: 0 },
      states: [{ stateId: 'idle', name: 'Idle' }, { stateId: 'brewing', name: 'Brewing' }], variants: [{ variantId: 'graphite', name: 'Graphite' }, { variantId: 'copper', name: 'Copper' }],
      defaultStateId: 'idle', defaultVariantId: 'graphite', components: [component('display', 'Status display'), component('body', 'Machine body')],
      blocking: { mode: 'components', regions: [] } } };
  current.assembly.components[0].position.y = -58;
  const proposal = { content: { ...structuredClone(current), operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1 } };
  return { current, proposal, assembly: proposal.content.assembly };
}
const allText = result => [result.headline, ...result.changes.flatMap(change => [change.label, change.detail ?? ''])].join('\n');

test('a display movement leads with its consequence and includes no unrelated change rows', () => {
  const { current, proposal, assembly } = fixture(); assembly.components[0].position.y = -62;
  const result = assemblyReviewChanges(proposal, current);
  assert.equal(result.headline, 'Status display moves 4 px upward');
  assert.deepEqual(result.changes, [{ label: result.headline, detail: 'X 0, Y -58 px → X 0, Y -62 px.' }]);
  assert.ok(!result.unchanged.includes('Blocking unchanged'), 'inherited geometry is not inferred from equal blocking mode strings');
  assert.ok(result.unchanged.includes('Placement area unchanged'));
});

test('opposite and diagonal movement uses the actual image axes', () => {
  const { current, proposal, assembly } = fixture(); assembly.components[0].position = { x: -3.5, y: -50 };
  assert.equal(assemblyReviewChanges(proposal, current).headline, 'Status display moves 3.5 px left and 8 px downward');
});

test('new Assemblies describe their contents, while unavailable updates never claim creation or unchanged content', () => {
  const { proposal } = fixture();
  let result = assemblyReviewChanges(proposal, null);
  assert.match(result.headline, /current Assembly unavailable/); assert.deepEqual(result.unchanged, []);
  proposal.content.operation = 'create'; result = assemblyReviewChanges(proposal, null);
  assert.equal(result.headline, 'Create Counter coffee station');
  assert.match(allText(result), /2 components: Status display, Machine body/);
  assert.match(allText(result), /Idle, Brewing/); assert.match(allText(result), /Graphite, Copper/);
  assert.match(allText(result), /80 × 112 px/); assert.deepEqual(result.unchanged, []);
});

test('metadata is readable, deterministic, changed-only and leaves inputs untouched', () => {
  const { current, proposal } = fixture();
  proposal.content.name = 'Coffee corner'; proposal.content.kind = 'item'; proposal.content.metadata = { role: null, tags: ['coffee', 'kitchen'] };
  const originals = structuredClone({ current, proposal }), result = assemblyReviewChanges(proposal, current), text = allText(result);
  assert.match(text, /renamed to Coffee corner/); assert.match(text, /prop to item/); assert.match(text, /role removed/);
  assert.match(text, /Tags added: kitchen/); assert.match(text, /Tags removed: domestic/);
  assert.equal(result.changes.length, 5);
  assert.deepEqual({ current, proposal }, originals);
  assert.deepEqual(assemblyReviewChanges(proposal, current), result);
});

test('source changes identify the component and exact saved versions without dumping identifiers', () => {
  const { current, proposal, assembly } = fixture();
  assembly.components[0].asset = pin('asset.display', 2, 3);
  assembly.components[1].asset = pin('asset.new-body');
  const text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Status display uses a different saved source version/);
  assert.match(text, /Asset v1, metadata v1 → Asset v2, metadata v3/);
  assert.match(text, /Machine body uses a different source Asset/);
  assert.doesNotMatch(text, /asset\.new-body|\{"/);
});

test('component edits include names, transformations, additions, removals and front-to-back order', () => {
  const { current, proposal, assembly } = fixture();
  assembly.components[0].name = 'Control display'; assembly.components[0].rotationDegrees = 27; assembly.components[0].scale = 0.5;
  assembly.components.reverse();
  let text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Status display renamed to Control display/); assert.match(text, /rotation changes from 0° to 27°/);
  assert.match(text, /scale changes from 1× to 0.5×/); assert.match(text, /Front to back: Machine body, Control display/);
  assembly.components[0] = { ...assembly.components[0], componentId: 'cup', name: 'Ready cup' };
  text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Machine body removed/); assert.match(text, /Ready cup added/); assert.match(text, /Layer 1 from the front/);
});

test('all-state, named-state and empty membership remain distinct', () => {
  const { current, proposal, assembly } = fixture();
  assembly.components[0].stateIds = ['brewing'];
  let text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Status display is used in Brewing/); assert.match(text, /Previously: every state/);
  assembly.components[0].stateIds = []; text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /unused in every state/);
  current.assembly.components[0].stateIds = []; assembly.components[0].stateIds = null;
  assert.match(allText(assemblyReviewChanges(proposal, current)), /used in every state/);
});

test('variant substitutions describe additions, changes and base-source fallback using variant names', () => {
  const { current, proposal, assembly } = fixture();
  current.assembly.components[0].variantOverrides = [{ variantId: 'copper', asset: pin('asset.copper') }];
  assembly.components[0].variantOverrides = [{ variantId: 'graphite', asset: pin('asset.graphite', 2) }];
  let text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Copper source substitution removed/); assert.match(text, /now uses the base source/);
  assert.match(text, /source substitution added for Graphite/); assert.match(text, /Asset v2/);
  assembly.components[0].variantOverrides = [{ variantId: 'copper', asset: pin('asset.copper', 3, 2) }];
  text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Status display in Copper uses a different saved source version/);
  assert.match(text, /Asset v3, metadata v2/);
});

test('state and variant definitions, display ordering and defaults each produce readable changes', () => {
  const { current, proposal, assembly } = fixture();
  assembly.states[0].name = 'Resting'; assembly.states.reverse(); assembly.defaultStateId = 'brewing';
  assembly.variants = [{ variantId: 'copper', name: 'Warm copper' }, { variantId: 'ivory', name: 'Ivory' }]; assembly.defaultVariantId = 'ivory';
  const text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /State Idle renamed to Resting/); assert.match(text, /State order changes/);
  assert.match(text, /Default state changes to Brewing/); assert.match(text, /Variant removed: Graphite/);
  assert.match(text, /Variant Copper renamed to Warm copper/); assert.match(text, /Variant added: Ivory/);
  assert.match(text, /Default variant changes to Ivory/);
});

test('bounds, anchor and assembly scale expose changed values without asserting that artwork moves', () => {
  const { current, proposal, assembly } = fixture();
  assembly.placementBounds.x -= 2; assembly.placementBounds.width += 16;
  assembly.anchor = { x: 1, y: 2 }; assembly.unitsPerPixel = 1 / 32;
  const result = assemblyReviewChanges(proposal, current), text = allText(result);
  assert.match(text, /Placement area moves 2 px left/); assert.match(text, /80 × 112 px to 96 × 112 px/);
  assert.match(text, /Assembly anchor moves 1 px right and 2 px downward/);
  assert.match(text, /0\.015625 → 0\.03125 project units/);
  assert.ok(!result.unchanged.includes('Placement area unchanged'));
});

const rectangle = (regionId, name) => ({ regionId, name, shape: { kind: 'rectangle', x: 0, y: 0, width: 8, height: 12 }, transform: [1, 0, 0, 1, 0, 0] });
test('blocking review covers mode, shape position/size/type, transform, rename and retained geometry', () => {
  const { current, proposal, assembly } = fixture();
  current.assembly.blocking.regions = [rectangle('foot', 'Foot')];
  assembly.blocking.regions = [rectangle('foot', 'Base')]; assembly.blocking.regions[0].shape.x = 2;
  assembly.blocking.regions[0].shape.height = 14; assembly.blocking.regions[0].transform = [0, 1, -1, 0, 1, 2];
  let text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Foot renamed to Base/); assert.match(text, /shape moves in its local frame/);
  assert.match(text, /8 × 12 px → 8 × 14 px/); assert.match(text, /blocking transform changes/);
  assert.match(text, /Retained for Custom blocking; component blocking remains active/);
  assembly.blocking.mode = 'custom'; assembly.blocking.regions[0].shape.kind = 'oval';
  text = allText(assemblyReviewChanges(proposal, current));
  assert.match(text, /Blocking now comes from custom shapes/); assert.match(text, /rectangle to oval/);
  assert.match(text, /across all states and variants/);
});

test('polygon changes and region additions/removals/reordering are never reported as unchanged blocking', () => {
  const { current, proposal, assembly } = fixture();
  const polygon = { regionId: 'poly', name: 'Base polygon', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }] }, transform: [1, 0, 0, 1, 0, 0] };
  current.assembly.blocking = { mode: 'custom', regions: [polygon, rectangle('remove', 'Old region'), rectangle('keep', 'Keep')] };
  assembly.blocking = structuredClone(current.assembly.blocking);
  assembly.blocking.regions[0].shape.points[1].x = 6; assembly.blocking.regions[0].shape.points.push({ x: 0, y: 8 });
  assembly.blocking.regions.splice(1, 1); assembly.blocking.regions.reverse(); assembly.blocking.regions.push(rectangle('new', 'New region'));
  const result = assemblyReviewChanges(proposal, current), text = allText(result);
  assert.match(text, /Base polygon polygon points change/); assert.match(text, /1 point moved; 1 point added/);
  assert.match(text, /removed: Old region/); assert.match(text, /added: New region/); assert.match(text, /region order changes/);
  assert.ok(!result.unchanged.includes('Blocking unchanged'));
});

test('unchanged claims are conservative and insensitive to object key serialization order', () => {
  const { current, proposal, assembly } = fixture();
  assembly.anchor = { y: 0, x: 0 };
  let result = assemblyReviewChanges(proposal, current);
  assert.equal(result.headline, 'No content changes'); assert.deepEqual(result.changes, []);
  assert.ok(result.unchanged.includes('Blocking unchanged'));
  current.assembly.blocking.mode = assembly.blocking.mode = 'custom';
  assembly.components[0].position.y -= 4;
  result = assemblyReviewChanges(proposal, current);
  assert.ok(result.unchanged.includes('Blocking unchanged'), 'custom blocking does not follow component motion');
});
