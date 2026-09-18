import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireRecord, requireString } from '../../domain/src/validation.js';
import { StudioService } from './studio-service.js';
import { fingerprint } from './value-utils.js';
import { resolveHistoricalSliceBinding } from './exact-cut-history.js';

const MAX_REQUEST_BYTES = 256 * 1024;
function fields(value, required, optional = [], label = 'request') {
  requireRecord(value, label);
  invariant(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)),
    'VALIDATION_ERROR', `${label} has missing or unsupported fields.`);
}
function exactId(value, label) { return requireId(value, label); }
function normalizeRequest(raw, save = false) {
  fields(raw, ['projectId', 'expectedRevision', 'atlasId', 'expectedAtlasVersion', 'expectedAtlasFingerprint', 'input', 'items'], save ? ['idempotencyKey'] : []);
  invariant(new TextEncoder().encode(JSON.stringify(raw)).length <= MAX_REQUEST_BYTES, 'VALIDATION_ERROR', 'The Library request exceeds its size limit.');
  if (save) exactId(raw.idempotencyKey, 'idempotencyKey');
  for (const key of ['projectId', 'atlasId']) exactId(raw[key], key);
  for (const key of ['expectedRevision', 'expectedAtlasVersion']) requireInteger(raw[key], key, { min: 1 });
  invariant(typeof raw.expectedAtlasFingerprint === 'string' && /^[a-f0-9]{64}$/.test(raw.expectedAtlasFingerprint), 'VALIDATION_ERROR', 'Expected atlas fingerprint is required.');
  const input = raw.input;
  invariant(['generated', 'saved'].includes(input?.mode), 'VALIDATION_ERROR', 'Select generated or saved images.');
  fields(input, input.mode === 'generated' ? ['mode', 'jobId'] : ['mode', 'slices'], [], 'input');
  if (input.mode === 'generated') exactId(input.jobId, 'input.jobId');
  else {
    invariant(Array.isArray(input.slices) && input.slices.length > 0 && input.slices.length <= 64, 'VALIDATION_ERROR', 'Select 1–64 exact saved images.');
    const seen = new Set();
    for (const slice of input.slices) {
      fields(slice, ['rectangleId', 'sliceId', 'expectedSliceVersion'], [], 'saved image');
      exactId(slice.rectangleId, 'rectangleId'); exactId(slice.sliceId, 'sliceId');
      requireInteger(slice.expectedSliceVersion, 'expectedSliceVersion', { min: 1 });
      invariant(!seen.has(slice.rectangleId), 'VALIDATION_ERROR', 'A cut may appear only once.'); seen.add(slice.rectangleId);
    }
  }
  invariant(Array.isArray(raw.items) && raw.items.length > 0 && raw.items.length <= 64, 'VALIDATION_ERROR', 'Choose 1–64 Library destinations.');
  const rectangles = new Set(), destinations = new Set();
  for (const item of raw.items) {
    fields(item, ['rectangleId', 'destination'], [], 'item'); exactId(item.rectangleId, 'rectangleId');
    invariant(!rectangles.has(item.rectangleId), 'VALIDATION_ERROR', 'A cut may have only one destination.'); rectangles.add(item.rectangleId);
    const d = item.destination;
    invariant(['create', 'update', 'skip'].includes(d?.operation), 'VALIDATION_ERROR', 'Choose Add, Update, or Skip.');
    if (d.operation === 'skip') { fields(d, ['operation'], [], 'skip destination'); continue; }
    exactId(d.assetId, 'assetId');
    invariant(!destinations.has(d.assetId), 'SOURCE_LIBRARY_DUPLICATE_TARGET', 'Two images cannot save to the same Library item.'); destinations.add(d.assetId);
    if (d.operation === 'create') {
      fields(d, ['operation', 'assetId', 'name', 'kind', 'metadata'], [], 'new destination');
      requireString(d.name, 'name', { max: 160 });
      invariant(['surface', 'prop', 'item'].includes(d.kind), 'VALIDATION_ERROR', 'Choose a supported image use.');
      requireRecord(d.metadata, 'metadata');
    } else {
      fields(d, ['operation', 'assetId', 'expectedAssetVersion', 'expectedMetadataVersion'], ['name'], 'update destination');
      for (const key of ['expectedAssetVersion', 'expectedMetadataVersion']) requireInteger(d[key], key, { min: 1 });
      if (Object.hasOwn(d, 'name')) requireString(d.name, 'name', { max: 160 });
    }
  }
  const { idempotencyKey: _key, ...request } = structuredClone(raw);
  return request;
}

