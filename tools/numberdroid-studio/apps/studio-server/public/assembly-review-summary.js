// Presentation only: compare immutable declarations without resolving, changing,
// or inferring saved geometry. Exact records remain available in technical detail.
const same = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
};
const number = value => String(Object.is(value, -0) ? 0 : value);
const count = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;
const names = values => values.length ? values.join(', ') : 'none';
const index = (values, key) => new Map(values.map(value => [value[key], value]));
const position = point => `X ${number(point.x)}, Y ${number(point.y)} px`;
const dimensions = bounds => `${number(bounds.width)} × ${number(bounds.height)} px`;
const shapeDescription = shape => shape.kind === 'polygon' ? `${count(shape.points.length, 'point')}` : `${dimensions(shape)} at ${position(shape)}`;
const movement = (before, after) => {
  const pieces = [];
  if (before.x !== after.x) pieces.push(`${number(Number(Math.abs(after.x - before.x).toPrecision(12)))} px ${after.x < before.x ? 'left' : 'right'}`);
  if (before.y !== after.y) pieces.push(`${number(Number(Math.abs(after.y - before.y).toPrecision(12)))} px ${after.y < before.y ? 'upward' : 'downward'}`);
  return pieces.join(' and ');
};
const changedOrder = (before, after, key) => {
  const oldIds = new Set(before.map(value => value[key])), newIds = new Set(after.map(value => value[key]));
  return !same(before.filter(value => newIds.has(value[key])).map(value => value[key]), after.filter(value => oldIds.has(value[key])).map(value => value[key]));
};
const stateNames = (ids, assembly) => ids === null ? 'every state' : names(ids.map(id => assembly.states.find(state => state.stateId === id)?.name ?? 'unavailable state'));
const variantName = (id, assembly) => assembly.variants.find(variant => variant.variantId === id)?.name ?? 'unavailable variant';
const choiceName = (id, choices, key) => choices.find(choice => choice[key] === id)?.name ?? 'unavailable choice';
const pinVersion = pin => `Asset v${pin.assetVersion}, metadata v${pin.metadataVersion}`;
const blockingMode = mode => mode === 'custom' ? 'custom shapes' : 'active components';