class SourceLibrarySimulationStore {
  supportsAtomicAtlasJobs = true;
  supportsAtomicAssetLibrary = true;
  #document;
  #commandPrefix;
  constructor(document, commandPrefix) { this.#document = structuredClone(document); this.#commandPrefix = commandPrefix; }
  get sourceLibraryCommandPrefix() { return this.#commandPrefix; }
  async loadProject(projectId) { return this.#document.projectId === projectId ? this.document() : null; }
  async appendRevision(projectId, expectedRevision, revision) {
    invariant(projectId === this.#document.projectId && this.#document.revisions.at(-1).number === expectedRevision,
      'REVISION_CONFLICT', 'The Library planning head changed.');
    this.#document.revisions.push(structuredClone(revision)); return this.document();
  }
  document() { return structuredClone(this.#document); }
}

function sliceChoice(slice) { return { rectangleId: slice.rectangleId, sliceId: slice.sliceId, expectedSliceVersion: slice.version }; }
function currentOutput(atlas, slice) {
  return slice?.sourceId === atlas.sourceId && slice.definitionVersion === atlas.definitionVersion
    && slice.definitionFingerprint === atlas.definitionFingerprint
    && atlas.rectangles.some(rectangle => rectangle.rectangleId === slice.rectangleId && rectangle.included);
}
function savedInput(atlas) {
  const latest = new Map();
  for (const slice of atlas.sliceHeads ?? []) {
    if (!currentOutput(atlas, slice)) continue;
    const previous = latest.get(slice.rectangleId);
    if (!previous || slice.definitionVersion > previous.definitionVersion
      || (slice.definitionVersion === previous.definitionVersion && slice.version > previous.version)) latest.set(slice.rectangleId, slice);
  }
  return { mode: 'saved', slices: [...latest.values()].map(sliceChoice) };
}
function summary(items) {
  return { created: items.filter(item => item.status === 'created').length, updated: items.filter(item => item.status === 'updated').length,
    unchanged: items.filter(item => item.status === 'unchanged').length, skipped: items.filter(item => item.status === 'skipped').length };
}
function assetResult(rectangleId, status, asset) {
  return { rectangleId, status, assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion,
    name: asset.name, kind: asset.kind, lifecycle: asset.lifecycle, sliceBinding: structuredClone(asset.sliceBinding), findings: structuredClone(asset.findings) };
}
function sameAsset(a, b) {
  return a.name === b.name && a.kind === b.kind && a.metadataFingerprint === b.metadataFingerprint
    && fingerprint(a.sliceBinding) === fingerprint(b.sliceBinding);
}
function authoredMetadata(metadata) {
  // As in owner Asset Save, visual facts belong to the new exact image binding.
  // Retain every authored field, including metadata not exposed by this editor.
  const { pixelSize: _pixelSize, pivot: _pivot, ...authored } = structuredClone(metadata);
  return authored;
}

/** Owner-only orchestration. It invokes the existing semantic commands, never an agent authority shortcut. */
export class SourceLibraryService {
  #projects; #jobs; #operations; #clock;
  constructor({ projectStore, jobStore, operationStore, clock = () => new Date().toISOString() }) {
    invariant(projectStore?.supportsAtomicAssetLibrary && typeof projectStore.appendRevisionBatch === 'function'
      && jobStore?.isLive === true && operationStore?.workspace === projectStore.workspace,
    'SOURCE_LIBRARY_UNAVAILABLE', 'Source to Library requires one authoritative SQLite/job workspace.');
    this.#projects = projectStore; this.#jobs = jobStore; this.#operations = operationStore; this.#clock = clock;
  }
  async #owned(projectId, context) {
    exactId(projectId, 'projectId');
    const document = await this.#projects.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.');
    const head = document.revisions.at(-1);
    invariant(context?.actor?.kind === 'human' && context.actor.id === head.snapshot.project.ownerId
      && (context.branchId === undefined || context.branchId === 'branch.main') && !context.taskId && !context.grantId,
    'FORBIDDEN', 'Only the local project owner can add or update Library images directly.');
    return document;
  }
  async bootstrap(raw, context, { signal } = {}) {
    signal?.throwIfAborted();
    fields(raw, ['projectId', 'atlasId']); exactId(raw.atlasId, 'atlasId');
    const document = await this.#owned(raw.projectId, context), head = document.revisions.at(-1);
    signal?.throwIfAborted();
    const atlas = head.snapshot.atlases?.find(value => value.id === raw.atlasId);
    invariant(atlas, 'ENTITY_NOT_FOUND', 'The cutting work no longer exists.');
    const assets = head.snapshot.assetLibrary?.assets ?? [];
    const operations = this.#operations.listForAtlas(raw.projectId, atlas.id);
    return { schemaVersion: 1, projectId: raw.projectId, atlasId: atlas.id, revision: head.number,
      expectedAtlasVersion: atlas.definitionVersion, expectedAtlasFingerprint: atlas.definitionFingerprint,
      savedInput: savedInput(atlas),
      targets: assets.map(asset => ({ assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion,
        name: asset.name, kind: asset.kind, lifecycle: asset.lifecycle, metadata: structuredClone(asset.metadata), sliceBinding: structuredClone(asset.sliceBinding) })),
      priorMappings: operations.flatMap(operation => operation.receipt.items.filter(item => item.status !== 'skipped'
        && currentOutput(atlas, item.sliceBinding)).map(item => ({ ...structuredClone(item), revision: operation.lastRevision }))),
    };
  }
  async plan(raw, context, { signal } = {}) {
    signal?.throwIfAborted();
    const request = normalizeRequest(raw), document = await this.#owned(request.projectId, context);
    signal?.throwIfAborted();
    const prepared = await this.#prepare(request, document, context, 'plan', signal);
    signal?.throwIfAborted();
    return prepared.view;
  }
  async save(raw, context, { signal } = {}) {
    signal?.throwIfAborted();
    const request = normalizeRequest(raw, true), operationKey = raw.idempotencyKey;
    const document = await this.#owned(request.projectId, context);
    signal?.throwIfAborted();
    const replay = this.#operations.get(request.projectId, operationKey);
    if (replay) return this.#replay(replay, request, context);
    const prepared = await this.#prepare(request, document, context, operationKey, signal);
    signal?.throwIfAborted();
    invariant(prepared.view.canSave, prepared.view.code ?? 'SOURCE_LIBRARY_BLOCKED', prepared.view.guidance ?? 'Resolve the Library destinations before saving.', prepared.view.details ?? {});
    const now = this.#clock(), baseRevision = document.revisions.at(-1).number;
    const receipt = { schemaVersion: 1, projectId: request.projectId, atlasId: request.atlasId,
      revision: prepared.revisions.at(-1)?.number ?? baseRevision, status: prepared.revisions.length ? 'SAVED' : 'UNCHANGED',
      summary: prepared.view.summary, items: prepared.view.items, replayed: false };
    const operation = { projectId: request.projectId, operationKey, actorId: context.actor.id, atlasId: request.atlasId, request, receipt,
      firstRevision: prepared.revisions[0]?.number ?? baseRevision, lastRevision: receipt.revision, createdAt: now };
    // Last cancellable point: each following SQLite transaction is synchronous
    // and must finish atomically. A committed result remains replayable.
    signal?.throwIfAborted();
    try {
      if (prepared.revisions.length) await this.#projects.appendRevisionBatch(request.projectId, baseRevision, prepared.revisions,
        { afterAppend: database => this.#operations.recordInTransaction(database, operation) });
      else this.#operations.recordUnchanged(operation, baseRevision);
    } catch (error) {
      const concurrent = this.#operations.get(request.projectId, operationKey);
      if (concurrent) return this.#replay(concurrent, request, context);
      throw error;
    }
    return receipt;
  }
  #replay(operation, request, context) {
    invariant(operation.actorId === context.actor.id && operation.requestFingerprint === fingerprint({ actorId: context.actor.id, request }),
      'IDEMPOTENCY_CONFLICT', 'This save identity already belongs to a different request. Retry the original unchanged save.');
    return { ...structuredClone(operation.receipt), replayed: true };
  }
  async #prepare(request, document, context, operationKey, signal) {
    const originalHead = document.revisions.at(-1), snapshot = originalHead.snapshot;
    invariant(originalHead.number === request.expectedRevision, 'REVISION_CONFLICT', 'The project changed. Recheck the Library destinations before saving.');
    const atlas = snapshot.atlases?.find(value => value.id === request.atlasId);
    invariant(atlas && atlas.definitionVersion === request.expectedAtlasVersion && atlas.definitionFingerprint === request.expectedAtlasFingerprint,
      'ENTITY_VERSION_CONFLICT', 'The cutting layout changed. Reopen its current output before saving.');
    const source = snapshot.sources.find(value => value.id === atlas.sourceId);
    invariant(source?.lifecycle?.state === 'APPROVED_SOURCE' && source.review?.disposition === 'USER_APPROVED',
      'ATLAS_SOURCE_NOT_APPROVED', 'The original image must be approved before creating Library content.');
    const prefix = `source.library.${fingerprint({ projectId: request.projectId, operationKey }).slice(0, 32)}`;
    const simulationStore = new SourceLibrarySimulationStore(document, prefix);
    const simulation = new StudioService({ store: simulationStore, jobStore: this.#jobs, clock: this.#clock });
    let sequence = 0;
    const execute = async (type, payload) => {
      const revision = simulationStore.document().revisions.at(-1).number;
      return simulation.execute({ schemaVersion: 1, commandId: `${prefix}.${++sequence}`, idempotencyKey: `${prefix}.${sequence}`,
        type, projectId: request.projectId, baseRevision: revision, expectedVersion: revision, payload }, context, { signal });
    };
    const block = (code, guidance, details) => ({ revisions: [], view: { schemaVersion: 1, projectId: request.projectId, atlasId: atlas.id,
      revision: originalHead.number, status: 'BLOCKED', canSave: false, code, guidance, details, summary: summary([]), items: [] } });
    let selected;
    if (request.input.mode === 'generated') {
      const job = this.#jobs.get(request.projectId, request.input.jobId);
      invariant(job?.projectId === request.projectId && job.input?.atlasId === atlas.id
        && job.input.atlasDefinitionVersion === atlas.definitionVersion && job.input.atlasDefinitionFingerprint === atlas.definitionFingerprint,
      'JOB_INPUT_MISMATCH', 'These generated images do not belong to the current cutting layout.');
      if (job.state === 'APPLIED') return block('SOURCE_LIBRARY_USE_SAVED_OUTPUTS', 'These images are already saved. Use their saved output destinations.', { savedInput: savedInput(atlas) });
      invariant(job.state === 'SUCCEEDED' && job.appliedRevision === null, 'JOB_STATE_CONFLICT', 'Wait for the exact output job to finish before adding images.');
      const included = atlas.rectangles.filter(rect => rect.included);
      const colliding = included.filter(rect => rect.replacesSliceId === null && (atlas.sliceHeads ?? []).some(slice =>
        slice.sliceId === `slice.${fingerprint({ atlasId: atlas.id, definitionVersion: atlas.definitionVersion, rectangleId: rect.rectangleId }).slice(0, 32)}`));
      if (colliding.length) return block('REDUNDANT_OUTPUTS_DISCARD_REQUIRED',
        'This cutting layout already has saved images. Discard this extra generated preview, then use the saved images to choose Library destinations.',
        { discardJobId: job.jobId, savedInput: savedInput(atlas) });
      const result = await execute('atlas.commit.slices', { atlasId: atlas.id, expectedAtlasVersion: atlas.definitionVersion,
        expectedDefinitionFingerprint: atlas.definitionFingerprint, jobId: job.jobId });
      selected = result.value.slices.map(slice => ({ rectangleId: slice.rectangleId, sliceId: slice.sliceId, expectedSliceVersion: slice.version }));
    } else selected = request.input.slices;
    invariant(selected.length === request.items.length && selected.every(slice => request.items.some(item => item.rectangleId === slice.rectangleId)),
      'SOURCE_LIBRARY_SELECTION_MISMATCH', 'Give every selected output exactly one Add, Update, or Skip destination.');
    const sliceByRectangle = new Map();
    const simulatedDocument = simulationStore.document(), currentAtlas = simulatedDocument.revisions.at(-1).snapshot.atlases.find(value => value.id === atlas.id);
    for (const choice of selected) {
      const slice = currentAtlas.sliceHeads.find(value => value.sliceId === choice.sliceId && value.rectangleId === choice.rectangleId);
      invariant(slice && slice.version === choice.expectedSliceVersion, 'ENTITY_VERSION_CONFLICT', 'A selected saved image changed. Recheck its exact version.');
      sliceByRectangle.set(choice.rectangleId, resolveHistoricalSliceBinding(simulatedDocument, request.projectId, slice.sliceId, slice.version));
    }
    const operations = this.#operations.listForAtlas(request.projectId, atlas.id), items = [];
    for (const item of request.items) {
      signal?.throwIfAborted();
      const d = item.destination;
      if (d.operation === 'skip') { items.push({ rectangleId: item.rectangleId, status: 'skipped' }); continue; }
      const current = simulationStore.document().revisions.at(-1).snapshot.assetLibrary?.assets.find(asset => asset.assetId === d.assetId);
      const sliceBinding = sliceByRectangle.get(item.rectangleId);
      if (d.operation === 'update') invariant(current && current.assetVersion === d.expectedAssetVersion && current.metadataVersion === d.expectedMetadataVersion,
        'ENTITY_VERSION_CONFLICT', 'The destination Library item changed. Recheck the current version.', { assetId: d.assetId });
      if (d.operation === 'create' && current) {
        const prior = operations.some(operation => operation.request.items.some(candidate => candidate.rectangleId === item.rectangleId
          && fingerprint(candidate.destination) === fingerprint(d)) && operation.receipt.items.some(result => result.rectangleId === item.rectangleId
          && result.assetId === current.assetId && result.assetVersion === current.assetVersion && result.metadataVersion === current.metadataVersion));
        invariant(prior && current.name === d.name && current.kind === d.kind && fingerprint(current.sliceBinding) === fingerprint(sliceBinding),
          'ENTITY_EXISTS', 'This Library identity already exists. Select Update or choose a new item identity.', { assetId: d.assetId });
        items.push(assetResult(item.rectangleId, 'unchanged', current)); continue;
      }
      const payload = { assetId: d.assetId, operation: d.operation, expectedAssetVersion: current?.assetVersion ?? 0,
        expectedMetadataVersion: current?.metadataVersion ?? 0, name: d.name ?? current.name, kind: d.operation === 'create' ? d.kind : current.kind,
        metadata: d.operation === 'create' ? structuredClone(d.metadata) : authoredMetadata(current.metadata),
        image: { mode: 'saved-slice', sliceId: sliceBinding.sliceId, expectedSliceVersion: sliceBinding.sliceVersion } };
      // Validate an update without adding a redundant version to the real batch.
      if (current) {
        const trialStore = new SourceLibrarySimulationStore(simulationStore.document(), prefix);
        const trial = new StudioService({ store: trialStore, jobStore: this.#jobs, clock: this.#clock });
        const revision = trialStore.document().revisions.at(-1).number;
        await trial.execute({ schemaVersion: 1, commandId: `${prefix}.check.${sequence}`, idempotencyKey: `${prefix}.check.${sequence}`,
          type: 'asset.save', projectId: request.projectId, baseRevision: revision, expectedVersion: revision, payload }, context, { signal });
        const candidate = trialStore.document().revisions.at(-1).snapshot.assetLibrary.assets.find(asset => asset.assetId === current.assetId);
        if (sameAsset(current, candidate)) { items.push(assetResult(item.rectangleId, 'unchanged', current)); continue; }
      }
      await execute('asset.save', payload);
      const saved = simulationStore.document().revisions.at(-1).snapshot.assetLibrary.assets.find(asset => asset.assetId === d.assetId);
      items.push(assetResult(item.rectangleId, d.operation === 'create' ? 'created' : 'updated', saved));
    }
    return { revisions: simulationStore.document().revisions.filter(revision => revision.number > originalHead.number),
      view: { schemaVersion: 1, projectId: request.projectId, atlasId: atlas.id, revision: originalHead.number,
        status: 'READY', canSave: true, summary: summary(items), items } };
  }
}