export function assemblyReviewChanges(proposal, currentAsset) {
  const content = proposal.content, after = content.assembly;
  const changes = [], unchanged = [];
  const add = (label, detail) => changes.push(detail ? { label, detail } : { label });
  const leaves = [...(currentAsset?.leafAssets ?? []), ...(proposal.leafAssets ?? []), ...(content.leafAssets ?? [])];
  const leafName = pin => leaves.find(leaf => leaf.assetId === pin.assetId && leaf.assetVersion === pin.assetVersion && leaf.metadataVersion === pin.metadataVersion)?.name;
  const pinChange = (label, oldPin, newPin) => {
    if (same(oldPin, newPin)) return;
    const oldName = leafName(oldPin), newName = leafName(newPin);
    if (oldPin.assetId !== newPin.assetId) add(`${label} uses a different source Asset`, `${oldName ?? 'Previous source'} (${pinVersion(oldPin)}) → ${newName ?? 'Replacement source'} (${pinVersion(newPin)}).`);
    else add(`${label} uses a different saved source version`, `${pinVersion(oldPin)} → ${pinVersion(newPin)}.`);
  };
  const describeComponent = component => `${leafName(component.asset) ?? 'Saved source'} (${pinVersion(component.asset)}); ${position(component.position)}; rotation ${number(component.rotationDegrees)}°; scale ${number(component.scale)}×; used in ${stateNames(component.stateIds, after)}${component.variantOverrides.length ? `; substitutions for ${names(component.variantOverrides.map(value => variantName(value.variantId, after)))}` : ''}.`;
  if (!currentAsset) {
    const creating = content.operation === 'create';
    add(`${content.kind[0].toUpperCase()}${content.kind.slice(1)} Assembly`, content.metadata.role ? `Role: ${content.metadata.role}.` : undefined);
    add(`${count(after.components.length, 'component')}: ${names(after.components.map(component => component.name))}`);
    add(`States: ${names(after.states.map(state => state.name))}`, `Default: ${choiceName(after.defaultStateId, after.states, 'stateId')}.`);
    add(`Variants: ${names(after.variants.map(variant => variant.name))}`, `Default: ${variantName(after.defaultVariantId, after)}.`);
    add(`Blocking comes from ${blockingMode(after.blocking.mode)}`, after.blocking.mode === 'custom' ? count(after.blocking.regions.length, 'custom region') : undefined);
    add(`Placement area: ${dimensions(after.placementBounds)}`, `Origin: ${position(after.placementBounds)}. Anchor: ${position(after.anchor)}.`);
    return { headline: creating ? `Create ${content.name}` : `Proposed ${content.name} — current Assembly unavailable`, changes, unchanged };
  }
  const before = currentAsset.assembly;
  if (currentAsset.name !== content.name) add(`Assembly renamed to ${content.name}`, `Previously ${currentAsset.name}.`);
  if (currentAsset.kind !== content.kind) add(`Asset kind changes from ${currentAsset.kind} to ${content.kind}`);
  if (currentAsset.metadata.role !== content.metadata.role) add(content.metadata.role === null ? 'Descriptive role removed' : `Descriptive role changes to ${content.metadata.role}`, `Previously ${currentAsset.metadata.role ?? 'not set'}.`);
  const oldTags = currentAsset.metadata.tags, newTags = content.metadata.tags;
  const addedTags = newTags.filter(tag => !oldTags.includes(tag)), removedTags = oldTags.filter(tag => !newTags.includes(tag));
  if (addedTags.length) add(`Tags added: ${names(addedTags)}`);
  if (removedTags.length) add(`Tags removed: ${names(removedTags)}`);
  if (changedOrder(oldTags.map(name => ({ name })), newTags.map(name => ({ name })), 'name')) add('Tags reordered', names(newTags));

  const oldComponents = index(before.components, 'componentId'), newComponents = index(after.components, 'componentId');
  for (const component of before.components) if (!newComponents.has(component.componentId)) add(`${component.name} removed`);
  for (const component of after.components) {
    const old = oldComponents.get(component.componentId), label = component.name;
    if (!old) { add(`${label} added`, `Layer ${after.components.indexOf(component) + 1} from the front. ${describeComponent(component)}`); continue; }
    if (old.name !== component.name) add(`${old.name} renamed to ${label}`);
    if (!same(old.position, component.position)) add(`${label} moves ${movement(old.position, component.position)}`, `${position(old.position)} → ${position(component.position)}.`);
    if (old.rotationDegrees !== component.rotationDegrees) add(`${label} rotation changes from ${number(old.rotationDegrees)}° to ${number(component.rotationDegrees)}°`);
    if (old.scale !== component.scale) add(`${label} scale changes from ${number(old.scale)}× to ${number(component.scale)}×`);
    pinChange(label, old.asset, component.asset);
    if (!same(old.stateIds, component.stateIds)) {
      const members = component.stateIds;
      add(members === null ? `${label} is used in every state` : members.length ? `${label} is used in ${stateNames(members, after)}` : `${label} is unused in every state`, `Previously: ${stateNames(old.stateIds, before)}.`);
    }
    const oldOverrides = index(old.variantOverrides, 'variantId'), newOverrides = index(component.variantOverrides, 'variantId');
    for (const override of old.variantOverrides) if (!newOverrides.has(override.variantId)) {
      const remains = after.variants.some(variant => variant.variantId === override.variantId);
      add(`${label}: ${variantName(override.variantId, before)} source substitution removed`, remains ? 'This variant now uses the base source.' : 'This variant is also removed.');
    }
    for (const override of component.variantOverrides) {
      const previous = oldOverrides.get(override.variantId), choice = variantName(override.variantId, after);
      if (!previous) add(`${label}: source substitution added for ${choice}`, `${leafName(override.asset) ?? 'Saved source'} (${pinVersion(override.asset)}).`);
      else pinChange(`${label} in ${choice}`, previous.asset, override.asset);
    }
    if (changedOrder(old.variantOverrides, component.variantOverrides, 'variantId')) add(`${label}: variant substitutions reordered`, names(component.variantOverrides.map(value => variantName(value.variantId, after))));
  }
  if (changedOrder(before.components, after.components, 'componentId')) add('Component layer order changes', `Front to back: ${names(after.components.map(component => component.name))}.`);

  for (const [collection, key, singular] of [['states', 'stateId', 'State'], ['variants', 'variantId', 'Variant']]) {
    const oldChoices = index(before[collection], key), newChoices = index(after[collection], key);
    for (const choice of before[collection]) if (!newChoices.has(choice[key])) add(`${singular} removed: ${choice.name}`);
    for (const [i, choice] of after[collection].entries()) {
      const old = oldChoices.get(choice[key]);
      if (!old) add(`${singular} added: ${choice.name}`, `Position ${i + 1} in the ${singular.toLowerCase()} list.`);
      else if (old.name !== choice.name) add(`${singular} ${old.name} renamed to ${choice.name}`);
    }
    if (changedOrder(before[collection], after[collection], key)) add(`${singular} order changes`, names(after[collection].map(choice => choice.name)));
  }
  if (before.defaultStateId !== after.defaultStateId) add(`Default state changes to ${choiceName(after.defaultStateId, after.states, 'stateId')}`, `Previously ${choiceName(before.defaultStateId, before.states, 'stateId')}.`);
  if (before.defaultVariantId !== after.defaultVariantId) add(`Default variant changes to ${variantName(after.defaultVariantId, after)}`, `Previously ${variantName(before.defaultVariantId, before)}.`);

  if (before.unitsPerPixel !== after.unitsPerPixel) add('Assembly scale changes', `One pixel represents ${number(before.unitsPerPixel)} → ${number(after.unitsPerPixel)} project units.`);
  const oldBounds = before.placementBounds, bounds = after.placementBounds;
  if (oldBounds.x !== bounds.x || oldBounds.y !== bounds.y) add(`Placement area moves ${movement(oldBounds, bounds)}`, `${position(oldBounds)} → ${position(bounds)}. Artwork stays in place.`);
  if (oldBounds.width !== bounds.width || oldBounds.height !== bounds.height) add(`Placement area changes from ${dimensions(oldBounds)} to ${dimensions(bounds)}`, 'Artwork stays in place.');
  if (!same(before.anchor, after.anchor)) add(`Assembly anchor moves ${movement(before.anchor, after.anchor)}`, `${position(before.anchor)} → ${position(after.anchor)}. Artwork stays in place.`);

  if (before.blocking.mode !== after.blocking.mode) add(`Blocking now comes from ${blockingMode(after.blocking.mode)}`, after.blocking.mode === 'custom' ? 'Custom shapes apply across all states and variants; they stay fixed when components move.' : 'Each active component contributes its saved blocking through its position, rotation and scale.');
  const oldRegions = index(before.blocking.regions, 'regionId'), newRegions = index(after.blocking.regions, 'regionId');
  const regionDetail = after.blocking.mode === 'custom' ? 'Used by this Assembly.' : 'Retained for Custom blocking; component blocking remains active.';
  for (const region of before.blocking.regions) if (!newRegions.has(region.regionId)) add(`Custom blocking region removed: ${region.name}`, regionDetail);
  for (const region of after.blocking.regions) {
    const old = oldRegions.get(region.regionId), label = region.name;
    if (!old) { add(`Custom blocking region added: ${label}`, `${region.shape.kind}, ${shapeDescription(region.shape)}; ${regionDetail}`); continue; }
    if (old.name !== label) add(`Blocking region ${old.name} renamed to ${label}`);
    if (!same(old.shape, region.shape)) {
      if (old.shape.kind !== region.shape.kind) add(`${label} blocking changes from ${old.shape.kind} to ${region.shape.kind}`, `${shapeDescription(old.shape)} → ${shapeDescription(region.shape)}. ${regionDetail}`);
      else if (region.shape.kind === 'polygon') {
        const oldPoints = old.shape.points, points = region.shape.points;
        const moved = points.filter((point, i) => i < oldPoints.length && !same(point, oldPoints[i])).length;
        const details = [moved ? `${count(moved, 'point')} moved` : '', points.length > oldPoints.length ? `${count(points.length - oldPoints.length, 'point')} added` : '', oldPoints.length > points.length ? `${count(oldPoints.length - points.length, 'point')} removed` : ''].filter(Boolean);
        add(`${label} polygon points change`, `${details.join('; ')}. ${regionDetail}`);
      } else {
        if (old.shape.x !== region.shape.x || old.shape.y !== region.shape.y) add(`${label} blocking shape moves in its local frame`, `${position(old.shape)} → ${position(region.shape)}. ${regionDetail}`);
        if (old.shape.width !== region.shape.width || old.shape.height !== region.shape.height) add(`${label} blocking size changes`, `${dimensions(old.shape)} → ${dimensions(region.shape)}. ${regionDetail}`);
      }
    }
    if (!same(old.transform, region.transform)) {
      const details = [];
      if (!same(old.transform.slice(0, 4), region.transform.slice(0, 4))) {
        const angle = transform => number(Number((Math.atan2(transform[1], transform[0]) * 180 / Math.PI).toPrecision(12)));
        details.push(angle(old.transform) === angle(region.transform) ? 'Saved rotation transform adjusted.' : `Rotation: ${angle(old.transform)}° → ${angle(region.transform)}°.`);
      }
      if (!same(old.transform.slice(4), region.transform.slice(4))) details.push(`Position: ${position({ x: old.transform[4], y: old.transform[5] })} → ${position({ x: region.transform[4], y: region.transform[5] })}.`);
      add(`${label} blocking transform changes`, `${details.join(' ')} ${regionDetail}`);
    }
  }
  if (changedOrder(before.blocking.regions, after.blocking.regions, 'regionId')) add('Custom blocking region order changes', names(after.blocking.regions.map(region => region.name)));
  if (before.schemaVersion !== after.schemaVersion) add('Assembly format version changes', `${before.schemaVersion} → ${after.schemaVersion}.`);
  if (before.coordinateSpace !== after.coordinateSpace) add('Assembly coordinate space changes');

  // A mode string alone cannot establish unchanged blocking: inherited regions
  // also depend on exact source pins, transforms, membership and preview choices.
  const blockingComponents = assembly => assembly.components.map(({ name, ...component }) => component);
  const blockingUnchanged = same(before.blocking, after.blocking) && before.unitsPerPixel === after.unitsPerPixel
    && (after.blocking.mode === 'custom' || (same(blockingComponents(before), blockingComponents(after))
      && same(before.states.map(state => state.stateId), after.states.map(state => state.stateId))
      && same(before.variants.map(variant => variant.variantId), after.variants.map(variant => variant.variantId))
      && before.defaultStateId === after.defaultStateId && before.defaultVariantId === after.defaultVariantId));
  if (blockingUnchanged) unchanged.push('Blocking unchanged');
  if (same(before.placementBounds, after.placementBounds) && before.unitsPerPixel === after.unitsPerPixel) unchanged.push('Placement area unchanged');
  if (same(before.states, after.states) && before.defaultStateId === after.defaultStateId && same(before.variants, after.variants) && before.defaultVariantId === after.defaultVariantId) unchanged.push('States and variants unchanged');
  return { headline: changes.length === 1 ? changes[0].label : changes.length ? `${count(changes.length, 'change')} to ${content.name}` : 'No content changes', changes, unchanged };
}
