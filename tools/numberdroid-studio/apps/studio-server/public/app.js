const visualFixture = new URLSearchParams(location.search).get('visualFixture');
const MAX_ATLAS_JOB_ATTEMPTS = 3;
const visualEvidenceErrors = [];
if (visualFixture) {
  document.documentElement.dataset.visualEvidenceReady = 'false';
  window.addEventListener('error', (event) => {
    visualEvidenceErrors.push(event.message || 'window error');
    document.documentElement.dataset.visualErrorCount = String(visualEvidenceErrors.length);
  });
  window.addEventListener('unhandledrejection', (event) => {
    visualEvidenceErrors.push(event.reason?.message || 'unhandled rejection');
    document.documentElement.dataset.visualErrorCount = String(visualEvidenceErrors.length);
  });
}

const state = {
  projects: [],
  project: null,
  activity: [],
  agentAccess: null,
  agentAccessCsrf: null,
  pendingAgentAccess: null,
  hostBindingSupport: 'SQLITE_REQUIRED',
  hostBindings: [],
  pendingHosts: [],
  mcpLauncherConfig: null,
  showMcpLauncherConfig: false,
  labResult: null,
  sourceMutationPending: false,
  sourceIntakes: [],
  sourceDraft: null,
  resumingIntakeId: null,
  sourceOperationKeys: new Map(),
  sourceFileChooserActive: false,
  cutter: null,
  cutterJob: null,
  cutterJobEvents: [],
  cutterScroll: null,
  cutterScrollResetPending: false,
  cutterDomDraft: null,
  cutterDeferredRender: false,
  cutterPending: false,
  assetMutationPending: false,
  assetOperationKeys: new Map(),
  assetUi: {
    search: '',
    kind: 'all',
    lifecycle: 'all',
    findingSeverity: 'all',
    selectedProposalId: null,
    selectedAssetId: null,
    decisionDrafts: {},
    decisionContext: null,
    dirty: false,
    conflict: null,
    domState: null,
    previewRotations: {},
  },
  roomMutationPending: false,
  roomOperationKeys: new Map(),
  roomUi: {
    activeTool: 'SELECT',
    dockPanel: 'properties',
    lastShapeEdit: null,
    shapeDraft: null,
    shapeConflict: null,
    selectedRoomVariantId: null,
    selectedPlacementId: null,
    selectedConnectorId: null,
    selectedPaletteAssetId: null,
    previewAssetId: null,
    selectedProposalId: null,
    paletteSearch: '',
    zoom: 'fit',
    layers: { STRUCTURAL_SURFACE: true, SET_DRESSING: true, CONNECTORS: true },
    decisionDrafts: {},
    decisionContext: null,
    dirty: false,
    conflict: null,
    domState: null,
  },
  taskMutationPending: false,
  tasks: [],
  taskUi: {
    view: 'list',
    selectedTaskId: null,
  },
  workspace: location.hash.slice(1) || 'overview',
  refreshing: false,
};

let sourceIntakeFormCache = null;
let sourceIntakeFormContext = null;
let cutterJobPollController = {
  generation: 0,
  context: null,
  timer: null,
  inFlight: null,
  abortController: null,
};
let cutterDrag = null;
let roomEditorFocusGeneration = 0;

function resetSourceIntakeForm() {
  const file = sourceIntakeFormCache?.querySelector('[data-source-file]');
  if (file) file.value = '';
  sourceIntakeFormCache = null;
  sourceIntakeFormContext = null;
  state.sourceFileChooserActive = false;
}

function setSourceIntakeFormPending(form, pending) {
  if (!form) return;
  for (const control of form.querySelectorAll('input, select, textarea, button')) {
    if (pending) {
      if (!control.hasAttribute('data-source-pending-was-disabled')) {
        control.dataset.sourcePendingWasDisabled = String(control.disabled);
      }
      control.disabled = true;
    } else if (control.hasAttribute('data-source-pending-was-disabled')) {
      control.disabled = control.dataset.sourcePendingWasDisabled === 'true';
      delete control.dataset.sourcePendingWasDisabled;
    }
  }
}

function sourceOperationKey(operation, target = 'pending', projectId = state.project?.projectId ?? 'none') {
  const key = `${operation}:${projectId}:${target}`;
  if (!state.sourceOperationKeys.has(key)) {
    state.sourceOperationKeys.set(key, `${operation}.${crypto.randomUUID()}`);
  }
  return state.sourceOperationKeys.get(key);
}

function clearSourceOperationKey(operation, target = 'pending', projectId = state.project?.projectId ?? 'none') {
  state.sourceOperationKeys.delete(`${operation}:${projectId}:${target}`);
}

function assetOperationKey(operation, target, projectId = state.project?.projectId ?? 'none') {
  const key = `${operation}:${projectId}:${target}`;
  if (!state.assetOperationKeys.has(key)) {
    state.assetOperationKeys.set(key, `${operation}.${crypto.randomUUID()}`);
  }
  return state.assetOperationKeys.get(key);
}

function clearAssetOperationKey(operation, target, projectId = state.project?.projectId ?? 'none') {
  state.assetOperationKeys.delete(`${operation}:${projectId}:${target}`);
}

function roomOperationKey(operation, target, projectId = state.project?.projectId ?? 'none') {
  const key = `${operation}:${projectId}:${target}`;
  if (!state.roomOperationKeys.has(key)) {
    state.roomOperationKeys.set(key, `${operation}.${crypto.randomUUID()}`);
  }
  return state.roomOperationKeys.get(key);
}

function clearRoomOperationKey(operation, target, projectId = state.project?.projectId ?? 'none') {
  state.roomOperationKeys.delete(`${operation}:${projectId}:${target}`);
}

const elements = Object.fromEntries(
  [
    'project-select', 'demo-button', 'refresh-button', 'workspace-nav', 'workspace-content',
    'workspace-eyebrow', 'project-name', 'project-description', 'project-status', 'revision-label',
    'activity-list', 'activity-count', 'connection-dot', 'connection-label', 'toast',
    'agent-access-select', 'agent-access-state', 'agent-access-panel', 'agent-access-close',
    'agent-access-details', 'agent-access-warnings', 'agent-access-retry',
    'agent-launcher-show', 'agent-binding-support', 'agent-pending-empty', 'agent-pending-list',
    'agent-binding-empty', 'agent-binding-list',
    'agent-launcher-panel', 'agent-launcher-config', 'agent-launcher-copy',
  ].map((id) => [id, document.getElementById(id)]),
);

function updateMutationControls() {
  const pending = state.cutterPending || state.sourceMutationPending || state.assetMutationPending
    || state.roomMutationPending || state.taskMutationPending;
  elements['project-select'].disabled = pending;
  elements['refresh-button'].disabled = pending || state.refreshing;
  elements['demo-button'].disabled = pending;
  elements['agent-access-select'].disabled = pending || !state.project || !state.agentAccess
    || state.agentAccess.state === 'REQUESTING';
  elements['agent-access-state'].disabled = pending || !state.project || !state.agentAccess;
  elements['agent-access-panel'].inert = pending;
  for (const control of elements['workspace-content'].querySelectorAll('[data-task-control], [data-task-form] input, [data-task-form] textarea, [data-task-form] button')) {
    if (state.taskMutationPending) {
      if (!control.disabled) control.dataset.disabledByTaskPending = 'true';
      control.disabled = true;
    } else if (control.dataset.disabledByTaskPending === 'true') {
      control.disabled = false;
      delete control.dataset.disabledByTaskPending;
    }
  }
}

function setAssetMutationPending(pending) {
  state.assetMutationPending = pending;
  updateMutationControls();
  for (const control of elements['workspace-content'].querySelectorAll(
    '[data-asset-filter], [data-proposal-select], [data-proposal-decision], '
      + '[data-proposal-apply], [data-asset-lifecycle], [data-proposal-disposition], '
      + '[data-proposal-reason]',
  )) control.disabled = pending;
}

function setRoomMutationPending(pending) {
  state.roomMutationPending = pending;
  updateMutationControls();
  const editorStatus = elements['workspace-content'].querySelector('.room-editor-status');
  if (pending && editorStatus) { editorStatus.textContent = 'Saving…'; editorStatus.dataset.pending = 'true'; }
  for (const control of elements['workspace-content'].querySelectorAll('[data-room-control], [data-room-form] input, [data-room-form] select, [data-room-form] textarea, [data-room-form] button')) {
    if (pending) {
      if (!control.hasAttribute('data-room-pending-was-disabled')) control.dataset.roomPendingWasDisabled = String(control.disabled);
      control.disabled = true;
    } else if (control.hasAttribute('data-room-pending-was-disabled')) {
      control.disabled = control.dataset.roomPendingWasDisabled === 'true'; delete control.dataset.roomPendingWasDisabled;
    }
  }
}

function setCutterPending(pending) {
  state.cutterPending = pending;
  updateMutationControls();
}

function setSourceMutationPending(pending) {
  state.sourceMutationPending = pending;
  updateMutationControls();
  const forms = new Set(elements['workspace-content'].querySelectorAll('[data-source-intake-form]'));
  if (sourceIntakeFormCache) forms.add(sourceIntakeFormCache);
  for (const form of forms) setSourceIntakeFormPending(form, pending);
  for (const cutter of elements['workspace-content'].querySelectorAll('[data-atlas-cutter]')) {
    cutter.inert = pending || state.cutterPending;
  }
  for (const control of elements['workspace-content'].querySelectorAll(
    '[data-resume-source-intake], [data-discard-source-intake], [data-source-review-propose], '
      + '[data-source-review-decision], [data-open-cutter], [data-close-cutter], [data-add-rectangle], '
      + '[data-save-atlas], [data-preview-atlas], [data-commit-atlas], [data-cancel-cutter-job], '
      + '[data-retry-cutter-job], [data-discard-cutter-job], [data-demo-action]',
  )) control.disabled = pending;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json', ...options.headers } : options.headers,
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || `Request failed: ${response.status}`);
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

const accessStateLabels = {
  OFF: 'OFF', REQUESTING: 'REQUESTING', ACTIVE_READ_ONLY: 'READ ONLY', ACTIVE_DRAFT: 'DRAFT',
  ACTIVE_EXECUTE: 'SCOPED', EXPIRED: 'EXPIRED', REVOKED: 'REVOKED', DENIED: 'DENIED',
  SERVICE_UNAVAILABLE: 'UNAVAILABLE',
};

function setAgentAccessPanel(open) {
  elements['agent-access-panel'].hidden = !open;
  elements['agent-access-state'].setAttribute('aria-expanded', String(open));
  const policyLabel = elements['agent-access-state'].dataset.policyLabel ?? 'OFF';
  const activeHostCount = Number(elements['agent-access-state'].dataset.activeHostCount ?? 0);
  elements['agent-access-state'].setAttribute(
    'aria-label',
    `Agent policy ${policyLabel}; ${activeHostCount} authorized active ${activeHostCount === 1 ? 'host' : 'hosts'}. ${open ? 'Close' : 'Open'} details.`,
  );
}

function renderAgentAccess() {
  const policy = state.agentAccess;
  const disabled = !state.project || !policy;
  const mutationPending = state.cutterPending || state.sourceMutationPending || state.assetMutationPending
    || state.roomMutationPending || state.taskMutationPending;
  elements['agent-access-select'].disabled = mutationPending || disabled || policy?.state === 'REQUESTING';
  elements['agent-access-state'].disabled = mutationPending || disabled;
  elements['agent-access-panel'].inert = mutationPending;
  elements['agent-access-select'].value = policy?.mode ?? 'off';
  const policyLabel = accessStateLabels[policy?.state] ?? 'OFF';
  const activeHostCount = state.hostBindings.filter((binding) => binding.status === 'ACTIVE').length;
  const hostLabel = activeHostCount ? `${activeHostCount} HOST${activeHostCount === 1 ? '' : 'S'}` : 'NO HOST';
  elements['agent-access-state'].textContent = `${policyLabel} · ${hostLabel}`;
  elements['agent-access-state'].dataset.policyLabel = policyLabel;
  elements['agent-access-state'].dataset.activeHostCount = String(activeHostCount);
  setAgentAccessPanel(!elements['agent-access-panel'].hidden);
  elements['agent-access-state'].dataset.state = policy?.state ?? 'OFF';
  elements['agent-access-retry'].hidden = !state.pendingAgentAccess;
  const hasActivePolicy = Boolean(policy?.state?.startsWith('ACTIVE'));
  const canAuthorizeHost = hasActivePolicy;
  elements['agent-launcher-show'].disabled = state.hostBindingSupport !== 'AVAILABLE' || !state.mcpLauncherConfig;
  const bindingSupport = state.hostBindingSupport === 'AVAILABLE'
    ? (canAuthorizeHost
      ? 'Start the local host, then authorize its waiting verification code here.'
      : policy?.mode === 'propose_draft'
        ? 'Draft host authorization uses the active isolated Checkpoint 4 task branch.'
        : 'Choose an active Agent access mode before authorizing a waiting host.')
    : 'MCP connections require the SQLite Studio store.';
  if (elements['agent-binding-support'].textContent !== bindingSupport) {
    elements['agent-binding-support'].textContent = bindingSupport;
  }

  const details = [];
  if (policy) {
    details.push(
      ['Mode', policy.mode?.replaceAll('_', ' ')],
      ['Task', policy.taskId],
      ['Branch', policy.branchId || 'none'],
      ['Scopes', policy.scopes?.join(', ') || 'none'],
      ['Objects', policy.objectScopes?.map((scope) => `${scope.kind}:${scope.id}`).join(', ') || 'none'],
      ['Expires', policy.expiresAt || 'not set'],
      ['Budget', policy.budget?.remaining
        ? `${policy.budget.remaining.commands}/${policy.budget.limits.maxCommands} commands remain`
        : policy.budget?.status?.replaceAll('_', ' ').toLowerCase() || 'not available'],
      ['Running jobs', policy.runningJobs ?? 0],
    );
  }
  const detailNodes = [];
  for (const [label, value] of details) {
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = String(value ?? '—');
    detailNodes.push(term, description);
  }
  elements['agent-access-details'].replaceChildren(...detailNodes);

  const warnings = (policy?.warnings ?? []).map((entry) => {
    const item = document.createElement('li');
    item.dataset.severity = entry.severity;
    item.textContent = entry.message;
    return item;
  });
  elements['agent-access-warnings'].replaceChildren(...warnings);

  const pendingNodes = state.pendingHosts.map((pending) => {
    const item = document.createElement('li');
    const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = `${pending.label} · ${pending.verificationCode}`;
    const detail = document.createElement('small'); detail.textContent = `waiting · expires ${pending.expiresAt}`;
    copy.append(name, detail); item.append(copy);
    const approve = document.createElement('button');
    approve.type = 'button'; approve.textContent = 'Authorize';
    approve.dataset.approvePendingHost = pending.pendingHostId;
    approve.dataset.verificationCode = pending.verificationCode;
    approve.disabled = !canAuthorizeHost;
    item.append(approve);
    return item;
  });
  const pendingFingerprint = JSON.stringify(state.pendingHosts.map((pending) => [
    pending.pendingHostId, pending.label, pending.verificationCode, pending.expiresAt, canAuthorizeHost,
  ]));
  if (elements['agent-pending-list'].dataset.renderFingerprint !== pendingFingerprint) {
    elements['agent-pending-list'].replaceChildren(...pendingNodes);
    elements['agent-pending-list'].dataset.renderFingerprint = pendingFingerprint;
  }
  elements['agent-pending-empty'].hidden = pendingNodes.length > 0;

  const bindingNodes = state.hostBindings.map((binding) => {
    const item = document.createElement('li');
    const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = binding.actor?.id || 'Agent';
    const detail = document.createElement('small');
    detail.textContent = `${binding.status.toLowerCase()} · ${binding.taskId} · ${binding.bindingId}`;
    copy.append(name, detail); item.append(copy);
    if (binding.status === 'ACTIVE') {
      const revoke = document.createElement('button');
      revoke.type = 'button'; revoke.className = 'secondary'; revoke.textContent = 'Revoke';
      revoke.dataset.revokeBinding = binding.bindingId;
      item.append(revoke);
    }
    return item;
  });
  const bindingFingerprint = JSON.stringify(state.hostBindings.map((binding) => [
    binding.bindingId, binding.actor?.id, binding.status, binding.taskId, binding.revokedAt,
  ]));
  if (elements['agent-binding-list'].dataset.renderFingerprint !== bindingFingerprint) {
    elements['agent-binding-list'].replaceChildren(...bindingNodes);
    elements['agent-binding-list'].dataset.renderFingerprint = bindingFingerprint;
  }
  elements['agent-binding-empty'].hidden = bindingNodes.length > 0;
  elements['agent-launcher-panel'].hidden = !state.showMcpLauncherConfig || !state.mcpLauncherConfig;
  elements['agent-launcher-config'].textContent = state.mcpLauncherConfig
    ? JSON.stringify(state.mcpLauncherConfig, null, 2)
    : '';
}

const previewStateLabels = {
  PROCESSING: 'Preview processing', MISSING: 'Preview missing',
  UNSUPPORTED: 'Unsupported media', LOAD_FAILED: 'Preview failed',
};

function previewFallback(asset, requestedState) {
  const previewState = previewStateLabels[requestedState] ? requestedState : 'MISSING';
  const wrapper = document.createElement('div');
  wrapper.className = 'asset-preview fallback';
  wrapper.dataset.previewState = previewState;
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', `${asset.kind} preview: ${previewStateLabels[previewState]}`);
  const glyph = document.createElement('span');
  glyph.className = 'preview-glyph'; glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = { surface: '▦', prop: '◆', item: '●' }[asset.kind] ?? '◇';
  const copy = document.createElement('span');
  const kind = document.createElement('small'); kind.textContent = asset.kind;
  const status = document.createElement('strong'); status.textContent = previewStateLabels[previewState];
  copy.append(kind, status); wrapper.append(glyph, copy);
  return wrapper;
}

function assetPreview(asset, { onLoadReady = null, onLoadFailure = null } = {}) {
  const preview = asset.preview;
  if (preview?.state !== 'READY' || !preview.resourceUri) return previewFallback(asset, preview?.state);
  const figure = document.createElement('figure');
  figure.className = 'asset-preview ready';
  figure.dataset.previewState = 'LOADING';
  const image = document.createElement('img');
  image.alt = preview.alt || `${asset.name} preview`;
  image.loading = visualFixture ? 'eager' : 'lazy'; image.decoding = 'async';
  let settled = false;
  image.addEventListener('load', () => {
    if (settled) return; settled = true; figure.dataset.previewState = 'READY'; onLoadReady?.();
  }, { once: true });
  image.addEventListener('error', () => {
    if (settled) return; settled = true;
    figure.replaceWith(previewFallback(asset, 'LOAD_FAILED'));
    onLoadFailure?.();
  }, { once: true });
  image.src = preview.resourceUri;
  queueMicrotask(() => {
    if (settled || !image.complete) return;
    if (image.naturalWidth > 0) { settled = true; figure.dataset.previewState = 'READY'; onLoadReady?.(); }
    else { settled = true; figure.replaceWith(previewFallback(asset, 'LOAD_FAILED')); onLoadFailure?.(); }
  });
  figure.append(image);
  return figure;
}

function currentAssetLibrary(snapshot = state.project?.snapshot) {
  return snapshot?.assetLibrary ?? { assets: [], proposals: [] };
}

function currentProjectSlices(snapshot = state.project?.snapshot) {
  const slices = [];
  for (const atlas of snapshot?.atlases ?? []) {
    for (const [index, slice] of (atlas.sliceHeads ?? []).entries()) {
      slices.push({ atlas, slice, ordinal: index + 1 });
    }
  }
  return slices;
}

function sliceDisplay(binding) {
  const match = currentProjectSlices().find(({ slice }) => (
    slice.sliceId === binding?.sliceId && slice.version === binding?.sliceVersion
  ));
  return {
    ordinal: match?.ordinal ?? null,
    label: match ? `Slice ${match.ordinal}` : 'Pinned historical slice',
    atlasName: match?.atlas.name ?? binding?.atlasId ?? 'Unknown atlas',
  };
}

function safeV2Preview(asset, options = {}) {
  const declared = asset?.preview;
  const digest = asset?.sliceBinding?.digest;
  const projectId = state.project?.projectId;
  const safeProjectPrefix = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/`
    : null;
  if (declared?.state === 'READY' && typeof declared.resourceUri === 'string'
      && safeProjectPrefix && declared.resourceUri.startsWith(safeProjectPrefix)
      && /^[a-f0-9]{64}$/.test(declared.resourceUri.slice(safeProjectPrefix.length))) {
    return assetPreview({ ...asset, preview: declared }, options);
  }
  if (safeProjectPrefix && /^[a-f0-9]{64}$/.test(digest ?? '')
      && asset?.sliceBinding?.mediaType === 'image/png') {
    return assetPreview({
      ...asset,
      preview: {
        state: 'READY',
        resourceUri: `${safeProjectPrefix}${digest}`,
        alt: `${asset.name} pinned slice preview`,
      },
    }, options);
  }
  return previewFallback(asset, declared?.state ?? (
    asset?.sliceBinding?.mediaType && asset.sliceBinding.mediaType !== 'image/png' ? 'UNSUPPORTED' : 'MISSING'
  ));
}

function markUsefulPreviewUnavailable(wrapper) {
  wrapper.dataset.previewReady = 'false';
  wrapper.dataset.previewStatus = 'UNAVAILABLE';
  if (!wrapper.querySelector('.asset-preview-warning')) {
    const warning = document.createElement('p'); warning.className = 'asset-preview-warning';
    warning.textContent = 'The exact image preview could not be loaded. Reload the project before accepting or placing this asset; inspection and rejection remain available.';
    wrapper.append(warning);
  }
  const proposal = wrapper.closest('[data-proposal-item]');
  const disposition = proposal?.querySelector('[data-proposal-disposition]');
  const acceptOption = disposition?.querySelector('option[value="ACCEPTED"]');
  if (acceptOption) acceptOption.disabled = true;
  if (disposition?.value === 'ACCEPTED') {
    disposition.value = 'REJECTED';
    disposition.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const use = wrapper.closest('.room-placement-preview')?.querySelector('[data-room-control="use-preview-asset"]');
  if (use) {
    use.disabled = true;
    use.title = 'Reload the exact image preview before placing this asset.';
  }
}

function markUsefulPreviewReady(wrapper) {
  wrapper.dataset.previewReady = 'true';
  wrapper.dataset.previewStatus = 'READY';
  wrapper.querySelector('.asset-preview-warning')?.remove();
  const acceptOption = wrapper.closest('[data-proposal-item]')?.querySelector('[data-proposal-disposition] option[value="ACCEPTED"]');
  if (acceptOption) acceptOption.disabled = false;
  const use = wrapper.closest('.room-placement-preview')?.querySelector('[data-room-control="use-preview-asset"]');
  if (use?.dataset.previewPlacementAllowed === 'true') {
    use.disabled = false;
    use.title = 'Arm this exact asset for placement on the canvas.';
  }
}

function rotatedPreviewGeometry(span, rotation) {
  const quarterTurns = ((rotation % 360) + 360) % 360 / 90;
  const dimensions = quarterTurns % 2 === 0
    ? { width: span.width, height: span.height }
    : { width: span.height, height: span.width };
  const rect = ({ x, y, width, height }) => {
    if (quarterTurns === 1) return { x: span.height - y - height, y: x, width: height, height: width };
    if (quarterTurns === 2) return { x: span.width - x - width, y: span.height - y - height, width, height };
    if (quarterTurns === 3) return { x: y, y: span.width - x - width, width: height, height: width };
    return { x, y, width, height };
  };
  const point = ({ x, y }) => {
    if (quarterTurns === 1) return { x: span.height - 1 - y, y: x };
    if (quarterTurns === 2) return { x: span.width - 1 - x, y: span.height - 1 - y };
    if (quarterTurns === 3) return { x: y, y: span.width - 1 - x };
    return { x, y };
  };
  return { ...dimensions, rect, point };
}

function usefulAssetPreview(asset, { previewKey = asset.assetId ?? asset.itemId ?? asset.name, compact = false } = {}) {
  const metadata = asset.metadata ?? {};
  const span = metadata.spanTiles ?? { width: 1, height: 1 };
  const rotationPolicy = metadata.rotationPolicy ?? 'fixed';
  const allowedRotations = rotationPolicy === 'cardinal' ? [0, 90, 180, 270] : [0];
  const selectedRotation = allowedRotations.includes(state.assetUi.previewRotations[previewKey])
    ? state.assetUi.previewRotations[previewKey] : 0;
  const geometry = rotatedPreviewGeometry(span, selectedRotation);
  const wrapper = document.createElement('section'); wrapper.className = `useful-asset-preview${compact ? ' compact' : ''}`;
  wrapper.dataset.previewKey = previewKey;
  const stage = document.createElement('div'); stage.className = 'prop-preview-stage';
  stage.style.setProperty('--preview-columns', String(geometry.width)); stage.style.setProperty('--preview-rows', String(geometry.height));
  stage.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
  const preview = safeV2Preview(asset, {
    onLoadReady: () => markUsefulPreviewReady(wrapper),
    onLoadFailure: () => markUsefulPreviewUnavailable(wrapper),
  });
  const canLoad = preview.classList.contains('ready');
  wrapper.dataset.previewReady = 'false';
  wrapper.dataset.previewStatus = canLoad ? 'LOADING' : 'UNAVAILABLE';
  preview.style.setProperty('--preview-rotation', `${selectedRotation}deg`); stage.append(preview);
  const grid = document.createElement('span'); grid.className = 'prop-preview-grid'; grid.setAttribute('aria-hidden', 'true'); stage.append(grid);
  const collision = metadata.collision;
  const rects = collision?.mode === 'bounds' && collision.bounds ? [collision.bounds]
    : collision?.mode === 'parts' ? collision.parts ?? [] : [];
  for (const authoredRect of rects) {
    const rect = geometry.rect(authoredRect);
    const overlay = document.createElement('span'); overlay.className = 'prop-collision-overlay';
    overlay.style.left = `${(rect.x / geometry.width) * 100}%`; overlay.style.top = `${(rect.y / geometry.height) * 100}%`;
    overlay.style.width = `${(rect.width / geometry.width) * 100}%`; overlay.style.height = `${(rect.height / geometry.height) * 100}%`; stage.append(overlay);
  }
  const anchor = geometry.point(metadata.anchor ?? { x: 0, y: 0 });
  const topLeft = document.createElement('span'); topLeft.className = 'prop-top-left-marker'; topLeft.textContent = '□';
  topLeft.setAttribute('aria-label', 'Placement top-left at 0, 0'); stage.append(topLeft);
  const marker = document.createElement('span'); marker.className = 'prop-anchor-marker'; marker.textContent = '+';
  marker.style.left = `${((anchor.x + 0.5) / geometry.width) * 100}%`; marker.style.top = `${((anchor.y + 0.5) / geometry.height) * 100}%`;
  marker.setAttribute('aria-label', `Anchor at ${anchor.x}, ${anchor.y} after ${selectedRotation} degree rotation`); stage.append(marker); wrapper.append(stage);
  const facts = document.createElement('ul'); facts.className = 'prop-preview-facts';
  const values = [
    `Occupies ${geometry.width} × ${geometry.height} cells at ${selectedRotation}°`,
    rotationPolicy === 'cardinal' ? 'Can be rotated in four directions' : 'Uses one fixed direction',
    metadata.navigation?.effect === 'blocked' || collision?.mode && collision.mode !== 'none' ? 'Blocks movement' : 'Can be crossed',
    metadata.attachment === 'wall' ? 'Designed for wall placement' : metadata.placement?.wallSafe === false ? 'Keep away from room boundaries' : 'Suitable for ground placement',
    `Top-left is □ at 0,0; authored anchor is + at ${anchor.x},${anchor.y}`,
  ];
  for (const value of values) { const item = document.createElement('li'); item.textContent = value; facts.append(item); }
  wrapper.append(facts);
  if (allowedRotations.length > 1 && !compact) {
    const controls = document.createElement('div'); controls.className = 'prop-preview-rotations'; controls.setAttribute('aria-label', 'Preview rotation');
    for (const rotation of allowedRotations) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.dataset.assetPreviewRotation = String(rotation); button.dataset.previewKey = previewKey;
      button.dataset.selected = String(rotation === selectedRotation); button.textContent = `${rotation}°`; controls.append(button);
    }
    wrapper.append(controls);
  }
  if (!canLoad) {
    const warning = document.createElement('p'); warning.className = 'asset-preview-warning';
    warning.textContent = 'The exact image preview is unavailable. Reload the project before accepting or placing this asset; inspection and rejection remain available.'; wrapper.append(warning);
  }
  return wrapper;
}

function compactValues(values, empty = 'none') {
  return Array.isArray(values) && values.length ? values.join(', ') : empty;
}

function placementSummary(metadata = {}) {
  const placement = metadata.placement ?? {};
  const confirmation = placement.confirmation ?? 'missing';
  const modes = compactValues(placement.modes);
  const wall = placement.wallSafe === null || placement.wallSafe === undefined
    ? 'wall safety missing'
    : placement.wallSafe ? 'wall-safe' : 'not wall-safe';
  return `${confirmation} · ${modes} · ${wall}`;
}

function connectivitySummary(metadata = {}) {
  const connectors = metadata.connectors ?? [];
  if (!connectors.length) return `none · ${metadata.continuityProfile ?? 'no profile'}`;
  return `${connectors.map(({ edge }) => edge).join(', ')} · ${metadata.continuityProfile ?? 'profile missing'}`;
}

function collisionSummary(metadata = {}) {
  const collision = metadata.collision;
  if (!collision) return 'missing';
  if (collision.mode === 'parts') return `${collision.parts?.length ?? 0} bounded parts`;
  return collision.mode;
}

function findingSummary(findings = []) {
  const counts = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return findings.length
    ? `${counts.ERROR} errors · ${counts.WARNING} warnings · ${counts.INFO} info`
    : 'Clear';
}

function copyableCanonical(label, value, focusKey) {
  const wrapper = document.createElement('div'); wrapper.className = 'canonical-copy';
  const copy = document.createElement('span');
  const caption = document.createElement('small'); caption.textContent = label;
  const code = document.createElement('code'); code.textContent = value ?? '—';
  copy.append(caption, code); wrapper.append(copy);
  if (value) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'secondary'; button.textContent = 'Copy';
    button.dataset.copyCanonical = value; button.dataset.assetFocusKey = focusKey;
    button.setAttribute('aria-label', `Copy ${label} ${value}`);
    wrapper.append(button);
  }
  return wrapper;
}

function findingsList(findings = []) {
  const list = document.createElement('ul'); list.className = 'asset-findings';
  if (!findings.length) {
    const item = document.createElement('li'); item.className = 'clear'; item.textContent = 'No current findings.';
    list.append(item); return list;
  }
  for (const finding of findings) {
    const item = document.createElement('li'); item.dataset.severity = finding.severity;
    const heading = document.createElement('strong');
    heading.textContent = `${finding.severity} · ${finding.ruleId}`;
    const path = document.createElement('code'); path.textContent = finding.path;
    const explanation = document.createElement('span'); explanation.textContent = finding.explanation;
    const remediation = document.createElement('small'); remediation.textContent = finding.remediation;
    item.append(heading, path, explanation, remediation); list.append(item);
  }
  return list;
}

function captureAssetDomState() {
  if (state.workspace !== 'assets') return;
  const active = document.activeElement?.closest?.('[data-asset-focus-key]');
  const scroll = {};
  for (const element of elements['workspace-content'].querySelectorAll('[data-asset-scroll]')) {
    scroll[element.dataset.assetScroll] = { left: element.scrollLeft, top: element.scrollTop };
  }
  state.assetUi.domState = {
    context: `${state.project?.projectId ?? 'none'}:${state.assetUi.selectedProposalId ?? 'none'}`,
    activeKey: active?.dataset.assetFocusKey ?? null,
    selectionStart: Number.isInteger(active?.selectionStart) ? active.selectionStart : null,
    selectionEnd: Number.isInteger(active?.selectionEnd) ? active.selectionEnd : null,
    scroll,
    page: { x: window.scrollX, y: window.scrollY },
  };
}

function restoreAssetDomState() {
  const saved = state.assetUi.domState;
  if (!saved || saved.context !== `${state.project?.projectId ?? 'none'}:${state.assetUi.selectedProposalId ?? 'none'}`) return;
  for (const element of elements['workspace-content'].querySelectorAll('[data-asset-scroll]')) {
    const position = saved.scroll[element.dataset.assetScroll];
    if (!position) continue;
    element.scrollLeft = Math.max(0, Math.min(position.left, element.scrollWidth - element.clientWidth));
    element.scrollTop = Math.max(0, Math.min(position.top, element.scrollHeight - element.clientHeight));
  }
  const active = saved.activeKey
    ? [...elements['workspace-content'].querySelectorAll('[data-asset-focus-key]')]
      .find((candidate) => candidate.dataset.assetFocusKey === saved.activeKey)
    : null;
  active?.focus({ preventScroll: true });
  if (active && saved.selectionStart !== null && typeof active.setSelectionRange === 'function') {
    active.setSelectionRange(saved.selectionStart, saved.selectionEnd);
  }
  window.scrollTo(saved.page.x, saved.page.y);
}

function captureRoomDomState() {
  if (state.workspace !== 'rooms') return;
  const active = document.activeElement?.closest?.('[data-room-focus-key], [data-room-control]');
  const scroll = {};
  for (const element of elements['workspace-content'].querySelectorAll('[data-room-scroll]')) {
    scroll[element.dataset.roomScroll] = { left: element.scrollLeft, top: element.scrollTop };
  }
  state.roomUi.domState = {
    context: `${state.project?.projectId ?? 'none'}:${state.roomUi.selectedRoomVariantId ?? 'none'}:${state.roomUi.selectedProposalId ?? 'none'}`,
    activeKey: active?.dataset.roomFocusKey ?? active?.dataset.roomControl ?? null,
    selectionStart: Number.isInteger(active?.selectionStart) ? active.selectionStart : null,
    selectionEnd: Number.isInteger(active?.selectionEnd) ? active.selectionEnd : null,
    scroll,
    page: { x: window.scrollX, y: window.scrollY },
  };
}

function restoreRoomDomState() {
  const saved = state.roomUi.domState;
  if (!saved || saved.context !== `${state.project?.projectId ?? 'none'}:${state.roomUi.selectedRoomVariantId ?? 'none'}:${state.roomUi.selectedProposalId ?? 'none'}`) return;
  for (const element of elements['workspace-content'].querySelectorAll('[data-room-scroll]')) {
    const position = saved.scroll[element.dataset.roomScroll]; if (!position) continue;
    element.scrollLeft = Math.max(0, Math.min(position.left, element.scrollWidth - element.clientWidth));
    element.scrollTop = Math.max(0, Math.min(position.top, element.scrollHeight - element.clientHeight));
  }
  const active = [...elements['workspace-content'].querySelectorAll('[data-room-focus-key], [data-room-control]')]
    .find((candidate) => (candidate.dataset.roomFocusKey ?? candidate.dataset.roomControl) === saved.activeKey);
  active?.focus({ preventScroll: true });
  if (active && saved.selectionStart !== null && typeof active.setSelectionRange === 'function') active.setSelectionRange(saved.selectionStart, saved.selectionEnd);
  window.scrollTo(saved.page.x, saved.page.y);
}

function settleRoomEditorControlFocus(focusKey) {
  const generation = ++roomEditorFocusGeneration;
  const focusSelectedControl = ({ repair = false } = {}) => {
    if (generation !== roomEditorFocusGeneration) return;
    const focused = document.activeElement;
    const focusedKey = focused?.closest?.('[data-room-focus-key]')?.dataset.roomFocusKey ?? null;
    const focusIsNeutral = !focused || !focused.isConnected || focused === document.body
      || focused === document.documentElement || focused === elements['workspace-content'];
    if (repair && !focusIsNeutral && focusedKey !== focusKey) return;
    const active = [...elements['workspace-content'].querySelectorAll('[data-room-focus-key]')]
      .find((candidate) => candidate.dataset.roomFocusKey === focusKey && candidate.dataset.selected === 'true');
    active?.focus({ preventScroll: true });
  };
  focusSelectedControl();
  requestAnimationFrame(() => requestAnimationFrame(() => focusSelectedControl({ repair: true })));
}

function sourcePreview(source) {
  const preview = source.preview;
  if (preview?.state !== 'READY' || !preview.resourceUri) {
    const fallback = document.createElement('div');
    fallback.className = 'source-preview fallback';
    fallback.dataset.previewState = preview?.state ?? 'MISSING';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', preview?.alt ?? `${source.name} source preview unavailable`);
    const label = document.createElement('strong');
    label.textContent = preview?.state === 'UNSUPPORTED' ? 'Unsupported source media' : 'Original source unavailable';
    fallback.append(label);
    return fallback;
  }
  const figure = document.createElement('figure');
  figure.className = 'source-preview-frame';
  const link = document.createElement('a');
  link.className = 'source-preview ready';
  link.dataset.previewState = 'READY';
  link.href = preview.resourceUri;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.setAttribute('aria-label', `Open ${source.name} original source image in a new tab`);
  const caption = document.createElement('figcaption');
  caption.id = `source-preview-hint-${source.id}`;
  caption.textContent = 'Open original in new tab ↗';
  link.setAttribute('aria-describedby', caption.id);
  const image = document.createElement('img');
  image.src = preview.resourceUri;
  image.alt = preview.alt || `${source.name} original source preview`;
  image.loading = visualFixture ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    const failed = document.createElement('div');
    failed.className = 'source-preview fallback';
    failed.dataset.previewState = 'LOAD_FAILED';
    failed.setAttribute('role', 'img');
    failed.setAttribute('aria-label', `${source.name} original source preview failed to load`);
    const label = document.createElement('strong'); label.textContent = 'Original source failed to load';
    failed.append(label); figure.replaceWith(failed);
  }, { once: true });
  link.append(image); figure.append(link, caption);
  return figure;
}

function card(title, tag, body, properties = []) {
  const article = document.createElement('article');
  article.className = 'card';
  const tagElement = document.createElement('span');
  tagElement.className = 'tag';
  tagElement.textContent = tag;
  const heading = document.createElement('h3');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = body;
  article.append(tagElement, heading, paragraph);
  if (properties.length) {
    const list = document.createElement('dl');
    list.className = 'property-list';
    for (const [label, value] of properties) {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = String(value ?? '—');
      list.append(term, description);
    }
    article.append(list);
  }
  return article;
}

function emptyState(title, body) {
  const section = document.createElement('section');
  section.className = 'empty';
  const wrapper = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const text = document.createElement('span');
  text.textContent = body;
  wrapper.append(strong, text);
  section.append(wrapper);
  return section;
}

function sectionHeading(title, description) {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-heading';
  const copy = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = description;
  copy.append(heading, paragraph);
  wrapper.append(copy);
  return wrapper;
}

function labeledField(labelText, input) {
  const label = document.createElement('label');
  const copy = document.createElement('span'); copy.textContent = labelText;
  label.append(copy, input);
  return label;
}

function sourceIntakePanel() {
  const stagedIntake = state.sourceIntakes.find((intake) => (
    intake.state === 'STAGED' && intake.intakeId === state.resumingIntakeId
  ));
  const context = `${state.project?.projectId ?? 'none'}:${stagedIntake?.intakeId ?? 'new'}`;
  if (sourceIntakeFormCache && sourceIntakeFormContext === context) {
    const submit = sourceIntakeFormCache.querySelector('button[type="submit"]');
    submit.textContent = state.sourceMutationPending ? 'Importing…' : 'Import source';
    if (!submit.hasAttribute('data-source-pending-was-disabled')) submit.disabled = !state.agentAccessCsrf;
    setSourceIntakeFormPending(sourceIntakeFormCache, state.sourceMutationPending);
    return sourceIntakeFormCache;
  }
  const draft = state.sourceDraft ?? {};
  const form = document.createElement('form');
  form.className = 'source-intake-form';
  form.dataset.sourceIntakeForm = '';
  const heading = document.createElement('div');
  const title = document.createElement('h2'); title.textContent = stagedIntake ? 'Resume staged source' : 'Import source';
  const help = document.createElement('p');
  help.textContent = 'The original PNG or WebP is stored safely in this project before it is added as a source. Importing it does not contact an image provider or approve the image.';
  heading.append(title, help);

  const file = document.createElement('input');
  file.type = 'file'; file.name = 'file'; file.accept = 'image/png,image/webp'; file.required = !stagedIntake;
  file.dataset.sourceFile = '';
  file.disabled = Boolean(stagedIntake);
  const sourceId = document.createElement('input');
  sourceId.name = 'sourceId'; sourceId.required = true; sourceId.maxLength = 128; sourceId.placeholder = 'source.family-hygiene-floor';
  sourceId.pattern = '[A-Za-z0-9][A-Za-z0-9._:\\-]{0,127}';
  sourceId.value = draft.sourceId ?? '';
  const name = document.createElement('input');
  name.name = 'name'; name.required = true; name.maxLength = 160; name.placeholder = 'Family Hygiene floor atlas';
  name.value = draft.name ?? '';
  const origin = document.createElement('select'); origin.name = 'origin';
  for (const [value, label] of [['human_upload', 'Human upload'], ['imported_generation', 'Imported generation record']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; origin.append(option);
  }
  origin.value = stagedIntake?.origin ?? draft.origin ?? 'human_upload';
  origin.disabled = Boolean(stagedIntake);
  const prompt = document.createElement('textarea'); prompt.name = 'prompt'; prompt.maxLength = 20000; prompt.rows = 3;
  prompt.value = draft.prompt ?? '';
  const provider = document.createElement('input'); provider.name = 'provider'; provider.maxLength = 500; provider.placeholder = 'Optional provider record';
  provider.value = draft.provider ?? '';
  const model = document.createElement('input'); model.name = 'model'; model.maxLength = 500; model.placeholder = 'Optional model';
  model.value = draft.model ?? '';
  const modelVersion = document.createElement('input'); modelVersion.name = 'modelVersion'; modelVersion.maxLength = 500; modelVersion.placeholder = 'Optional model version';
  modelVersion.value = draft.modelVersion ?? '';
  const fields = document.createElement('div'); fields.className = 'source-intake-fields';
  fields.append(
    labeledField('Source image', file), labeledField('Stable source ID', sourceId),
    labeledField('Display name', name), labeledField('Origin', origin),
    labeledField('Prompt / source note', prompt), labeledField('Provider', provider),
    labeledField('Model', model), labeledField('Model version', modelVersion),
  );
  const submit = document.createElement('button');
  submit.type = 'submit'; submit.textContent = state.sourceMutationPending ? 'Importing…' : 'Import source';
  submit.disabled = !state.agentAccessCsrf;
  const status = document.createElement('p');
  status.dataset.sourceStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.textContent = stagedIntake ? `Ready to commit staged intake ${stagedIntake.intakeId}.` : '';
  form.append(heading, fields, status, submit);
  sourceIntakeFormCache = form;
  sourceIntakeFormContext = context;
  setSourceIntakeFormPending(form, state.sourceMutationPending);
  return form;
}

function stagedSourceIntakes() {
  const staged = state.sourceIntakes.filter((intake) => intake.state === 'STAGED');
  if (!staged.length) return null;
  const section = document.createElement('section'); section.className = 'staged-source-intakes';
  section.append(sectionHeading('Staged source intakes', 'Resume a durable intake or explicitly discard it. Staged references remain protected until one of these actions succeeds.'));
  const list = document.createElement('ul');
  for (const intake of staged) {
    const item = document.createElement('li');
    const copy = document.createElement('span');
    copy.textContent = `${intake.intakeId} · ${intake.origin} · ${intake.intake.artifact.width}×${intake.intake.artifact.height}`;
    const resume = document.createElement('button');
    resume.type = 'button'; resume.className = 'secondary'; resume.textContent = 'Resume'; resume.dataset.resumeSourceIntake = intake.intakeId;
    resume.disabled = state.sourceMutationPending;
    const discard = document.createElement('button');
    discard.type = 'button'; discard.className = 'secondary'; discard.textContent = 'Discard'; discard.dataset.discardSourceIntake = intake.intakeId;
    discard.disabled = state.sourceMutationPending;
    item.append(copy, resume, discard); list.append(item);
  }
  section.append(list);
  return section;
}

function cutterNumber(name, value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const input = document.createElement('input');
  input.type = 'number'; input.name = name; input.value = String(value); input.min = String(min); input.max = String(max); input.step = '1';
  return input;
}

function currentCutterAtlas() {
  if (!state.project || !state.cutter || state.project.projectId !== state.cutter.projectId) return null;
  return (state.project?.snapshot.atlases ?? []).find((atlas) => (
    atlas.id === state.cutter.atlasId && atlas.sourceId === state.cutter.sourceId
  )) ?? null;
}

function cutterScrollContext() {
  if (!state.project || !state.cutter || state.project.projectId !== state.cutter.projectId) return null;
  return JSON.stringify([
    state.cutter.projectId,
    state.cutter.sourceId,
    state.cutter.atlasId,
    state.cutter.instanceId,
    state.cutter.zoom,
  ]);
}

function cutterBinding(jobId = null) {
  const cutter = state.cutter;
  if (!state.project || !cutter || state.project.projectId !== cutter.projectId) return null;
  return {
    projectId: cutter.projectId,
    sourceId: cutter.sourceId,
    atlasId: cutter.atlasId,
    instanceId: cutter.instanceId,
    jobId,
    context: JSON.stringify([
      cutter.projectId, cutter.sourceId, cutter.atlasId, cutter.instanceId, jobId,
    ]),
  };
}

function cutterBindingIsCurrent(binding) {
  return Boolean(binding
    && state.project?.projectId === binding.projectId
    && state.cutter?.projectId === binding.projectId
    && state.cutter?.sourceId === binding.sourceId
    && state.cutter?.atlasId === binding.atlasId
    && state.cutter?.instanceId === binding.instanceId);
}

function cancelCutterJobPolling() {
  cutterJobPollController.abortController?.abort();
  if (cutterJobPollController.timer !== null) clearTimeout(cutterJobPollController.timer);
  cutterJobPollController = {
    generation: cutterJobPollController.generation + 1,
    context: null,
    timer: null,
    inFlight: null,
    abortController: null,
  };
}

function scheduleCutterJobPoll(binding, delay) {
  if (!cutterBindingIsCurrent(binding)
      || cutterJobPollController.context !== binding.context) return;
  if (cutterJobPollController.timer !== null) clearTimeout(cutterJobPollController.timer);
  const generation = cutterJobPollController.generation;
  cutterJobPollController.timer = setTimeout(() => {
    if (cutterJobPollController.generation !== generation
        || cutterJobPollController.context !== binding.context
        || !cutterBindingIsCurrent(binding)) return;
    cutterJobPollController.timer = null;
    void loadCutterJob(binding.jobId);
  }, delay);
}

function clearCutterDrag() {
  const drag = cutterDrag;
  cutterDrag = null;
  state.cutterDeferredRender = false;
  if (drag?.target?.hasPointerCapture?.(drag.pointerId)) {
    try { drag.target.releasePointerCapture(drag.pointerId); } catch {}
  }
}

function settleCutterDrag() {
  if (!cutterDrag) return;
  const shouldRender = cutterDrag.changed || state.cutterDeferredRender;
  clearCutterDrag();
  if (shouldRender) renderWorkspace();
}

function resetCutterScroll() {
  clearCutterDrag();
  state.cutterScroll = null;
  state.cutterScrollResetPending = true;
  state.cutterDomDraft = null;
}

function captureCutterScroll() {
  if (state.cutterScrollResetPending) return;
  const scroller = elements['workspace-content'].querySelector('[data-cutter-scroll-context]');
  const context = scroller?.dataset.cutterScrollContext;
  if (!context || context !== cutterScrollContext()) return;
  state.cutterScroll = {
    context,
    left: scroller.scrollLeft,
    top: scroller.scrollTop,
  };
}

function cutterControlKey(control) {
  if (control.matches('[data-cutter-grid-form] [name]')) return `grid:${control.name}`;
  if (control.hasAttribute('data-rectangle-index') && control.hasAttribute('data-rectangle-field')) {
    return `rectangle:${control.dataset.rectangleIndex}:${control.dataset.rectangleField}`;
  }
  if (control.hasAttribute('data-cutter-zoom')) return 'zoom';
  if (control.hasAttribute('data-cutter-grid-toggle')) return 'grid-toggle';
  if (control.hasAttribute('data-cutter-move')) return `move:${control.dataset.cutterMove}`;
  if (control.hasAttribute('data-cutter-resize')) return `resize:${control.dataset.cutterResize}`;
  return null;
}

function cutterModelFingerprint() {
  if (!state.cutter) return null;
  return JSON.stringify({
    grid: state.cutter.grid,
    rectangles: state.cutter.rectangles,
  });
}

function captureCutterDomDraft() {
  if (state.cutterScrollResetPending) return;
  const cutter = elements['workspace-content'].querySelector('[data-atlas-cutter]');
  const context = cutterScrollContext();
  if (!cutter || !context || cutter.dataset.cutterModelFingerprint !== cutterModelFingerprint()) {
    state.cutterDomDraft = null;
    return;
  }
  const controls = [...cutter.querySelectorAll('input, select, textarea')]
    .map((control) => ({
      key: cutterControlKey(control),
      value: control.value,
      checked: control instanceof HTMLInputElement ? control.checked : null,
    }))
    .filter(({ key }) => key !== null);
  const activeKey = cutter.contains(document.activeElement)
    ? cutterControlKey(document.activeElement)
    : null;
  state.cutterDomDraft = { context, controls, activeKey };
}

function restoreCutterScroll() {
  const scroller = elements['workspace-content'].querySelector('[data-cutter-scroll-context]');
  const context = scroller?.dataset.cutterScrollContext;
  if (!context) return;
  if (state.cutterScrollResetPending) {
    state.cutterScroll = { context, left: 0, top: 0 };
    state.cutterScrollResetPending = false;
    return;
  }
  if (state.cutterScroll?.context !== context) {
    state.cutterScroll = { context, left: 0, top: 0 };
    return;
  }
  scroller.scrollLeft = Math.max(0, Math.min(
    state.cutterScroll.left, scroller.scrollWidth - scroller.clientWidth,
  ));
  scroller.scrollTop = Math.max(0, Math.min(
    state.cutterScroll.top, scroller.scrollHeight - scroller.clientHeight,
  ));
}

function restoreCutterDomDraft() {
  const draft = state.cutterDomDraft;
  const cutter = elements['workspace-content'].querySelector('[data-atlas-cutter]');
  if (!draft || !cutter || draft.context !== cutterScrollContext()) {
    state.cutterDomDraft = null;
    return;
  }
  const controls = [...cutter.querySelectorAll('input, select, textarea, [data-cutter-move], [data-cutter-resize]')];
  const byKey = new Map(controls.map((control) => [cutterControlKey(control), control]));
  for (const saved of draft.controls) {
    const control = byKey.get(saved.key);
    if (!control || control.disabled) continue;
    if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
      control.checked = saved.checked;
    } else control.value = saved.value;
  }
  const active = byKey.get(draft.activeKey);
  active?.focus({ preventScroll: true });
  state.cutterDomDraft = null;
}

function openCutter(source) {
  const existing = (state.project?.snapshot.atlases ?? []).find((atlas) => atlas.sourceId === source.id) ?? null;
  const familyDefaults = source.width === 1254 && source.height === 1254;
  cancelCutterJobPolling();
  resetCutterScroll();
  state.cutter = {
    projectId: state.project.projectId,
    sourceId: source.id,
    atlasId: existing?.id ?? `atlas.${source.id}`.slice(0, 128),
    instanceId: crypto.randomUUID(),
    name: existing?.name ?? `${source.name} cuts`,
    zoom: 'fit',
    showGrid: true,
    dirty: false,
    syncedVersion: existing?.definitionVersion ?? 0,
    rectangles: structuredClone(existing?.rectangles ?? []),
    grid: {
      rows: 2, columns: 2,
      top: familyDefaults ? 3 : 0, right: familyDefaults ? 3 : 0,
      bottom: familyDefaults ? 3 : 0, left: familyDefaults ? 3 : 0,
      gapX: familyDefaults ? 4 : 0, gapY: familyDefaults ? 4 : 0,
    },
    operations: { define: null, preview: null, commit: null, cancel: null, retry: null, discard: null },
  };
  state.cutterJob = null;
  state.cutterJobEvents = [];
  if (existing?.latestPreviewJobId) void loadCutterJob(existing.latestPreviewJobId);
  renderWorkspace();
}

async function loadCutterJob(jobId, { throwOnError = false } = {}) {
  const binding = cutterBinding(jobId);
  if (!binding || !jobId) return false;
  if (cutterJobPollController.context !== binding.context) {
    cancelCutterJobPolling();
    cutterJobPollController.context = binding.context;
  }
  if (cutterJobPollController.timer !== null) {
    clearTimeout(cutterJobPollController.timer);
    cutterJobPollController.timer = null;
  }
  if (!cutterJobPollController.inFlight) {
    const generation = cutterJobPollController.generation;
    const abortController = new AbortController();
    cutterJobPollController.abortController = abortController;
    cutterJobPollController.inFlight = (async () => {
      try {
        const response = await api(
          `/api/projects/${encodeURIComponent(binding.projectId)}/jobs/${encodeURIComponent(jobId)}`,
          { signal: abortController.signal },
        );
        if (cutterJobPollController.generation !== generation
            || cutterJobPollController.context !== binding.context
            || !cutterBindingIsCurrent(binding)) return false;
        if (response.projectId !== binding.projectId || response.job?.atlasId !== binding.atlasId
            || response.job?.sourceId !== binding.sourceId || response.job?.jobId !== jobId) {
          cancelCutterJobPolling();
          return false;
        }
        const currentAtlas = currentCutterAtlas();
        if (currentAtlas?.sourceId !== binding.sourceId || currentAtlas?.latestPreviewJobId !== jobId) {
          cancelCutterJobPolling();
          return false;
        }
        const priorRenderFingerprint = JSON.stringify({
          job: state.cutterJob,
          events: state.cutterJobEvents,
          operations: state.cutter.operations,
        });
        state.cutterJob = response.job;
        state.cutterJobEvents = response.events ?? [];
        const operations = state.cutter.operations;
        if (operations.preview?.jobId === jobId) operations.preview = null;
        if (operations.commit?.jobId === jobId && response.job.state === 'APPLIED') operations.commit = null;
        if (operations.cancel && (response.job.cancelRequested || response.job.state === 'CANCELLED')) operations.cancel = null;
        if (operations.retry && response.job.attempt > operations.retry.expectedAttempt) operations.retry = null;
        if (operations.discard && response.job.state === 'DISCARDED') operations.discard = null;
        const nextRenderFingerprint = JSON.stringify({
          job: state.cutterJob,
          events: state.cutterJobEvents,
          operations: state.cutter.operations,
        });
        if (priorRenderFingerprint !== nextRenderFingerprint) {
          renderWorkspace({ preserveCutterDraft: true });
        }
        if (['QUEUED', 'RUNNING'].includes(response.job.state)) scheduleCutterJobPoll(binding, 300);
        else cancelCutterJobPolling();
        return true;
      } catch (error) {
        if (cutterJobPollController.generation === generation
            && cutterJobPollController.context === binding.context
            && cutterBindingIsCurrent(binding)) {
          if (error.name !== 'AbortError') showToast(`${error.code || 'ERROR'}: ${error.message}`);
          const currentAtlas = currentCutterAtlas();
          const retryableCurrentJob = currentAtlas?.latestPreviewJobId === jobId
            && (!state.cutterJob || (state.cutterJob.jobId === jobId
              && ['QUEUED', 'RUNNING'].includes(state.cutterJob.state)));
          if (error.name !== 'AbortError' && retryableCurrentJob) {
            scheduleCutterJobPoll(binding, 1000);
          }
        }
        throw error;
      }
    })();
    cutterJobPollController.inFlight.finally(() => {
      if (cutterJobPollController.generation === generation
          && cutterJobPollController.context === binding.context) {
        cutterJobPollController.inFlight = null;
        cutterJobPollController.abortController = null;
      }
    }).catch(() => {});
  }
  try {
    return await cutterJobPollController.inFlight;
  } catch (error) {
    if (throwOnError) throw error;
    return false;
  }
}

function invalidateCutterOperations() {
  if (state.cutter) state.cutter.operations = {
    define: null, preview: null, commit: null, cancel: null, retry: null, discard: null,
  };
}

function markCutterDefinitionDirty() {
  if (!state.cutter) return;
  const { cancel, retry, discard } = state.cutter.operations;
  state.cutter.dirty = true;
  state.cutter.operations = {
    define: null, preview: null, commit: null, cancel, retry, discard,
  };
}

function cutterPreviewCard(output, index, projectId) {
  const figure = document.createElement('figure'); figure.className = 'slice-preview';
  const image = document.createElement('img');
  image.src = output.preview?.resourceUri ?? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${output.digest}`;
  image.alt = output.preview?.alt ?? `Slice preview ${output.rectangleId}`;
  image.loading = visualFixture ? 'eager' : 'lazy'; image.decoding = 'async';
  const caption = document.createElement('figcaption');
  caption.textContent = `${index + 1} · ${output.rectangleId} · ${output.width}×${output.height}`;
  figure.append(image, caption); return figure;
}

function renderCutter(source) {
  const cutter = state.cutter;
  const atlas = currentCutterAtlas();
  const section = document.createElement('section'); section.className = 'atlas-cutter'; section.dataset.atlasCutter = '';
  section.dataset.cutterModelFingerprint = cutterModelFingerprint();
  section.inert = state.sourceMutationPending;
  const heading = document.createElement('div'); heading.className = 'cutter-heading';
  const copy = document.createElement('div');
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Cut image into reusable slices';
  const title = document.createElement('h2'); title.textContent = cutter.name;
  const help = document.createElement('p');
  help.textContent = 'Mark the exact rectangular areas you want to use. Preview creates matching PNG slices without resizing them, changing their edges, deciding their gameplay purpose, or adding them to the Asset Library.';
  copy.append(eyebrow, title, help);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'secondary'; close.textContent = 'Close cutter'; close.dataset.closeCutter = '';
  close.disabled = state.cutterPending;
  heading.append(copy, close); section.append(heading);

  const gridForm = document.createElement('form'); gridForm.className = 'cutter-grid-form'; gridForm.dataset.cutterGridForm = '';
  const gridFields = document.createElement('div'); gridFields.className = 'cutter-grid-fields';
  for (const [name, label, value] of [
    ['rows', 'Rows', cutter.grid.rows], ['columns', 'Columns', cutter.grid.columns],
    ['top', 'Top margin', cutter.grid.top], ['right', 'Right margin', cutter.grid.right],
    ['bottom', 'Bottom margin', cutter.grid.bottom], ['left', 'Left margin', cutter.grid.left],
    ['gapX', 'X gap', cutter.grid.gapX], ['gapY', 'Y gap', cutter.grid.gapY],
  ]) {
    const input = cutterNumber(name, value, { min: name === 'rows' || name === 'columns' ? 1 : 0, max: 4096 });
    input.disabled = state.cutterPending;
    gridFields.append(labeledField(label, input));
  }
  const propose = document.createElement('button'); propose.type = 'submit'; propose.textContent = 'Propose regular grid'; propose.disabled = state.cutterPending;
  const proposalNote = document.createElement('p'); proposalNote.className = 'cutter-note';
  proposalNote.textContent = 'Arithmetic proposal only. Nothing becomes authoritative until you save the explicit rectangle list below.';
  gridForm.append(gridFields, propose, proposalNote); section.append(gridForm);

  const toolbar = document.createElement('div'); toolbar.className = 'cutter-toolbar';
  const zoom = document.createElement('select'); zoom.dataset.cutterZoom = '';
  for (const [value, label] of [['fit', 'Fit'], ['1', '100%'], ['2', '200%']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; zoom.append(option);
  }
  zoom.value = cutter.zoom;
  const gridToggle = document.createElement('input'); gridToggle.type = 'checkbox'; gridToggle.checked = cutter.showGrid; gridToggle.dataset.cutterGridToggle = '';
  toolbar.append(labeledField('Zoom', zoom), labeledField('Visual grid', gridToggle));
  const sourceMeta = document.createElement('span'); sourceMeta.textContent = `${source.width}×${source.height} · approved PNG · ${source.artifactUri.slice(-12)}`;
  toolbar.append(sourceMeta); section.append(toolbar);

  const scroller = document.createElement('div'); scroller.className = 'cutter-scroll';
  scroller.dataset.cutterScrollContext = cutterScrollContext();
  const canvas = document.createElement('div'); canvas.className = `cutter-canvas ${cutter.showGrid ? 'show-grid' : ''}`;
  canvas.dataset.zoom = cutter.zoom;
  if (cutter.zoom !== 'fit') canvas.style.width = `${source.width * Number(cutter.zoom)}px`;
  canvas.style.aspectRatio = `${source.width} / ${source.height}`;
  const image = document.createElement('img'); image.src = source.preview.resourceUri; image.alt = `${source.name} cutter source`; image.draggable = false;
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('viewBox', `0 0 ${source.width} ${source.height}`); overlay.dataset.cutterOverlay = '';
  overlay.setAttribute('aria-label', 'Atlas rectangle overlay');
  for (const [index, rectangle] of cutter.rectangles.entries()) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.rectangleId = rectangle.rectangleId; group.classList.toggle('excluded', !rectangle.included);
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [name, value] of Object.entries({ x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height })) shape.setAttribute(name, String(value));
    shape.setAttribute('tabindex', state.cutterPending ? '-1' : '0'); shape.setAttribute('role', 'button');
    shape.setAttribute('aria-disabled', String(state.cutterPending));
    shape.setAttribute('aria-label', `${rectangle.rectangleId}: x ${rectangle.x}, y ${rectangle.y}, width ${rectangle.width}, height ${rectangle.height}${rectangle.included ? '' : ', excluded'}`);
    shape.dataset.cutterMove = String(index);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(rectangle.x + 10)); label.setAttribute('y', String(rectangle.y + 24)); label.textContent = String(index + 1);
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    handle.setAttribute('x', String(rectangle.x + rectangle.width - 12)); handle.setAttribute('y', String(rectangle.y + rectangle.height - 12));
    handle.setAttribute('width', '24'); handle.setAttribute('height', '24'); handle.setAttribute('tabindex', state.cutterPending ? '-1' : '0');
    handle.setAttribute('role', 'button'); handle.setAttribute('aria-label', `Resize ${rectangle.rectangleId} from its bottom-right corner`);
    handle.setAttribute('aria-disabled', String(state.cutterPending));
    handle.classList.add('resize-handle'); handle.dataset.cutterResize = String(index);
    group.append(shape, label, handle); overlay.append(group);
  }
  canvas.append(image, overlay); scroller.append(canvas); section.append(scroller);

  const inspector = document.createElement('div'); inspector.className = 'rectangle-inspector';
  const inspectorHeading = sectionHeading('Exact rectangles', 'Numeric fields are authoritative and keyboard accessible. Drag a rectangle to move it; drag its square handle to resize.');
  inspector.append(inspectorHeading);
  if (!cutter.rectangles.length) {
    inspector.append(emptyState('No rectangles yet', 'Enter grid values above, or add a manual rectangle.'));
  } else {
    const table = document.createElement('div'); table.className = 'rectangle-table';
    for (const [index, rectangle] of cutter.rectangles.entries()) {
      const row = document.createElement('fieldset'); row.className = 'rectangle-row'; row.dataset.rectangleRow = String(index);
      const legend = document.createElement('legend'); legend.textContent = `${index + 1} · ${rectangle.rectangleId}`; row.append(legend);
      for (const field of ['x', 'y', 'width', 'height']) {
        const input = cutterNumber(field, rectangle[field], { min: field === 'width' || field === 'height' ? 1 : 0, max: field === 'x' || field === 'width' ? source.width : source.height });
        input.disabled = state.cutterPending;
        input.dataset.rectangleIndex = String(index); input.dataset.rectangleField = field; row.append(labeledField(field.toUpperCase(), input));
      }
      const included = document.createElement('input'); included.type = 'checkbox'; included.checked = rectangle.included;
      included.disabled = state.cutterPending;
      included.dataset.rectangleIndex = String(index); included.dataset.rectangleField = 'included';
      row.append(labeledField('Include', included));
      const replacement = document.createElement('select');
      replacement.dataset.rectangleIndex = String(index); replacement.dataset.rectangleField = 'replacesSliceId';
      const newIdentity = document.createElement('option'); newIdentity.value = ''; newIdentity.textContent = 'Create new slice identity';
      replacement.append(newIdentity);
      for (const slice of atlas?.sliceHeads ?? []) {
        const option = document.createElement('option'); option.value = slice.sliceId;
        option.textContent = `Replace ${slice.sliceId} v${slice.version}`; replacement.append(option);
      }
      replacement.value = rectangle.replacesSliceId ?? '';
      replacement.disabled = state.cutterPending || !rectangle.included || !(atlas?.sliceHeads.length);
      row.append(labeledField('Recut identity', replacement));
      if (rectangle.replacesSliceId) {
        const mapping = document.createElement('small'); mapping.textContent = `Replaces ${rectangle.replacesSliceId} v${rectangle.expectedSliceVersion}`; row.append(mapping);
      }
      table.append(row);
    }
    inspector.append(table);
  }
  const add = document.createElement('button'); add.type = 'button'; add.className = 'secondary'; add.textContent = 'Add manual rectangle'; add.dataset.addRectangle = '';
  add.disabled = state.cutterPending; inspector.append(add); section.append(inspector);

  const actions = document.createElement('div'); actions.className = 'cutter-actions';
  const unresolvedJob = state.cutterJob && !['APPLIED', 'DISCARDED'].includes(state.cutterJob.state);
  const save = document.createElement('button'); save.type = 'button'; save.textContent = atlas ? 'Save revised rectangles' : 'Save atlas definition'; save.dataset.saveAtlas = '';
  save.disabled = state.cutterPending || !cutter.rectangles.length || Boolean(unresolvedJob);
  if (unresolvedJob) save.title = 'Commit or discard the current preview job before replacing this atlas definition.';
  const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'secondary'; preview.textContent = 'Build slice previews'; preview.dataset.previewAtlas = '';
  preview.disabled = state.cutterPending || !atlas || cutter.dirty || Boolean(unresolvedJob);
  if (unresolvedJob) preview.title = 'Apply or discard the current preview job before queuing another.';
  actions.append(save, preview);
  if (state.cutterJob && ['QUEUED', 'RUNNING'].includes(state.cutterJob.state) && !state.cutterJob.cancelRequested) {
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'secondary'; cancel.textContent = 'Cancel job'; cancel.dataset.cancelCutterJob = '';
    cancel.disabled = state.cutterPending;
    actions.append(cancel);
  }
  if (state.cutterJob && ['FAILED', 'CANCELLED'].includes(state.cutterJob.state) && state.cutterJob.attempt < MAX_ATLAS_JOB_ATTEMPTS) {
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'secondary'; retry.textContent = 'Retry job'; retry.dataset.retryCutterJob = '';
    retry.disabled = state.cutterPending;
    actions.append(retry);
  }
  if (state.cutterJob?.state === 'SUCCEEDED') {
    const commit = document.createElement('button'); commit.type = 'button'; commit.textContent = 'Commit these slices once'; commit.dataset.commitAtlas = '';
    commit.disabled = state.cutterPending;
    actions.append(commit);
  }
  if (state.cutterJob && ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(state.cutterJob.state)) {
    const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'secondary';
    discard.textContent = 'Discard previews'; discard.dataset.discardCutterJob = '';
    discard.disabled = state.cutterPending;
    actions.append(discard);
  }
  const status = document.createElement('span'); status.className = 'cutter-job-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const jobError = state.cutterJob?.error;
  const cancellationText = state.cutterJob?.cancelRequested ? ' · cancellation requested' : '';
  const errorText = jobError ? ` · ${jobError.code || 'JOB_FAILED'}: ${jobError.message || 'Preview processing failed.'}` : '';
  status.textContent = state.cutterJob
    ? `${state.cutterJob.state} · ${state.cutterJob.progress.current}/${state.cutterJob.progress.total} · attempt ${state.cutterJob.attempt}${cancellationText}${errorText}`
    : (atlas ? `Definition v${atlas.definitionVersion} saved` : 'Unsaved definition');
  actions.append(status); section.append(actions);

  if (unresolvedJob && cutter.dirty) {
    const guidance = document.createElement('p'); guidance.className = 'cutter-note';
    guidance.textContent = state.cutterJob.state === 'SUCCEEDED'
      ? 'These edits are local. Commit or discard the succeeded previews before saving a replacement definition.'
      : ['FAILED', 'CANCELLED'].includes(state.cutterJob.state)
        ? 'These edits are local. Retry or discard this job before saving a replacement definition.'
        : 'These edits are local. Cancel the running job, wait for cancellation, then discard it before saving a replacement definition.';
    section.append(guidance);
  }
  if (state.cutterJob && ['FAILED', 'CANCELLED'].includes(state.cutterJob.state)
      && state.cutterJob.attempt >= MAX_ATLAS_JOB_ATTEMPTS) {
    const exhausted = document.createElement('p'); exhausted.className = 'cutter-note';
    exhausted.textContent = 'The bounded retry limit is exhausted. Discard this job before starting a replacement preview.';
    section.append(exhausted);
  }
  if (state.cutterJobEvents.length) {
    const history = document.createElement('ol'); history.className = 'cutter-job-events';
    for (const entry of state.cutterJobEvents) {
      const item = document.createElement('li');
      item.dataset.jobEventSequence = String(entry.sequence); item.dataset.jobEventType = entry.type;
      const label = document.createElement('strong'); label.textContent = `${entry.type} · attempt ${entry.attempt}`;
      const detail = document.createElement('span');
      detail.textContent = `${entry.progress.current}/${entry.progress.total}${entry.safePoint ? ` · ${entry.safePoint}` : ''} · ${entry.occurredAt}`;
      item.append(label, detail); history.append(item);
    }
    section.append(sectionHeading('Processing history', 'Shows when this preview started, finished, was retried, cancelled, saved, or discarded.'), history);
  }

  const previewOutputs = ['SUCCEEDED', 'APPLIED'].includes(state.cutterJob?.state)
    ? (state.cutterJob.outputs ?? [])
    : [];
  if (previewOutputs.length) {
    const previews = document.createElement('div'); previews.className = 'slice-preview-grid';
    previewOutputs.forEach((output, index) => previews.append(cutterPreviewCard(output, index, state.project.projectId)));
    section.append(sectionHeading('Preview slices', 'These slices are temporary until you save them below.'), previews);
  }
  if (atlas?.sliceHeads.length) {
    const committedGrid = document.createElement('div'); committedGrid.className = 'slice-preview-grid committed';
    atlas.sliceHeads.forEach((slice, index) => committedGrid.append(cutterPreviewCard({ ...slice, rectangleId: `${slice.rectangleId} · ${slice.sliceId} v${slice.version}` }, index, state.project.projectId)));
    section.append(sectionHeading('Saved image slices', 'Each slice keeps a stable identity. It is still only an image crop until you define how it can be used as an asset.'), committedGrid);
  }
  return section;
}

function renderSources(items) {
  const fragment = document.createDocumentFragment();
  const cutterSource = state.cutter && items.find((source) => source.id === state.cutter.sourceId);
  if (cutterSource) fragment.append(renderCutter(cutterSource));
  fragment.append(sourceIntakePanel());
  const staged = stagedSourceIntakes();
  if (staged) fragment.append(staged);
  if (!items.length) {
    fragment.append(emptyState('No sources registered', 'Import a PNG or WebP together with the available information about where it came from and how it was created.'));
    return fragment;
  }
  const grid = document.createElement('div'); grid.className = 'card-grid source-grid';
  for (const item of items) {
    const review = item.review?.disposition ?? 'LEGACY_UNREVIEWED';
    const lifecycle = item.lifecycle?.state ?? 'LEGACY_REGISTERED';
    const sourceCard = card(item.name, item.mediaType, item.provenance.prompt || 'No generation prompt recorded.', [
      ['ID', item.id], ['Artifact', item.artifactUri], ['Origin', item.provenance.origin || 'legacy'],
      ['Lifecycle', lifecycle], ['Review', review], ['Seed', item.provenance.seed],
      ['Dimensions', item.width && item.height ? `${item.width}×${item.height}` : null], ['Bytes', item.byteSize],
      ['Provider', item.provenance.provider || item.provenance.generator], ['Model', item.provenance.model],
    ]);
    sourceCard.classList.add('source-card'); sourceCard.dataset.sourceId = item.id;
    sourceCard.prepend(sourcePreview(item));
    const actions = document.createElement('div'); actions.className = 'source-review-actions';
    if (lifecycle === 'REVIEWED' && review === 'PENDING') {
      for (const [disposition, label] of [['APPROVED', 'Approve source'], ['REJECTED', 'Reject source']]) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.dataset.sourceReviewDecision = disposition;
        button.dataset.sourceId = item.id; if (disposition === 'REJECTED') button.className = 'secondary';
        button.disabled = state.sourceMutationPending;
        actions.append(button);
      }
    } else if (['IMPORTED', 'GENERATED'].includes(lifecycle) && review === 'PENDING') {
      const propose = document.createElement('button');
      propose.type = 'button'; propose.textContent = 'Propose for review';
      propose.className = 'secondary'; propose.dataset.sourceReviewPropose = ''; propose.dataset.sourceId = item.id;
      propose.disabled = state.sourceMutationPending;
      actions.append(propose);
    }
    if (lifecycle === 'APPROVED_SOURCE' && review === 'USER_APPROVED' && item.mediaType === 'image/png') {
      const cutterButton = document.createElement('button'); cutterButton.type = 'button'; cutterButton.textContent = 'Open cutter';
      cutterButton.dataset.openCutter = item.id; cutterButton.className = 'secondary';
      cutterButton.disabled = state.cutterPending || state.sourceMutationPending; actions.append(cutterButton);
    }
    sourceCard.append(actions); grid.append(sourceCard);
  }
  fragment.append(sectionHeading('Source library', 'Original CAS previews are displayed without derivative processing.'), grid);
  return fragment;
}

function renderOverview(snapshot) {
  const fragment = document.createDocumentFragment();
  const isActiveGrant = (grant) => !grant.revokedAt
    && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now())
    && !['REVOKED', 'EXPIRED', 'LEGACY_UNBOUND'].includes(grant.status);
  const activeGrants = snapshot.grants.filter(isActiveGrant);
  const visibleGrant = activeGrants.at(-1) || snapshot.grants.at(-1);
  const metrics = document.createElement('div');
  metrics.className = 'metric-grid';
  const v2Assets = snapshot.assetLibrary?.assets?.length ?? 0;
  const roomVariants = snapshot.roomLibrary?.variants?.length ?? snapshot.rooms.length;
  const pendingProposals = (snapshot.assetLibrary?.proposals?.filter(({ state: proposalState }) => proposalState === 'PENDING').length ?? 0)
    + (snapshot.roomLibrary?.proposals?.filter(({ state: proposalState }) => proposalState === 'PENDING').length ?? 0);
  const values = [
    ['Sources', snapshot.sources.length], ['Assets', snapshot.assets.length + v2Assets],
    ['Rooms', roomVariants], ['Levels', snapshot.levels.length],
    ...(snapshot.assetLibrary ? [['Pending reviews', pendingProposals]] : []),
    ['Active grants', activeGrants.length],
  ];
  for (const [label, value] of values) {
    const metric = document.createElement('article');
    metric.className = 'metric';
    const small = document.createElement('small'); small.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    metric.append(small, strong); metrics.append(metric);
  }
  fragment.append(metrics, sectionHeading('Production board', 'See what is ready, what needs attention, and which people or agents changed the project.'));
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  grid.append(
    card('How sources were created', 'Ready', 'Prompts, seeds, models, and source files are kept so an image can be understood, recreated, or revised later.'),
    card('Image slices and reusable assets', 'Foundation', 'A saved image crop becomes an asset only after its purpose and placement rules have been defined.'),
    card(
      'Agent permissions',
      activeGrants.length ? 'Granted' : 'Human only',
      activeGrants.length
        ? `${activeGrants.length} agent task permission set(s) are active and can be withdrawn.`
        : 'No agent currently has permission to change this project.',
      visibleGrant ? [
        ['Agent', visibleGrant.agentId],
        ['Task', visibleGrant.taskId],
        ['Scopes', visibleGrant.scopes.join(', ')],
        ['Revoked', visibleGrant.revokedAt || 'no'],
        ['Expires', visibleGrant.expiresAt || 'session policy'],
      ] : [],
    ),
    card(
      'Validation summary',
      snapshot.assets.every((asset) => snapshot.sources.some((source) => source.id === asset.sourceId)) ? 'Consistent' : 'Blocked',
      'Foundation checks stable IDs, source references, crop bounds shape, artifact URIs, authorization, and revision consistency.',
      [['Domain invariants', 'enforced'], ['Level compiler', 'not connected in C1A']],
    ),
    card('Atlas preview jobs', 'Checkpoint 2B', 'Approved PNG slicing runs as a durable job with progress, cancellation, bounded retry, explicit commit, and explicit discard.', [
      ['Implemented', 'atlas preview only'], ['Not included', 'generation, validation, export'],
    ]),
    card('Room authoring', snapshot.roomLibrary ? 'Checkpoint 3' : 'Ready', 'Build rooms and hallways from exact asset versions, define entrances and exits, and keep every saved version available.'),
    card('MCP transport', 'Official 2026-07-28', 'Local stdio uses private host pairing and the same semantic command core as this visual shell.'),
  );
  if (snapshot.assetLibrary) grid.append(card(
    'V2 asset library',
    v2Assets ? 'Slice-bound' : 'Ready for proposals',
    'Each asset version keeps its usage rules, validation results, and the exact saved image slice it uses.',
    [['V2 heads', v2Assets], ['Pending owner reviews', pendingProposals]],
  ));
  fragment.append(grid);
  fragment.append(sectionHeading('User control lab', 'Run these fixed semantic actions in order; no generic mutation endpoint is exposed.'));
  const controls = document.createElement('section');
  controls.className = 'control-lab';
  const actions = [
    ['idempotent-retry', '2 · Retry idempotently'],
    ['stale-write', '3 · Submit stale write'],
    ['revoke-grant', '4 · Revoke agent grant'],
    ['post-revoke-attempt', '5 · Try agent after revoke'],
  ];
  const buttonRow = document.createElement('div');
  buttonRow.className = 'control-buttons';
  for (const [action, label] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.dataset.demoAction = action;
    button.textContent = label;
    button.disabled = state.sourceMutationPending;
    buttonRow.append(button);
  }
  const result = document.createElement('pre');
  result.className = `control-result ${state.labResult?.ok === false ? 'denied' : ''}`;
  result.textContent = state.labResult
    ? `${state.labResult.action}\n${state.labResult.code}: ${state.labResult.message}`
    : '1 · First use “Create / load demo” in the top bar. Results appear here.';
  controls.append(buttonRow, result);
  fragment.append(controls);
  return fragment;
}

function renderV2AssetCard(asset) {
  const display = sliceDisplay(asset.sliceBinding);
  const article = document.createElement('article');
  article.className = 'card asset-card asset-v2-card';
  article.dataset.assetId = asset.assetId;
  if (state.assetUi.selectedAssetId === asset.assetId) article.dataset.selected = 'true';
  article.append(usefulAssetPreview(asset));
  const headingRow = document.createElement('div'); headingRow.className = 'asset-card-heading';
  const headingCopy = document.createElement('div');
  const badge = document.createElement('span'); badge.className = 'tag'; badge.textContent = `${asset.kind} · V2`;
  const heading = document.createElement('h3'); heading.textContent = asset.name;
  const lifecycle = document.createElement('span'); lifecycle.className = 'status-pill'; lifecycle.textContent = asset.lifecycle;
  headingCopy.append(badge, heading); headingRow.append(headingCopy, lifecycle); article.append(headingRow);

  const tags = document.createElement('p'); tags.className = 'asset-tags';
  tags.textContent = compactValues(asset.metadata?.tags, 'No tags'); article.append(tags);
  const properties = document.createElement('dl'); properties.className = 'property-list asset-summary';
  for (const [label, value] of [
    ['Version', `asset v${asset.assetVersion} · metadata v${asset.metadataVersion}`],
    ['Placement', placementSummary(asset.metadata)],
    ['Connectivity', connectivitySummary(asset.metadata)],
    ['Collision', collisionSummary(asset.metadata)],
    ['Navigation', asset.metadata?.navigation?.effect ?? 'missing'],
    ['Runtime', asset.metadata?.runtimeEligible === true ? 'eligible' : asset.metadata?.runtimeEligible === false ? 'not eligible' : 'missing'],
    ['Findings', findingSummary(asset.findings)],
  ]) {
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = value;
    properties.append(term, description);
  }
  article.append(properties);

  const provenance = document.createElement('section'); provenance.className = 'asset-provenance';
  const provenanceHeading = document.createElement('strong');
  provenanceHeading.textContent = `${display.label} · ${display.atlasName}`;
  provenance.append(
    provenanceHeading,
    copyableCanonical('Canonical slice ID', asset.sliceBinding?.sliceId, `copy-asset-slice-${asset.assetId}`),
    copyableCanonical('Asset ID', asset.assetId, `copy-asset-id-${asset.assetId}`),
  );
  const lineage = document.createElement('p');
  lineage.textContent = [
    `slice v${asset.sliceBinding?.sliceVersion ?? '—'}`,
    `source ${asset.sliceBinding?.sourceId ?? '—'}`,
    `atlas ${asset.sliceBinding?.atlasId ?? '—'}`,
    `rect ${asset.sliceBinding?.rectangleId ?? '—'}`,
    asset.sliceBinding?.rectangle
      ? `${asset.sliceBinding.rectangle.width}×${asset.sliceBinding.rectangle.height} at ${asset.sliceBinding.rectangle.x}, ${asset.sliceBinding.rectangle.y}`
      : 'rectangle unavailable',
    `committed r${asset.sliceBinding?.committedRevision ?? '—'}`,
  ].join(' · ');
  const digest = document.createElement('code'); digest.className = 'digest';
  digest.textContent = `sha256:${asset.sliceBinding?.digest ?? 'missing'}`;
  const proposal = document.createElement('small');
  proposal.textContent = asset.proposal
    ? `Proposal ${asset.proposal.proposalId} / ${asset.proposal.itemId} · decision r${asset.proposal.decisionRevision} · applied r${asset.proposal.appliedRevision}`
    : 'No proposal lineage recorded.';
  provenance.append(lineage, digest, proposal);
  const provenanceDetails = document.createElement('details'); provenanceDetails.className = 'asset-technical-details';
  const provenanceSummary = document.createElement('summary'); provenanceSummary.textContent = 'Technical details';
  provenanceDetails.append(provenanceSummary, provenance); article.append(provenanceDetails);

  const findingDetails = document.createElement('details');
  const findingSummaryElement = document.createElement('summary');
  findingSummaryElement.textContent = `Validation · ${findingSummary(asset.findings)}`;
  findingDetails.append(findingSummaryElement, findingsList(asset.findings)); article.append(findingDetails);

  const actions = document.createElement('div'); actions.className = 'asset-card-actions';
  const inspect = document.createElement('button'); inspect.type = 'button'; inspect.className = 'secondary';
  inspect.textContent = state.assetUi.selectedAssetId === asset.assetId ? 'Selected' : 'Inspect';
  inspect.dataset.selectAsset = asset.assetId; inspect.dataset.assetFocusKey = `select-asset-${asset.assetId}`;
  actions.append(inspect);
  const nextLifecycle = {
    DRAFT: 'METADATA_COMPLETE', METADATA_COMPLETE: 'VALIDATED', VALIDATED: 'FINAL',
  }[asset.lifecycle];
  if (nextLifecycle) {
    const warnings = (asset.findings ?? []).filter(({ severity }) => severity === 'WARNING');
    if (nextLifecycle === 'FINAL' && warnings.length) {
      const warningBox = document.createElement('fieldset'); warningBox.className = 'warning-dispositions';
      const legend = document.createElement('legend'); legend.textContent = 'Explicit warning disposition'; warningBox.append(legend);
      for (const finding of warnings) {
        const label = document.createElement('label');
        const input = document.createElement('input'); input.type = 'checkbox';
        input.dataset.warningDisposition = finding.findingId; input.dataset.assetId = asset.assetId;
        input.dataset.assetFocusKey = `warning-${asset.assetId}-${finding.findingId}`;
        input.checked = asset.warningDispositions?.includes(finding.findingId) ?? false;
        label.append(input, document.createTextNode(` Accept ${finding.ruleId}`)); warningBox.append(label);
      }
      article.append(warningBox);
    }
    const promote = document.createElement('button'); promote.type = 'button';
    promote.textContent = nextLifecycle === 'FINAL' ? 'Finalize asset' : `Advance to ${nextLifecycle.replace('_', ' ')}`;
    promote.dataset.assetLifecycle = asset.assetId; promote.dataset.targetLifecycle = nextLifecycle;
    promote.dataset.assetVersion = String(asset.assetVersion);
    promote.dataset.metadataVersion = String(asset.metadataVersion);
    promote.dataset.assetFocusKey = `lifecycle-${asset.assetId}`;
    promote.disabled = state.assetMutationPending;
    actions.append(promote);
  }
  article.append(actions);
  return article;
}

function proposalDiffRows(item) {
  const current = currentAssetLibrary().assets.find(({ assetId }) => assetId === item.assetId) ?? null;
  const proposedSpan = item.metadata?.spanTiles
    ? `${item.metadata.spanTiles.width}×${item.metadata.spanTiles.height}` : 'missing';
  const rows = [
    ['Asset', current ? `${current.name} · v${item.expectedAssetVersion}` : 'Absent', `${item.name} · ${item.operation}`],
    ['Kind', current?.kind ?? '—', item.kind],
    ['Slice', current ? `${sliceDisplay(current.sliceBinding).label} · v${current.sliceBinding?.sliceVersion}` : '—', `${sliceDisplay(item.sliceBinding).label} · v${item.sliceBinding?.sliceVersion ?? item.expectedSliceVersion}`],
    ['Tags', compactValues(current?.metadata?.tags), compactValues(item.metadata?.tags)],
    ['Footprint', current?.metadata?.spanTiles ? `${current.metadata.spanTiles.width}×${current.metadata.spanTiles.height}` : '—', proposedSpan],
    ['Placement', current ? placementSummary(current.metadata) : '—', placementSummary(item.metadata)],
    ['Connectivity', current ? connectivitySummary(current.metadata) : '—', connectivitySummary(item.metadata)],
    ['Collision', current ? collisionSummary(current.metadata) : '—', collisionSummary(item.metadata)],
    ['Navigation', current?.metadata?.navigation?.effect ?? '—', item.metadata?.navigation?.effect ?? 'missing'],
    ['Runtime', current?.metadata?.runtimeEligible === true ? 'eligible' : current?.metadata?.runtimeEligible === false ? 'not eligible' : '—', item.metadata?.runtimeEligible === true ? 'eligible' : item.metadata?.runtimeEligible === false ? 'not eligible' : 'missing'],
  ];
  const table = document.createElement('table'); table.className = 'proposal-diff';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const value of ['Field', 'Current', 'Proposed']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = value; headRow.append(cell);
  }
  head.append(headRow); table.append(head);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const rowElement = document.createElement('tr');
    row.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row'; cell.textContent = value; rowElement.append(cell);
    });
    body.append(rowElement);
  }
  table.append(body); return table;
}

function decisionDraft(proposal, item) {
  state.assetUi.decisionDrafts[proposal.proposalId] ??= {};
  state.assetUi.decisionDrafts[proposal.proposalId][item.itemId] ??= {
    disposition: item.decision?.disposition ?? 'ACCEPTED',
    reason: item.decision?.reason ?? '',
  };
  return state.assetUi.decisionDrafts[proposal.proposalId][item.itemId];
}

function renderProposalItem(proposal, item, index) {
  const display = sliceDisplay(item.sliceBinding);
  const article = document.createElement('article'); article.className = 'proposal-item';
  article.dataset.proposalItem = item.itemId;
  article.dataset.proposalRejectionReason = item.decision?.reason ?? decisionDraft(proposal, item).reason;
  const headingRow = document.createElement('div'); headingRow.className = 'proposal-item-heading';
  const heading = document.createElement('h4'); heading.textContent = `${index + 1}. ${item.name}`;
  const disposition = document.createElement('span'); disposition.className = 'status-pill';
  disposition.textContent = item.decision?.disposition ?? 'PENDING'; headingRow.append(heading, disposition);
  const preview = usefulAssetPreview(item, { previewKey: `${proposal.proposalId}:${item.itemId}` });
  article.append(headingRow, preview);
  const identity = document.createElement('div'); identity.className = 'proposal-identity';
  const primary = document.createElement('strong'); primary.textContent = `${display.label} · ${item.kind}`;
  identity.append(
    primary,
    copyableCanonical('Canonical slice ID', item.sliceBinding?.sliceId ?? item.sliceId, `proposal-slice-${proposal.proposalId}-${item.itemId}`),
    copyableCanonical('Proposed asset ID', item.assetId, `proposal-asset-${proposal.proposalId}-${item.itemId}`),
  );
  const provenance = document.createElement('small');
  provenance.textContent = `${display.atlasName} · slice v${item.sliceBinding?.sliceVersion ?? item.expectedSliceVersion} · committed r${item.sliceBinding?.committedRevision ?? '—'} · sha256:${item.sliceBinding?.digest ?? 'unresolved'}`;
  identity.append(provenance);
  const identityDetails = document.createElement('details'); identityDetails.className = 'asset-technical-details';
  const identitySummary = document.createElement('summary'); identitySummary.textContent = 'Technical details'; identityDetails.append(identitySummary, identity);
  article.append(identityDetails, proposalDiffRows(item));

  const findings = document.createElement('details'); findings.open = (item.findings ?? []).length > 0;
  const findingsSummary = document.createElement('summary');
  findingsSummary.textContent = `Deterministic findings · ${findingSummary(item.findings)}`;
  findings.append(findingsSummary, findingsList(item.findings)); article.append(findings);

  if (proposal.state === 'PENDING') {
    const draft = decisionDraft(proposal, item);
    if (preview.dataset.previewStatus === 'UNAVAILABLE' && draft.disposition === 'ACCEPTED') draft.disposition = 'REJECTED';
    const controls = document.createElement('div'); controls.className = 'proposal-decision-fields';
    const select = document.createElement('select');
    select.dataset.proposalDisposition = item.itemId;
    select.dataset.proposalId = proposal.proposalId;
    select.dataset.assetFocusKey = `proposal-disposition-${item.itemId}`;
    select.setAttribute('aria-label', `Decision for ${item.name}`);
    for (const [value, label] of [['ACCEPTED', 'Accept'], ['REJECTED', 'Reject']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
    if (preview.dataset.previewReady !== 'true') select.querySelector('option[value="ACCEPTED"]').disabled = true;
    select.value = draft.disposition;
    const reason = document.createElement('textarea'); reason.rows = 2; reason.maxLength = 2000;
    reason.placeholder = 'Rejection reason (required when rejected)';
    reason.dataset.proposalReason = item.itemId; reason.dataset.proposalId = proposal.proposalId;
    reason.dataset.assetFocusKey = `proposal-reason-${item.itemId}`;
    reason.setAttribute('aria-label', `Rejection reason for ${item.name}`);
    reason.value = draft.reason; reason.hidden = draft.disposition !== 'REJECTED';
    select.disabled = state.assetMutationPending; reason.disabled = state.assetMutationPending;
    controls.append(select, reason); article.append(controls);
  } else if (item.decision) {
    const decision = document.createElement('p'); decision.className = 'proposal-decision-record';
    decision.textContent = item.decision.disposition === 'REJECTED'
      ? `Rejected: ${item.decision.reason}`
      : `Accepted · decision revision ${item.decision.decisionRevision}`;
    article.append(decision);
  }
  return article;
}

function renderProposalReview(proposals) {
  const section = document.createElement('section'); section.className = 'proposal-review';
  section.append(sectionHeading('Proposal review', 'Inspect every ordered item and record one complete owner decision vector before applying the accepted subset.'));
  if (!proposals.length) {
    section.append(emptyState('No V2 proposals', 'A bounded agent proposal will remain durable and inspectable here.'));
    return section;
  }
  const selectedExists = proposals.some(({ proposalId }) => proposalId === state.assetUi.selectedProposalId);
  if (!selectedExists) state.assetUi.selectedProposalId = proposals.find(({ state: proposalState }) => proposalState === 'PENDING')?.proposalId ?? proposals.at(-1).proposalId;
  const selectorLabel = document.createElement('label'); selectorLabel.className = 'proposal-selector';
  const selectorCopy = document.createElement('span'); selectorCopy.textContent = 'Proposal';
  const selector = document.createElement('select'); selector.dataset.proposalSelect = '';
  selector.dataset.assetFocusKey = 'proposal-select';
  for (const proposal of proposals) {
    const option = document.createElement('option'); option.value = proposal.proposalId;
    option.textContent = `${proposal.proposalId} · ${proposal.state} · ${proposal.items.length} items`;
    selector.append(option);
  }
  selector.value = state.assetUi.selectedProposalId; selector.disabled = state.assetMutationPending;
  selectorLabel.append(selectorCopy, selector); section.append(selectorLabel);
  const proposal = proposals.find(({ proposalId }) => proposalId === state.assetUi.selectedProposalId);
  if (!proposal) return section;
  section.dataset.assetProposal = proposal.proposalId;
  section.dataset.proposalState = proposal.state;
  if (!state.assetUi.dirty && (
    state.assetUi.decisionContext?.projectId !== state.project?.projectId
      || state.assetUi.decisionContext?.proposalId !== proposal.proposalId
      || state.assetUi.decisionContext?.proposalVersion !== proposal.proposalVersion
  )) {
    state.assetUi.decisionContext = {
      projectId: state.project.projectId,
      proposalId: proposal.proposalId,
      proposalVersion: proposal.proposalVersion,
    };
  }

  const header = document.createElement('div'); header.className = 'proposal-header';
  const copy = document.createElement('div');
  const heading = document.createElement('h3'); heading.textContent = proposal.proposalId;
  const detail = document.createElement('p');
  detail.textContent = `Version ${proposal.proposalVersion} · ${proposal.state} · submitted revision ${proposal.submittedRevision} · ${proposal.items.length}/64 items`;
  copy.append(heading, detail); header.append(copy);
  const statePill = document.createElement('span'); statePill.className = 'status-pill'; statePill.textContent = proposal.state;
  header.append(statePill); section.append(header);
  if (state.assetUi.conflict?.proposalId === proposal.proposalId) {
    const conflict = document.createElement('div'); conflict.className = 'asset-conflict'; conflict.setAttribute('role', 'alert');
    const message = document.createElement('strong'); message.textContent = 'External revision conflict';
    const detailMessage = document.createElement('span'); detailMessage.textContent = state.assetUi.conflict.message;
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'secondary';
    reset.textContent = 'Reload authoritative proposal'; reset.dataset.resetProposalDraft = proposal.proposalId;
    reset.dataset.assetFocusKey = 'reset-proposal-draft';
    conflict.append(message, detailMessage, reset); section.append(conflict);
  }
  const items = document.createElement('div'); items.className = 'proposal-items'; items.dataset.assetScroll = 'proposal-items';
  proposal.items.forEach((item, index) => items.append(renderProposalItem(proposal, item, index)));
  section.append(items);

  const actions = document.createElement('div'); actions.className = 'proposal-actions';
  if (proposal.state === 'PENDING') {
    const decide = document.createElement('button'); decide.type = 'button'; decide.dataset.proposalDecision = proposal.proposalId;
    decide.dataset.proposalVersion = String(proposal.proposalVersion); decide.dataset.assetFocusKey = 'proposal-decision';
    decide.textContent = 'Record complete decision';
    decide.disabled = state.assetMutationPending || state.assetUi.conflict?.proposalId === proposal.proposalId;
    actions.append(decide);
    const draftStatus = document.createElement('small');
    draftStatus.textContent = state.assetUi.dirty ? 'Unsaved decision draft · preserved during refresh' : 'Every item must be covered.';
    actions.append(draftStatus);
  } else if (proposal.state === 'DECIDED') {
    const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED').length;
    const apply = document.createElement('button'); apply.type = 'button'; apply.dataset.proposalApply = proposal.proposalId;
    apply.dataset.proposalVersion = String(proposal.proposalVersion); apply.dataset.assetFocusKey = 'proposal-apply';
    apply.textContent = `Apply accepted subset (${accepted})`;
    apply.disabled = state.assetMutationPending || state.assetUi.conflict?.proposalId === proposal.proposalId;
    actions.append(apply);
  } else {
    const result = document.createElement('strong');
    const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED').length;
    const rejected = proposal.items.length - accepted;
    result.textContent = `Applied ${accepted} accepted item${accepted === 1 ? '' : 's'}; ${rejected} rejected item${rejected === 1 ? '' : 's'} remains inspectable.`;
    actions.append(result);
  }
  section.append(actions); return section;
}

function renderSliceVocabulary() {
  const section = document.createElement('details'); section.className = 'slice-vocabulary';
  const summary = document.createElement('summary'); summary.textContent = 'Committed slice vocabulary'; section.append(summary);
  const slices = currentProjectSlices();
  if (!slices.length) {
    section.append(emptyState('No committed slices', 'Approve a source, cut exact rectangles, and commit the preview before proposing V2 assets.'));
    return section;
  }
  const grid = document.createElement('div'); grid.className = 'slice-vocabulary-grid'; grid.dataset.assetScroll = 'slice-vocabulary';
  for (const { atlas, slice, ordinal } of slices) {
    const entry = document.createElement('article'); entry.className = 'slice-vocabulary-card';
    entry.append(safeV2Preview({
      name: `${atlas.name} Slice ${ordinal}`, kind: 'surface', sliceBinding: slice, preview: slice.preview,
    }));
    const heading = document.createElement('h4'); heading.textContent = `Slice ${ordinal}`;
    const atlasName = document.createElement('p'); atlasName.textContent = atlas.name;
    entry.append(heading, atlasName, copyableCanonical('Canonical slice ID', slice.sliceId, `slice-vocabulary-${slice.sliceId}`));
    grid.append(entry);
  }
  section.append(grid); return section;
}

function renderAssetLibrary(snapshot) {
  const fragment = document.createDocumentFragment();
  const library = currentAssetLibrary(snapshot);
  const filters = document.createElement('section'); filters.className = 'asset-filters';
  const search = document.createElement('input'); search.type = 'search'; search.value = state.assetUi.search;
  search.placeholder = 'Search name, ID, or tag'; search.dataset.assetFilter = 'search';
  search.dataset.assetFocusKey = 'asset-filter-search'; search.setAttribute('aria-label', 'Search V2 assets');
  const filterSelect = (name, label, values, current) => {
    const field = document.createElement('label');
    const copy = document.createElement('span'); copy.textContent = label;
    const select = document.createElement('select'); select.dataset.assetFilter = name;
    select.dataset.assetFocusKey = `asset-filter-${name}`;
    for (const [value, text] of values) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.value = current; field.append(copy, select); return field;
  };
  filters.append(
    search,
    filterSelect('kind', 'Kind', [['all', 'All kinds'], ['surface', 'Surface'], ['prop', 'Prop'], ['item', 'Item']], state.assetUi.kind),
    filterSelect('lifecycle', 'Lifecycle', [['all', 'All lifecycle states'], ...['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL'].map((value) => [value, value.replace('_', ' ')])], state.assetUi.lifecycle),
    filterSelect('findingSeverity', 'Findings', [['all', 'All findings'], ['clear', 'Clear'], ['ERROR', 'Errors'], ['WARNING', 'Warnings'], ['INFO', 'Info']], state.assetUi.findingSeverity),
  );
  fragment.append(sectionHeading('Asset library', 'Filter reusable assets. Each card shows what the asset is for, whether it is ready, and which exact image slice it uses.'), filters);

  const searchText = state.assetUi.search.trim().toLocaleLowerCase('en-US');
  const filtered = library.assets.filter((asset) => (
    (!searchText || [asset.name, asset.assetId, ...(asset.metadata?.tags ?? [])]
      .some((value) => String(value).toLocaleLowerCase('en-US').includes(searchText)))
    && (state.assetUi.kind === 'all' || asset.kind === state.assetUi.kind)
    && (state.assetUi.lifecycle === 'all' || asset.lifecycle === state.assetUi.lifecycle)
    && (state.assetUi.findingSeverity === 'all'
      || (state.assetUi.findingSeverity === 'clear' && !(asset.findings ?? []).length)
      || (asset.findings ?? []).some(({ severity }) => severity === state.assetUi.findingSeverity))
  ));
  const count = document.createElement('p'); count.className = 'filter-result';
  count.setAttribute('aria-live', 'polite'); count.textContent = `${filtered.length} of ${library.assets.length} V2 assets`;
  fragment.append(count);
  if (filtered.length) {
    const grid = document.createElement('div'); grid.className = 'card-grid asset-grid asset-inventory-grid';
    grid.dataset.assetScroll = 'asset-inventory'; filtered.forEach((asset) => grid.append(renderV2AssetCard(asset)));
    fragment.append(grid);
  } else fragment.append(emptyState('No V2 assets match', library.assets.length ? 'Change the current search or filters.' : 'Apply an accepted slice-backed proposal to create the first V2 asset.'));
  fragment.append(renderProposalReview(library.proposals), renderSliceVocabulary());

  if (snapshot.assets.length) {
    fragment.append(sectionHeading('Legacy asset inventory', 'Checkpoint 1 assets remain unchanged and are not claimed as V2-valid.'));
    fragment.append(renderCollection(snapshot.assets, 'assets'));
  }
  return fragment;
}

function currentRoomLibrary(snapshot = state.project?.snapshot) {
  return snapshot?.roomLibrary ?? { schemaVersion: 1, archetypes: [], variants: [], proposals: [] };
}

function roomHead(entry) {
  return entry?.versions?.find(({ version }) => version === entry.headVersion) ?? entry?.versions?.at(-1) ?? null;
}

function currentRoomVariant(snapshot = state.project?.snapshot) {
  const library = currentRoomLibrary(snapshot);
  const entry = library.variants.find(({ roomVariantId }) => roomVariantId === state.roomUi.selectedRoomVariantId)
    ?? library.variants[0];
  return { entry, variant: roomHead(entry) };
}

const ROOM_EDITOR_TOOLS = Object.freeze([
  ['SELECT', '↖', 'Select', 'Select a placement or entrance on the canvas.'],
  ['PAINT_ROOM', '■', 'Room floor', 'Paint an ordinary room-floor cell.'],
  ['PAINT_VOID', '▧', 'Outside room', 'Exclude a cell from the room.'],
  ['PAINT_BLOCKED', '⊠', 'Blocked in room', 'Keep a cell in the room but make it impassable.'],
  ['ENTRANCE', '⇥', 'Entrance', 'Add and inspect openings on the room edge.'],
  ['SURFACE', '▦', 'Surface', 'Choose a structural surface and place it on the canvas.'],
  ['PROP', '◆', 'Prop', 'Inspect a prop or item before placing it on the canvas.'],
]);

function roomShapeDraft(variant) {
  if (!variant) return null;
  if (!state.roomUi.shapeDraft || (state.roomUi.shapeDraft.roomVariantId !== variant.roomVariantId && !state.roomUi.shapeDraft.dirty)) {
    state.roomUi.shapeDraft = {
      roomVariantId: variant.roomVariantId,
      baseVersion: variant.version,
      voidCells: structuredClone(variant.voidCells ?? []),
      blockedCells: structuredClone(variant.blockedCells ?? []),
      dirty: false,
    };
    state.roomUi.shapeConflict = null;
  }
  return state.roomUi.shapeDraft;
}

function roomCellKind(variant, x, y) {
  const draft = roomShapeDraft(variant); const key = `${x},${y}`;
  if (draft?.voidCells.some((cell) => `${cell.x},${cell.y}` === key)) return 'VOID';
  if (draft?.blockedCells.some((cell) => `${cell.x},${cell.y}` === key)) return 'BLOCKED';
  return 'ROOM';
}

function roomShapeDraftChanged(variant, draft) {
  return JSON.stringify(draft.voidCells) !== JSON.stringify(variant.voidCells ?? [])
    || JSON.stringify(draft.blockedCells) !== JSON.stringify(variant.blockedCells ?? []);
}

function renderRoomToolbox(variant) {
  const toolbox = document.createElement('nav'); toolbox.className = 'room-toolbox room-panel'; toolbox.setAttribute('aria-label', 'Room editor tools');
  const title = document.createElement('strong'); title.textContent = 'Tools'; toolbox.append(title);
  for (const [value, iconText, label, description] of ROOM_EDITOR_TOOLS) {
    const button = roomControl('', 'editor-tool', { editorTool: value }); button.className = 'room-tool';
    button.dataset.roomFocusKey = `room-tool-${value}`;
    button.dataset.selected = String(state.roomUi.activeTool === value); button.setAttribute('aria-pressed', String(state.roomUi.activeTool === value));
    button.title = `${label}: ${description}`; button.disabled = variant.lifecycle !== 'DRAFT' && value !== 'SELECT';
    const icon = document.createElement('span'); icon.className = 'room-tool-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = iconText;
    const copy = document.createElement('span'); copy.textContent = label; button.append(icon, copy); toolbox.append(button);
  }
  return toolbox;
}

function roomActiveToolCopy() {
  return ROOM_EDITOR_TOOLS.find(([value]) => value === state.roomUi.activeTool) ?? ROOM_EDITOR_TOOLS[0];
}

function renderRoomToolOptions(variant) {
  const draft = roomShapeDraft(variant); const [, , label, description] = roomActiveToolCopy();
  const bar = document.createElement('section'); bar.className = 'room-tool-options'; bar.dataset.activeRoomTool = state.roomUi.activeTool;
  const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `Active tool · ${label}`;
  const guidance = document.createElement('span'); guidance.textContent = description; copy.append(title, guidance);
  const status = document.createElement('div'); status.className = 'room-editor-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  if (variant.lifecycle !== 'DRAFT') status.textContent = `Read-only · ${variant.lifecycle} room version ${variant.version}`;
  else if (state.roomUi.shapeConflict) status.textContent = 'Conflict · reload the saved shape';
  else if (draft.dirty) status.textContent = 'Unsaved shape changes';
  else status.textContent = `Saved · room version ${variant.version}`;
  status.dataset.dirty = String(draft.dirty); status.dataset.conflict = String(Boolean(state.roomUi.shapeConflict));
  const actions = document.createElement('div'); actions.className = 'room-tool-actions';
  const save = roomControl('Save shape', 'shape-save'); save.disabled = !draft.dirty || Boolean(state.roomUi.shapeConflict) || variant.lifecycle !== 'DRAFT';
  const reset = roomControl(draft.dirty || state.roomUi.shapeConflict ? 'Discard / reload' : 'Reload shape', 'shape-reset');
  reset.disabled = (!draft.dirty && !state.roomUi.shapeConflict) || variant.lifecycle !== 'DRAFT'; actions.append(save, reset);
  const lastEdit = document.createElement('span'); lastEdit.className = 'room-last-edit'; lastEdit.textContent = state.roomUi.lastShapeEdit ?? '';
  bar.append(copy, status, actions, lastEdit); return bar;
}

function renderRoomDockNavigation() {
  const navigation = document.createElement('nav'); navigation.className = 'room-dock-navigation'; navigation.setAttribute('aria-label', 'Room editor panels');
  for (const [value, label] of [['tool', 'Tool options'], ['properties', 'Purpose & settings'], ['check', 'Check room']]) {
    const button = roomControl(label, 'editor-panel', { editorPanel: value }); button.dataset.selected = String(state.roomUi.dockPanel === value);
    button.dataset.roomFocusKey = `room-panel-${value}`;
    button.setAttribute('aria-pressed', String(state.roomUi.dockPanel === value)); navigation.append(button);
  }
  return navigation;
}

function exactRoomAsset(placement, snapshot = state.project?.snapshot) {
  return currentAssetLibrary(snapshot).assets.find((asset) => (
    asset.assetId === placement.assetId
      && asset.assetVersion === placement.assetVersion
      && asset.metadataVersion === placement.metadataVersion
  )) ?? null;
}

function roomAssetSpan(asset, rotation = 0) {
  const span = asset?.metadata?.spanTiles ?? { width: 1, height: 1 };
  return rotation === 90 || rotation === 270
    ? { width: span.height, height: span.width }
    : span;
}

function roomControl(label, value, dataset = {}) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  button.className = 'secondary'; button.dataset.roomControl = value;
  Object.assign(button.dataset, dataset);
  return button;
}

function roomStatusPill(value) {
  const pill = document.createElement('span'); pill.className = 'status-pill'; pill.dataset.roomLifecycle = value;
  pill.textContent = { DRAFT: 'Editable', VALIDATED: 'Ready to finish', FINAL: 'Final' }[value] ?? value;
  return pill;
}

function roomField(labelText, input) {
  const label = document.createElement('label'); const text = document.createElement('span');
  text.textContent = labelText; label.append(text, input); return label;
}

function renderRoomCreation(library) {
  const wrapper = document.createElement('div'); wrapper.className = 'room-creation';
  const archetype = document.createElement('details');
  const archetypeSummary = document.createElement('summary'); archetypeSummary.textContent = 'New room archetype';
  const archetypeForm = document.createElement('form'); archetypeForm.dataset.roomForm = 'archetype'; archetypeForm.className = 'room-form';
  const archetypeName = document.createElement('input'); archetypeName.name = 'displayName'; archetypeName.required = true; archetypeName.maxLength = 160; archetypeName.placeholder = 'Domestic chamber';
  const kind = document.createElement('select'); kind.name = 'kind';
  for (const value of ['room', 'hallway']) { const option = document.createElement('option'); option.value = value; option.textContent = value; kind.append(option); }
  const width = document.createElement('input'); width.type = 'number'; width.name = 'width'; width.min = '3'; width.max = '64'; width.value = '10';
  const height = document.createElement('input'); height.type = 'number'; height.name = 'height'; height.min = '3'; height.max = '64'; height.value = '8';
  const submitArchetype = document.createElement('button'); submitArchetype.type = 'submit'; submitArchetype.textContent = 'Create archetype';
  archetypeForm.append(roomField('Name', archetypeName), roomField('Kind', kind), roomField('Preferred width', width), roomField('Preferred height', height), submitArchetype);
  archetype.append(archetypeSummary, archetypeForm); wrapper.append(archetype);

  const variant = document.createElement('details');
  const variantSummary = document.createElement('summary'); variantSummary.textContent = 'New room / hallway';
  const variantForm = document.createElement('form'); variantForm.dataset.roomForm = 'variant'; variantForm.className = 'room-form';
  const variantName = document.createElement('input'); variantName.name = 'displayName'; variantName.required = true; variantName.maxLength = 160; variantName.placeholder = 'North chamber';
  const archetypeSelect = document.createElement('select'); archetypeSelect.name = 'roomArchetypeId'; archetypeSelect.required = true;
  for (const candidate of library.archetypes) {
    const option = document.createElement('option'); option.value = candidate.roomArchetypeId;
    option.textContent = `${candidate.displayName} · ${candidate.kind} · v${candidate.version}`; option.dataset.version = String(candidate.version);
    archetypeSelect.append(option);
  }
  const variantWidth = document.createElement('input'); variantWidth.type = 'number'; variantWidth.name = 'width'; variantWidth.min = '3'; variantWidth.max = '64'; variantWidth.value = String(library.archetypes[0]?.dimensionPolicy?.width?.preferred ?? 10);
  const variantHeight = document.createElement('input'); variantHeight.type = 'number'; variantHeight.name = 'height'; variantHeight.min = '3'; variantHeight.max = '64'; variantHeight.value = String(library.archetypes[0]?.dimensionPolicy?.height?.preferred ?? 8);
  const submitVariant = document.createElement('button'); submitVariant.type = 'submit'; submitVariant.textContent = 'Create DRAFT'; submitVariant.disabled = library.archetypes.length === 0;
  variantForm.append(roomField('Name', variantName), roomField('Archetype', archetypeSelect), roomField('Width', variantWidth), roomField('Height', variantHeight), submitVariant);
  variant.append(variantSummary, variantForm); wrapper.append(variant);
  return wrapper;
}

function renderRoomPalette(variant, snapshot, { kinds = null } = {}) {
  const panel = document.createElement('section'); panel.className = 'room-panel room-palette';
  const heading = document.createElement('div'); heading.className = 'room-panel-heading';
  const title = document.createElement('h3'); title.textContent = 'Asset palette';
  const count = document.createElement('small');
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Filter assets'; search.value = state.roomUi.paletteSearch;
  search.dataset.roomPaletteSearch = 'true'; search.dataset.roomControl = 'palette-search'; search.dataset.roomFocusKey = 'room-palette-search'; search.setAttribute('aria-label', 'Filter room asset palette');
  const needle = state.roomUi.paletteSearch.trim().toLocaleLowerCase('en-US');
  const assets = currentAssetLibrary(snapshot).assets.filter((asset) => (
    (!kinds || kinds.includes(asset.kind))
    && (!needle || [asset.name, asset.assetId, ...(asset.metadata?.tags ?? [])]
      .some((value) => String(value).toLocaleLowerCase('en-US').includes(needle)))
  ));
  count.textContent = `${assets.length} exact-version assets`;
  heading.append(title, count); panel.append(heading, search);
  const list = document.createElement('div'); list.className = 'room-palette-list'; list.dataset.roomScroll = 'palette';
  for (const asset of assets) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'room-palette-item';
    button.dataset.roomControl = 'palette-asset'; button.dataset.paletteAssetId = asset.assetId;
    button.dataset.roomFocusKey = `room-palette-${asset.assetId}`;
    button.dataset.selected = String(state.roomUi.selectedPaletteAssetId === asset.assetId);
    button.disabled = variant.lifecycle !== 'DRAFT';
    const preview = safeV2Preview(asset); const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = asset.name;
    const metadata = document.createElement('small');
    metadata.textContent = `${asset.kind} · ${asset.metadata?.spanTiles?.width ?? '?'}×${asset.metadata?.spanTiles?.height ?? '?'} · A${asset.assetVersion}/M${asset.metadataVersion}`;
    copy.append(name, metadata); button.append(preview, copy); list.append(button);
  }
  if (!assets.length) list.append(emptyState('No placeable assets', 'Finalize V2 asset metadata or change the palette filter.'));
  panel.append(list); return panel;
}

function renderRoomPlacementPreview(variant, snapshot) {
  const asset = currentAssetLibrary(snapshot).assets.find(({ assetId }) => assetId === state.roomUi.previewAssetId);
  const section = document.createElement('section'); section.className = 'room-placement-preview room-panel';
  if (!asset) {
    section.append(sectionHeading('Inspect before placement', 'Select a prop or item from the palette. Its image, footprint, anchor, rotation, and movement effect will appear here before placement is armed.'));
    return section;
  }
  section.append(sectionHeading(asset.name, 'Confirm that the visual and authored placement rules match your intent before using this asset in the room.'));
  const preview = usefulAssetPreview(asset, { previewKey: `room:${asset.assetId}` }); section.append(preview);
  const actions = document.createElement('div'); actions.className = 'room-preview-actions';
  const use = roomControl('Use in room', 'use-preview-asset', { paletteAssetId: asset.assetId });
  use.dataset.previewPlacementAllowed = String(variant.lifecycle === 'DRAFT');
  use.disabled = variant.lifecycle !== 'DRAFT' || preview.dataset.previewReady !== 'true';
  use.title = preview.dataset.previewReady === 'true' ? 'Arm this exact asset for placement on the canvas.' : 'Reload the exact image preview before placing this asset.';
  const close = roomControl('Choose another asset', 'close-preview-asset'); actions.append(use, close); section.append(actions);
  return section;
}

function connectorGeometry(connector, variant) {
  const horizontal = connector.side === 'north' || connector.side === 'south';
  const clearance = connector.clearanceInside;
  if (horizontal) return {
    left: connector.offset, top: connector.side === 'north' ? 0 : variant.height - clearance,
    width: connector.width, height: Math.max(clearance, 0.18), side: connector.side,
  };
  return {
    left: connector.side === 'west' ? 0 : variant.width - clearance, top: connector.offset,
    width: Math.max(clearance, 0.18), height: connector.width, side: connector.side,
  };
}

function renderRoomCanvas(variant, snapshot) {
  const panel = document.createElement('section'); panel.className = 'room-canvas-panel room-panel';
  const toolbar = document.createElement('div'); toolbar.className = 'room-canvas-toolbar';
  const origin = document.createElement('strong'); origin.textContent = `Origin 0,0 · ${variant.width}×${variant.height}`;
  const zoom = document.createElement('div'); zoom.className = 'room-zoom';
  for (const [value, label] of [['fit', 'Fit'], ['1', '100%'], ['2', '200%']]) {
    const button = roomControl(label, 'zoom', { roomZoom: value }); button.dataset.selected = String(state.roomUi.zoom === value); button.dataset.roomFocusKey = `room-zoom-${value}`; zoom.append(button);
  }
  toolbar.append(origin, zoom); panel.append(toolbar);
  const scroll = document.createElement('div'); scroll.className = 'room-canvas-scroll'; scroll.dataset.roomScroll = 'canvas';
  const board = document.createElement('div'); board.className = 'room-board'; board.dataset.roomBoard = 'true';
  if (state.roomUi.activeTool.startsWith('PAINT_')) board.dataset.shapeEditing = 'true';
  const cellSize = state.roomUi.zoom === '2' ? 58 : state.roomUi.zoom === '1' ? 38 : 28;
  board.style.setProperty('--room-width', String(variant.width)); board.style.setProperty('--room-height', String(variant.height));
  board.style.setProperty('--room-cell', `${cellSize}px`);
  const grid = document.createElement('div'); grid.className = 'room-cell-grid';
  for (let y = 0; y < variant.height; y += 1) {
    for (let x = 0; x < variant.width; x += 1) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'room-cell';
      cell.dataset.roomControl = 'cell'; cell.dataset.x = String(x); cell.dataset.y = String(y);
      cell.dataset.roomFocusKey = `room-cell-${x}-${y}`;
      const kind = roomCellKind(variant, x, y); cell.dataset.cellKind = kind;
      const label = kind === 'VOID' ? 'Outside room' : kind === 'BLOCKED' ? 'Blocked room cell' : 'Room floor';
      cell.setAttribute('aria-label', `Cell ${x}, ${y}: ${label}`); const coordinate = document.createElement('span'); coordinate.textContent = `${x},${y}`;
      const stateLabel = document.createElement('small'); stateLabel.textContent = kind === 'VOID' ? 'OUTSIDE' : kind === 'BLOCKED' ? 'BLOCKED' : 'FLOOR';
      cell.append(coordinate, stateLabel); grid.append(cell);
    }
  }
  board.append(grid);
  if (state.roomUi.layers.CONNECTORS) {
    for (const connector of variant.connectors) {
      const geometry = connectorGeometry(connector, variant); const clearance = document.createElement('button');
      clearance.type = 'button'; clearance.className = `room-connector ${geometry.side}`;
      clearance.dataset.roomControl = 'connector-select'; clearance.dataset.connectorId = connector.connectorId;
      clearance.dataset.roomFocusKey = `room-connector-${connector.connectorId}`;
      clearance.dataset.selected = String(state.roomUi.selectedConnectorId === connector.connectorId);
      clearance.style.left = `calc(${geometry.left} * var(--room-cell))`; clearance.style.top = `calc(${geometry.top} * var(--room-cell))`;
      clearance.style.width = `calc(${geometry.width} * var(--room-cell))`; clearance.style.height = `calc(${geometry.height} * var(--room-cell))`;
      clearance.textContent = connector.connectorId; clearance.setAttribute('aria-label', `${connector.side} connector ${connector.connectorId}, clearance ${connector.clearanceInside} cells`);
      board.append(clearance);
    }
  }
  for (const placement of variant.placements) {
    if (!state.roomUi.layers[placement.layer]) continue;
    const asset = exactRoomAsset(placement, snapshot); const span = roomAssetSpan(asset, placement.rotation);
    const placed = document.createElement('button'); placed.type = 'button'; placed.className = `room-placement ${placement.layer.toLowerCase()}`;
    placed.dataset.roomControl = 'placement-select'; placed.dataset.placementId = placement.placementId;
    placed.dataset.roomFocusKey = `room-placement-${placement.placementId}`;
    placed.dataset.selected = String(state.roomUi.selectedPlacementId === placement.placementId);
    placed.style.left = `calc(${placement.anchor.x} * var(--room-cell))`; placed.style.top = `calc(${placement.anchor.y} * var(--room-cell))`;
    placed.style.width = `calc(${span.width} * var(--room-cell))`; placed.style.height = `calc(${span.height} * var(--room-cell))`;
    if (asset) placed.append(safeV2Preview(asset));
    const label = document.createElement('span'); label.textContent = asset?.name ?? placement.assetId; placed.append(label);
    placed.setAttribute('aria-label', `${label.textContent} at ${placement.anchor.x}, ${placement.anchor.y}, rotation ${placement.rotation}`);
    board.append(placed);
  }
  scroll.append(board); panel.append(scroll);
  const hint = document.createElement('p'); hint.className = 'room-canvas-hint';
  if (variant.lifecycle !== 'DRAFT') hint.textContent = `${variant.lifecycle} versions are read-only. Fork a FINAL version to continue authoring.`;
  else if (state.roomUi.activeTool.startsWith('PAINT_')) hint.textContent = 'Click a cell, or focus it and press Enter/Space, to paint the active class. Existing content is ghosted while painting.';
  else if (state.roomUi.selectedPlacementId) hint.textContent = 'Choose a grid coordinate to move the selected placement; arrow controls are available in the inspector.';
  else if (state.roomUi.selectedPaletteAssetId) hint.textContent = 'Choose a room-floor coordinate to place the selected exact-version asset.';
  else if (state.roomUi.activeTool === 'ENTRANCE') hint.textContent = 'Choose an existing entrance on the canvas, or add one with the tool options.';
  else if (state.roomUi.activeTool === 'SURFACE') hint.textContent = 'Choose an exact-version surface in the tool options, then place it on the canvas.';
  else if (state.roomUi.activeTool === 'PROP') hint.textContent = 'Inspect a prop in the tool options, choose “Use in room”, then place it on the canvas.';
  else hint.textContent = 'Select a placement or entrance on the canvas, or choose another tool from the left toolbar.';
  panel.append(hint); return panel;
}

function renderRoomLayers() {
  const panel = document.createElement('section'); panel.className = 'room-panel room-layers-panel';
  panel.append(sectionHeading('Layers', 'Show or hide canvas overlays without changing room data.'));
  const layers = document.createElement('div'); layers.className = 'room-layer-controls';
  for (const [value, label] of [['STRUCTURAL_SURFACE', 'Surfaces'], ['SET_DRESSING', 'Set dressing'], ['CONNECTORS', 'Connectors']]) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.roomUi.layers[value]; input.dataset.roomLayer = value; input.dataset.roomControl = 'layer';
    input.dataset.roomFocusKey = `room-layer-${value}`;
    layers.append(roomField(label, input));
  }
  panel.append(layers); return panel;
}

function renderRoomFindings(variant) {
  const section = document.createElement('section'); section.className = 'room-findings';
  const title = document.createElement('h3'); title.textContent = `Live findings · ${findingSummary(variant.findings)}`; section.append(title);
  const list = document.createElement('ul'); list.className = 'asset-findings'; list.dataset.roomScroll = 'findings';
  if (!variant.findings.length) { const clear = document.createElement('li'); clear.className = 'clear'; clear.textContent = 'No current findings.'; list.append(clear); }
  for (const finding of variant.findings) {
    const item = document.createElement('li'); item.dataset.severity = finding.severity;
    const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'room-finding-link';
    focus.dataset.roomControl = 'finding'; focus.dataset.targetKind = finding.targetKind; focus.dataset.targetId = finding.targetId;
    focus.textContent = `${finding.severity} · ${finding.ruleId}`;
    const explanation = document.createElement('span'); explanation.textContent = finding.explanation;
    const remediation = document.createElement('small'); remediation.textContent = finding.remediation;
    item.append(focus, explanation, remediation); list.append(item);
  }
  section.append(list); return section;
}

function renderRoomInspector(variant, snapshot) {
  const panel = document.createElement('aside'); panel.className = 'room-panel room-inspector';
  const title = document.createElement('h3'); title.textContent = 'Inspector'; panel.append(title);
  const selected = variant.placements.find(({ placementId }) => placementId === state.roomUi.selectedPlacementId);
  const selectedConnector = variant.connectors.find(({ connectorId }) => connectorId === state.roomUi.selectedConnectorId);
  if (selected) {
    const asset = exactRoomAsset(selected, snapshot); panel.append(copyableCanonical('Placement ID', selected.placementId, `room-placement-${selected.placementId}`));
    const summary = document.createElement('dl'); summary.className = 'property-list room-property-list';
    for (const [key, value] of [['Asset', asset?.name ?? selected.assetId], ['Exact pin', `A${selected.assetVersion}/M${selected.metadataVersion}`], ['Layer', selected.layer], ['Anchor', `${selected.anchor.x}, ${selected.anchor.y}`], ['Rotation', `${selected.rotation}°`]]) {
      const dt = document.createElement('dt'); dt.textContent = key; const dd = document.createElement('dd'); dd.textContent = value; summary.append(dt, dd);
    }
    panel.append(summary);
    const movement = document.createElement('div'); movement.className = 'room-move-controls';
    for (const [label, dx, dy] of [['←', -1, 0], ['↑', 0, -1], ['↓', 0, 1], ['→', 1, 0]]) movement.append(roomControl(label, 'move-placement', { dx: String(dx), dy: String(dy), placementId: selected.placementId }));
    movement.append(roomControl('Rotate', 'rotate-placement', { placementId: selected.placementId }), roomControl('Remove', 'remove-placement', { placementId: selected.placementId }));
    for (const control of movement.querySelectorAll('button')) control.disabled = variant.lifecycle !== 'DRAFT';
    panel.append(movement);
  } else if (selectedConnector) {
    panel.append(copyableCanonical('Connector ID', selectedConnector.connectorId, `room-connector-${selectedConnector.connectorId}`));
    const summary = document.createElement('p'); summary.className = 'room-selection-summary';
    summary.textContent = `${selectedConnector.kind} · ${selectedConnector.side} edge · offset ${selectedConnector.offset} · aperture ${selectedConnector.width} · clearance ${selectedConnector.clearanceInside} in / ${selectedConnector.clearanceOutside} out`;
    const remove = roomControl('Remove connector', 'remove-connector', { connectorId: selectedConnector.connectorId });
    remove.disabled = variant.lifecycle !== 'DRAFT'; remove.title = remove.disabled ? `${variant.lifecycle} room versions are read-only.` : 'Remove this entrance in a new room version.';
    panel.append(summary, remove);
  } else {
    const empty = document.createElement('p'); empty.className = 'room-selection-summary'; empty.textContent = 'Select a placement, connector, or linked finding for exact coordinates and controls.'; panel.append(empty);
  }
  const placementDetails = document.createElement('details'); placementDetails.open = true;
  const placementSummaryElement = document.createElement('summary'); placementSummaryElement.textContent = `Structured placements (${variant.placements.length})`;
  const list = document.createElement('ol'); list.className = 'room-placement-list'; list.dataset.roomScroll = 'placements';
  for (const placement of variant.placements) {
    const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
    button.dataset.roomControl = 'placement-select'; button.dataset.placementId = placement.placementId;
    button.textContent = `${placement.placementId} · ${placement.assetId}@${placement.assetVersion}:${placement.metadataVersion} · (${placement.anchor.x},${placement.anchor.y}) · ${placement.rotation}°`;
    item.append(button); list.append(item);
  }
  placementDetails.append(placementSummaryElement, list); panel.append(placementDetails, renderRoomFindings(variant)); return panel;
}

function roomCellsText(cells) {
  return cells.map(({ x, y }) => `${x},${y}`).join('\n');
}

function renderRoomShapeControls(variant) {
  const draft = roomShapeDraft(variant); const section = document.createElement('section'); section.className = 'room-shape-controls room-panel';
  section.append(sectionHeading('Cell classes', 'Every cell has exactly one visible class: room floor, outside room, or blocked in room. Blocked cells belong to the room for coverage, but cannot be crossed or hold props.'));
  const summary = document.createElement('p'); summary.className = 'room-shape-summary';
  const total = variant.width * variant.height; const floorCount = total - draft.voidCells.length - draft.blockedCells.length;
  summary.textContent = `${total} total · ${floorCount} room floor · ${draft.voidCells.length} outside · ${draft.blockedCells.length} blocked`;
  const legend = document.createElement('div'); legend.className = 'room-cell-legend';
  for (const [kind, label] of [['ROOM', 'Room floor'], ['VOID', 'Outside room'], ['BLOCKED', 'Blocked in room']]) {
    const item = document.createElement('span'); const swatch = document.createElement('i'); swatch.dataset.cellKind = kind; swatch.setAttribute('aria-hidden', 'true'); item.append(swatch, label); legend.append(item);
  }
  let conflict = null;
  if (state.roomUi.shapeConflict) { conflict = document.createElement('p'); conflict.className = 'asset-conflict'; conflict.setAttribute('role', 'alert'); conflict.textContent = state.roomUi.shapeConflict; }
  const coordinates = document.createElement('details'); coordinates.className = 'room-shape-coordinate-editor';
  const coordinateSummary = document.createElement('summary'); coordinateSummary.textContent = 'Structured coordinate editor';
  const form = document.createElement('form'); form.dataset.roomForm = 'shape-coordinates'; form.className = 'room-form';
  const voidInput = document.createElement('textarea'); voidInput.name = 'voidCells'; voidInput.rows = 5; voidInput.value = roomCellsText(draft.voidCells); voidInput.placeholder = 'One x,y coordinate per line';
  const blockedInput = document.createElement('textarea'); blockedInput.name = 'blockedCells'; blockedInput.rows = 5; blockedInput.value = roomCellsText(draft.blockedCells); blockedInput.placeholder = 'One x,y coordinate per line';
  const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = 'Apply coordinates to draft';
  form.append(roomField('Outside-room coordinates', voidInput), roomField('Blocked in-room coordinates', blockedInput), apply); coordinates.append(coordinateSummary, form);
  section.append(summary, legend); if (conflict) section.append(conflict); section.append(coordinates); return section;
}

function renderRoomEditorDock(variant, snapshot, library) {
  const dock = document.createElement('aside'); dock.className = 'room-editor-dock'; dock.append(renderRoomDockNavigation(), renderRoomLayers());
  if (state.roomUi.dockPanel === 'properties') {
    dock.append(renderRoomEditForms(variant, 'purpose'), renderRoomCreation(library));
  } else if (state.roomUi.dockPanel === 'check') {
    dock.append(renderRoomLifecycle(variant), renderRoomFindings(variant));
  } else if (state.roomUi.activeTool.startsWith('PAINT_')) {
    dock.append(renderRoomShapeControls(variant), renderRoomEditForms(variant, 'shape'));
  } else if (state.roomUi.activeTool === 'ENTRANCE') {
    dock.append(renderRoomEditForms(variant, 'entrances'), renderRoomInspector(variant, snapshot));
  } else if (state.roomUi.activeTool === 'SURFACE') {
    dock.append(renderRoomPalette(variant, snapshot, { kinds: ['surface'] }), renderRoomInspector(variant, snapshot));
  } else if (state.roomUi.activeTool === 'PROP') {
    dock.append(renderRoomPalette(variant, snapshot, { kinds: ['prop', 'item'] }), renderRoomPlacementPreview(variant, snapshot), renderRoomInspector(variant, snapshot), renderRoomProposalReview(variant, library.proposals));
  } else dock.append(renderRoomInspector(variant, snapshot));
  return dock;
}

function applyRoomShapeDraftLock(root, variant) {
  const draft = roomShapeDraft(variant); if (!draft.dirty) return;
  root.dataset.shapeDraftLock = 'true';
  for (const form of root.querySelectorAll('form[data-room-form]:not([data-room-form="shape-coordinates"])')) {
    for (const control of form.elements) control.disabled = true;
  }
  for (const action of ['remove-placement', 'remove-connector', 'move-placement', 'rotate-placement', 'proposal-decide', 'proposal-apply', 'validate', 'finalize', 'fork', 'warning-save']) {
    for (const control of root.querySelectorAll(`[data-room-control="${action}"]`)) { control.disabled = true; control.title = 'Save or discard shape changes first.'; }
  }
}

function renderRoomEditForms(variant, mode = 'all') {
  const section = document.createElement('section'); section.className = 'room-authoring';
  const resize = document.createElement('form'); resize.dataset.roomForm = 'resize'; resize.className = 'room-form compact';
  const rw = document.createElement('input'); rw.type = 'number'; rw.name = 'width'; rw.min = '3'; rw.max = '64'; rw.value = String(variant.width);
  const rh = document.createElement('input'); rh.type = 'number'; rh.name = 'height'; rh.min = '3'; rh.max = '64'; rh.value = String(variant.height);
  const resizeSubmit = document.createElement('button'); resizeSubmit.type = 'submit'; resizeSubmit.textContent = 'Resize';
  resize.append(roomField('Width', rw), roomField('Height', rh), resizeSubmit);
  const connector = document.createElement('form'); connector.dataset.roomForm = 'connector'; connector.className = 'room-form compact';
  const side = document.createElement('select'); side.name = 'side'; for (const value of ['north', 'east', 'south', 'west']) { const option = document.createElement('option'); option.value = value; option.textContent = value; side.append(option); }
  const offset = document.createElement('input'); offset.type = 'number'; offset.name = 'offset'; offset.min = '0'; offset.value = '1';
  const aperture = document.createElement('input'); aperture.type = 'number'; aperture.name = 'width'; aperture.min = '1'; aperture.value = '1';
  const clearance = document.createElement('input'); clearance.type = 'number'; clearance.name = 'clearanceInside'; clearance.min = '0'; clearance.max = '16'; clearance.value = '1';
  const add = document.createElement('button'); add.type = 'submit'; add.textContent = 'Add connector';
  connector.append(roomField('Edge', side), roomField('Offset', offset), roomField('Aperture', aperture), roomField('Inside clearance', clearance), add);
  const intent = document.createElement('form'); intent.dataset.roomForm = 'intent'; intent.className = 'room-form intent';
  for (const layer of ['game_design', 'level_design', 'room_design']) {
    const existing = variant.intentTrace.find((entry) => entry.layer === layer);
    const input = document.createElement('input'); input.name = layer; input.required = true; input.maxLength = 256; input.value = existing?.summary ?? ''; input.placeholder = `${layer.replace('_', ' ')} rule`;
    intent.append(roomField(layer.replace('_', ' '), input));
  }
  const saveIntent = document.createElement('button'); saveIntent.type = 'submit'; saveIntent.textContent = 'Save intent trace'; intent.append(saveIntent);
  for (const control of [...resize.elements, ...connector.elements, ...intent.elements]) control.disabled = variant.lifecycle !== 'DRAFT';
  const copy = {
    shape: ['Room size', 'Resize the bounded working area only after the saved shape and placed content fit inside it.'],
    entrances: ['Entrances', 'Add an opening on the outside edge and keep its complete inside approach on ordinary room cells.'],
    purpose: ['Room intent', 'Record the design purpose in plain language; exact rule references remain available as technical history.'],
  }[mode] ?? ['Authoring controls', 'Resize explicitly, author edge apertures and clearance, and retain the three-layer intent trace.'];
  section.append(sectionHeading(...copy));
  if (mode === 'shape') section.append(resize);
  else if (mode === 'entrances') section.append(connector);
  else if (mode === 'purpose') section.append(intent);
  else section.append(resize, connector, intent);
  return section;
}

function roomProposalDraft(proposal, item) {
  state.roomUi.decisionDrafts[proposal.proposalId] ??= {};
  state.roomUi.decisionDrafts[proposal.proposalId][item.itemId] ??= { disposition: 'ACCEPTED', reason: '' };
  return state.roomUi.decisionDrafts[proposal.proposalId][item.itemId];
}

function roomProposalDiffSummary(item) {
  const before = item.diff?.before ?? null;
  const after = item.diff?.after ?? null;
  const pin = (placement) => `${placement.assetId}@${placement.assetVersion}:${placement.metadataVersion}`;
  const coordinate = (placement) => `(${placement.anchor.x},${placement.anchor.y}) · ${placement.rotation}°`;
  if (item.operation === 'add' && after) return `Add ${after.placementId} · ${pin(after)} → ${coordinate(after)} · ${after.layer}`;
  if (item.operation === 'remove' && before) return `Remove ${before.placementId} · ${pin(before)} from ${coordinate(before)} · ${before.layer}`;
  if (item.operation === 'move' && before && after) return `Move ${before.placementId} · ${pin(before)} · ${coordinate(before)} → ${coordinate(after)} · ${after.layer}`;
  return `Invalid ${item.operation} diff`;
}

function renderRoomProposalReview(variant, proposals) {
  const relevant = proposals.filter(({ roomVariantId }) => roomVariantId === variant.roomVariantId);
  const section = document.createElement('section'); section.className = 'proposal-review room-proposal-review';
  section.append(sectionHeading('Placement proposal review', 'Agents may submit bounded placement diffs. Only the owner can decide every item and atomically apply the accepted subset.'));
  if (!relevant.length) { section.append(emptyState('No room proposals', 'The canvas remains owner-authored; scoped agent suggestions appear here as complete diffs.')); return section; }
  if (!relevant.some(({ proposalId }) => proposalId === state.roomUi.selectedProposalId)) state.roomUi.selectedProposalId = relevant.find(({ state: proposalState }) => proposalState === 'PENDING')?.proposalId ?? relevant.at(-1).proposalId;
  const selector = document.createElement('select'); selector.dataset.roomProposalSelect = 'true'; selector.dataset.roomControl = 'proposal-select';
  for (const proposal of relevant) { const option = document.createElement('option'); option.value = proposal.proposalId; option.textContent = `${proposal.proposalId} · ${proposal.state} · v${proposal.proposalVersion}`; selector.append(option); }
  selector.value = state.roomUi.selectedProposalId; section.append(selector);
  const proposal = relevant.find(({ proposalId }) => proposalId === state.roomUi.selectedProposalId); if (!proposal) return section;
  section.dataset.roomProposal = proposal.proposalId; section.dataset.proposalState = proposal.state;
  if (!state.roomUi.dirty) state.roomUi.decisionContext = { proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion };
  if (state.roomUi.conflict?.proposalId === proposal.proposalId) {
    const conflict = document.createElement('div'); conflict.className = 'asset-conflict'; conflict.textContent = state.roomUi.conflict.message; section.append(conflict);
  }
  const header = document.createElement('div'); header.className = 'proposal-header';
  const copy = document.createElement('div'); const heading = document.createElement('h3'); heading.textContent = proposal.proposalId;
  const detail = document.createElement('p'); detail.textContent = `Targets room v${proposal.expectedRoomVariantVersion} · ${proposal.items.length} item(s) · ${findingSummary(proposal.findings)}`;
  copy.append(heading, detail); header.append(copy, roomStatusPill(proposal.state)); section.append(header);
  const proposalFindings = document.createElement('details'); proposalFindings.className = 'room-proposal-findings';
  const proposalFindingsSummary = document.createElement('summary'); proposalFindingsSummary.textContent = `Complete proposed-state findings (${proposal.findings.length})`;
  proposalFindings.append(proposalFindingsSummary, findingsList(proposal.findings)); section.append(proposalFindings);
  const items = document.createElement('div'); items.className = 'proposal-items'; items.dataset.roomScroll = 'proposals';
  for (const proposalItem of proposal.items) {
    const article = document.createElement('article'); article.className = 'proposal-item room-proposal-item';
    article.dataset.roomProposalItem = proposalItem.itemId;
    const itemHeading = document.createElement('div'); itemHeading.className = 'proposal-item-heading';
    const title = document.createElement('h4'); title.textContent = `${proposalItem.itemId} · ${proposalItem.operation}`; itemHeading.append(title); article.append(itemHeading);
    const diff = document.createElement('p'); diff.className = 'room-proposal-diff'; diff.textContent = roomProposalDiffSummary(proposalItem);
    const targetIds = new Set([proposalItem.diff?.before?.placementId, proposalItem.diff?.after?.placementId].filter(Boolean));
    const relatedFindings = proposal.findings.filter(({ targetId }) => targetIds.has(targetId));
    article.append(diff, findingsList(relatedFindings));
    if (proposal.state === 'PENDING') {
      const draft = roomProposalDraft(proposal, proposalItem); const fields = document.createElement('div'); fields.className = 'proposal-decision-fields';
      const disposition = document.createElement('select'); disposition.dataset.roomProposalDisposition = proposalItem.itemId; disposition.dataset.proposalId = proposal.proposalId; disposition.dataset.roomControl = 'proposal-disposition';
      for (const value of ['ACCEPTED', 'REJECTED']) { const option = document.createElement('option'); option.value = value; option.textContent = value; disposition.append(option); } disposition.value = draft.disposition;
      const reason = document.createElement('textarea'); reason.dataset.roomProposalReason = proposalItem.itemId; reason.dataset.proposalId = proposal.proposalId; reason.placeholder = 'Required rejection reason'; reason.value = draft.reason; reason.disabled = draft.disposition === 'ACCEPTED'; reason.dataset.roomControl = 'proposal-reason';
      fields.append(disposition, reason); article.append(fields);
    } else {
      const decision = document.createElement('p'); decision.className = 'proposal-decision-record'; decision.textContent = `${proposalItem.decision?.disposition ?? 'UNKNOWN'}${proposalItem.decision?.reason ? ` · ${proposalItem.decision.reason}` : ''}`; article.append(decision);
    }
    items.append(article);
  }
  section.append(items); const actions = document.createElement('div'); actions.className = 'proposal-actions';
  if (proposal.state === 'PENDING') {
    const decide = roomControl('Record complete decision', 'proposal-decide', { proposalId: proposal.proposalId });
    decide.disabled = state.roomUi.conflict?.proposalId === proposal.proposalId; actions.append(decide);
  }
  if (proposal.state === 'DECIDED') actions.append(roomControl('Apply accepted subset', 'proposal-apply', { proposalId: proposal.proposalId }));
  section.append(actions); return section;
}

function renderRoomLifecycle(variant) {
  const section = document.createElement('section'); section.className = 'room-lifecycle';
  const warnings = variant.findings.filter(({ severity }) => severity === 'WARNING');
  const heading = document.createElement('div'); heading.className = 'room-lifecycle-heading';
  const title = document.createElement('div'); const h3 = document.createElement('h3'); h3.textContent = 'Lifecycle gate';
  const copy = document.createElement('p'); copy.textContent = 'Validation blocks on errors. Finalization also requires explicit disposition of every current warning.';
  title.append(h3, copy); heading.append(title, roomStatusPill(variant.lifecycle)); section.append(heading);
  if (warnings.length && variant.lifecycle !== 'FINAL') {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'warning-dispositions';
    const legend = document.createElement('legend'); legend.textContent = 'Accepted current warnings'; fieldset.append(legend);
    for (const warning of warnings) {
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.roomWarning = warning.findingId; input.dataset.roomControl = 'warning'; input.checked = variant.acceptedWarningFindingIds.includes(warning.findingId);
      fieldset.append(roomField(`${warning.ruleId} · ${warning.explanation}`, input));
    }
    fieldset.append(roomControl('Save warning decisions', 'warning-save')); section.append(fieldset);
  }
  const actions = document.createElement('div'); actions.className = 'room-lifecycle-actions';
  if (variant.lifecycle === 'DRAFT') actions.append(roomControl('Validate immutable version', 'validate'));
  if (variant.lifecycle === 'VALIDATED') actions.append(roomControl('Finalize immutable version', 'finalize'));
  if (variant.lifecycle === 'FINAL') actions.append(roomControl('Fork new DRAFT version', 'fork'));
  section.append(actions); return section;
}

function renderRooms(snapshot) {
  const fragment = document.createDocumentFragment(); const library = currentRoomLibrary(snapshot);
  if (!library.variants.length) {
    fragment.append(renderRoomCreation(library));
    fragment.append(emptyState('No room variants', library.archetypes.length ? 'Create a DRAFT room or hallway from an authored archetype.' : 'Create an archetype first, then create a DRAFT room or hallway.'));
    return fragment;
  }
  if (!library.variants.some(({ roomVariantId }) => roomVariantId === state.roomUi.selectedRoomVariantId)) state.roomUi.selectedRoomVariantId = library.variants[0].roomVariantId;
  const { variant } = currentRoomVariant(snapshot); const archetype = library.archetypes.find(({ roomArchetypeId, version }) => roomArchetypeId === variant.roomArchetypeId && version === variant.archetypeVersion);
  const header = document.createElement('section'); header.className = 'room-header';
  const selectorLabel = document.createElement('label'); const selectorCaption = document.createElement('span'); selectorCaption.textContent = 'Room / hallway';
  const selector = document.createElement('select'); selector.dataset.roomVariantSelect = 'true'; selector.dataset.roomControl = 'room-select';
  for (const entry of library.variants) {
    const head = roomHead(entry); const entryArchetype = library.archetypes.find((candidate) => candidate.roomArchetypeId === head.roomArchetypeId && candidate.version === head.archetypeVersion);
    const option = document.createElement('option'); option.value = entry.roomVariantId; option.textContent = `${head.displayName} · ${entryArchetype?.kind ?? 'room'} · ${head.lifecycle} v${head.version}`; selector.append(option);
  }
  selector.value = variant.roomVariantId; selectorLabel.append(selectorCaption, selector);
  const identity = document.createElement('div'); const heading = document.createElement('h2'); heading.textContent = variant.displayName;
  const detail = document.createElement('p'); detail.textContent = `${archetype?.displayName ?? 'Reusable room type'} · ${findingSummary(variant.findings)}`;
  const technical = document.createElement('details'); technical.className = 'room-header-technical';
  const technicalSummary = document.createElement('summary'); technicalSummary.textContent = 'Technical details';
  const technicalCopy = document.createElement('code'); technicalCopy.textContent = `${variant.roomVariantId} · archetype ${variant.roomArchetypeId}@${variant.archetypeVersion} · room version ${variant.version} · ${variant.lifecycle}`;
  technical.append(technicalSummary, technicalCopy); identity.append(heading, detail, technical);
  const editor = document.createElement('section'); editor.className = 'room-editor'; editor.append(renderRoomToolOptions(variant));
  const shell = document.createElement('div'); shell.className = 'room-editor-shell';
  shell.append(renderRoomToolbox(variant), renderRoomCanvas(variant, snapshot), renderRoomEditorDock(variant, snapshot, library));
  editor.append(shell); applyRoomShapeDraftLock(editor, variant);
  header.append(selectorLabel, identity, roomStatusPill(variant.lifecycle)); fragment.append(header, editor);
  return fragment;
}

const TASK_STATE_LABELS = Object.freeze({
  ACTIVE: 'Agent working',
  PAUSED: 'Waiting for you to continue',
  IN_REVIEW: 'Waiting for your review',
  CHANGES_REQUESTED: 'Waiting for you to restart the task',
  MERGED: 'Task completed',
  CANCELLED: 'Task ended',
  REJECTED: 'Task ended without changes',
  EXPIRED: 'Agent access expired',
  REVERTED: 'Changes undone',
});

const TASK_ACTION_LABELS = Object.freeze({
  pause: 'Pause agent work',
  resume: 'Let agent continue',
  cancel: 'Cancel task',
  reject: 'End task without adding changes',
  'submit-review': 'Review current result',
});

const TASK_EVENT_LABELS = Object.freeze({
  TASK_CREATED: 'Task created',
  BRANCH_COMMAND_ACCEPTED: 'Agent change saved',
  BRANCH_COMMAND_COMMITTED: 'Agent change saved',
  TASK_PAUSE: 'Agent work paused',
  TASK_RESUME: 'Agent work resumed',
  TASK_CANCEL: 'Task ended by its owner',
  TASK_REJECT: 'Task ended without adding changes',
  REVIEW_SUBMITTED: 'Result submitted for review',
  REVIEW_DECIDED: 'Review decisions saved',
  REVIEW_CHANGES_REQUESTED: 'Changes requested',
  TASK_MERGE: 'Accepted changes added to project',
  TASK_MERGED: 'Accepted changes added to project',
  TASK_REVERT: 'Task changes undone',
  MERGE_REVERTED: 'Task changes undone',
});

const TASK_CAPABILITY_LABELS = Object.freeze({
  'project.read': 'Read the project',
  'source.write': 'Add or update sources',
  'room.archetype.create': 'Create a room template',
  'room.variant.create': 'Create an editable room',
  'room.variant.intent.set': 'Edit room intent',
  'room.variant.resize': 'Resize a room',
  'room.variant.connectors.set': 'Edit entrances and exits',
  'room.variant.placements.add': 'Add room contents',
  'room.variant.placements.move': 'Move room contents',
  'room.variant.placements.remove': 'Remove room contents',
  'room.variant.validate': 'Check a room, but never finalize it',
});

function taskStateLabel(stateValue) {
  return TASK_STATE_LABELS[stateValue] ?? stateValue.replaceAll('_', ' ').toLowerCase();
}

function taskWasReverted(entry) {
  return entry.timeline?.some(({ type }) => type === 'MERGE_REVERTED') ?? false;
}

function taskHasSavedChanges(entry) {
  return entry.timeline?.some(({ type }) => ['BRANCH_COMMAND_COMMITTED', 'BRANCH_COMMAND_ACCEPTED'].includes(type)) ?? false;
}

function taskEffectiveState(entry) {
  if (taskWasReverted(entry)) return 'REVERTED';
  return entry.task.effectiveState ?? entry.task.state;
}

function taskEventActorLabel(entry, event) {
  if (event.actor?.displayName) return event.actor.displayName;
  const actorId = event.actor?.id ?? event.actorId;
  if (actorId === state.project?.snapshot.project.ownerId) return 'You';
  if (actorId === entry.task.agentId) return 'Assigned agent';
  return actorId ? 'Authorized collaborator' : 'Studio service';
}

function taskWorkflowPresentation(entry) {
  const stateValue = taskEffectiveState(entry);
  const presentations = {
    ACTIVE: { actor: 'Assigned agent', next: taskHasSavedChanges(entry) ? 'The agent can continue, or you can review the current result.' : 'The agent can work within the limits you chose.', consequence: 'Changes stay separate from the project until you review and accept them.' },
    PAUSED: { actor: 'You', next: 'Choose whether the agent should continue or the task should end.', consequence: 'The assigned agent cannot make changes while this task is paused.' },
    CHANGES_REQUESTED: { actor: 'You', next: 'Let the agent continue when you are ready for the requested changes.', consequence: 'The assigned agent remains blocked until you restart the task.' },
    IN_REVIEW: { actor: 'You', next: 'Review every proposed change, then complete or end the task.', consequence: 'Nothing enters the project until you make and confirm the decision.' },
    MERGED: { actor: 'You, if needed', next: 'The work is complete. You may undo the added changes while keeping the history.', consequence: 'Accepted changes are in the project and the assigned agent can no longer change this task.' },
    REVERTED: { actor: 'No one', next: 'This task is complete and its project changes have been undone.', consequence: 'The task and review history remain available; no second undo is possible.' },
    CANCELLED: { actor: 'No one', next: 'Create a new task if more work is needed.', consequence: 'The assigned agent cannot make further changes for this task.' },
    REJECTED: { actor: 'No one', next: 'Create a new task from the current project if more work is needed.', consequence: 'No task changes were added and the assigned agent can no longer change this task.' },
    EXPIRED: { actor: 'You', next: 'End this task and create a new task if work should continue.', consequence: 'The expired agent access cannot be resumed or used.' },
  };
  return { state: stateValue, ...(presentations[stateValue] ?? { actor: 'You', next: 'Inspect the task history.', consequence: 'No automatic action is taken.' }) };
}

function taskMergeBlockedReason(review) {
  if (!review || review.state !== 'OPEN') return 'This task is not ready to be completed.';
  if (review.conflicts?.length) return 'This result overlaps newer project work and cannot be added safely. End this task without adding changes, then create a new task from the current project.';
  if (review.items.some((item) => ['PENDING', 'CHANGES_REQUESTED'].includes(item.disposition))) {
    return 'Review every proposed change before completing this task.';
  }
  if (!review.items.some((item) => ['USER_ACCEPTED', 'AUTO_ACCEPTED_BY_POLICY'].includes(item.disposition))) {
    return 'Accept at least one proposed change before completing this task.';
  }
  return null;
}

function taskStateBadge(entry) {
  const presentation = taskWorkflowPresentation(entry);
  const badge = document.createElement('span'); badge.className = 'status-pill';
  badge.dataset.taskState = presentation.state; badge.textContent = taskStateLabel(presentation.state);
  badge.setAttribute('aria-label', `Task status: ${badge.textContent}`);
  return badge;
}

function renderTaskComposer() {
  const section = document.createElement('section'); section.className = 'task-composer surface-card'; section.dataset.taskView = 'create';
  const heading = document.createElement('div'); heading.className = 'panel-heading';
  const title = document.createElement('div');
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'You stay in control';
  const name = document.createElement('h2'); name.textContent = 'Create a task for an agent';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'secondary'; back.dataset.taskControl = 'back-to-list'; back.textContent = 'Back to tasks';
  title.append(eyebrow, name); heading.append(title, back); section.append(heading);
  const help = document.createElement('p'); help.className = 'task-help';
  help.textContent = 'Choose what the agent may change and for how long. Its work stays separate from the project until you review and accept it.';
  section.append(help);
  const form = document.createElement('form'); form.dataset.taskForm = 'create'; form.className = 'task-form';
  form.innerHTML = `
    <label>Title<input name="title" required maxlength="160" value="Build an editable room"></label>
    <label>Agent ID<input name="agentId" required maxlength="128" value="studio.agent"></label>
    <label class="task-objective">What should the agent do?<textarea name="objective" required maxlength="4000">Create or refine an editable room from already accepted project sources and assets. Do not finalize, export, or publish.</textarea></label>
    <fieldset><legend>What may the agent do?</legend>
      <label><input type="checkbox" name="capability" value="project.read" checked disabled> Read project</label>
      <label><input type="checkbox" name="capability" value="room.archetype.create" checked> Create room template</label>
      <label><input type="checkbox" name="capability" value="room.variant.create" checked> Create editable room</label>
      <label><input type="checkbox" name="capability" value="room.variant.intent.set" checked> Edit room intent</label>
      <label><input type="checkbox" name="capability" value="room.variant.resize" checked> Resize</label>
      <label><input type="checkbox" name="capability" value="room.variant.connectors.set" checked> Edit entrances and exits</label>
      <label><input type="checkbox" name="capability" value="room.variant.placements.add" checked> Add room contents</label>
      <label><input type="checkbox" name="capability" value="room.variant.placements.move" checked> Move room contents</label>
      <label><input type="checkbox" name="capability" value="room.variant.placements.remove" checked> Remove room contents</label>
      <label><input type="checkbox" name="capability" value="room.variant.validate"> Check room (never finalize)</label>
    </fieldset>
    <label>Maximum changes<input name="maxCommands" type="number" min="1" max="10000" value="40" required></label>
    <label>Agent access duration (hours)<input name="expiryHours" type="number" min="1" max="168" value="4" required></label>
    <label class="task-auto"><input name="autoAccept" type="checkbox"> Automatically accept up to 2 low-risk intent edits</label>
    <button type="submit">Create task</button>`;
  section.append(form); return section;
}

function renderTaskReview(entry) {
  const review = entry.review;
  const effectiveState = taskEffectiveState(entry);
  const reviewEditable = review?.state === 'OPEN' && effectiveState === 'IN_REVIEW';
  const section = document.createElement('section'); section.className = 'task-review task-detail-section';
  const heading = document.createElement('div'); heading.className = 'panel-heading';
  const title = document.createElement('h3'); title.textContent = 'Review task result';
  heading.append(title); section.append(heading);
  if (!review) {
    const copy = document.createElement('p'); copy.textContent = 'The task is still open. When the work is ready, either the agent or you can send the result to the project owner for review.';
    section.append(copy); return section;
  }
  const ownerId = state.project?.snapshot.project.ownerId ?? 'project owner';
  const guidance = document.createElement('p'); guidance.className = 'task-review-guidance';
  guidance.textContent = taskWasReverted(entry)
    ? 'Changes undone. The completed task and its review remain in the history.'
    : effectiveState === 'MERGED'
    ? 'Completed. The accepted changes are now part of the project, and the assigned agent can no longer change this task.'
    : effectiveState === 'CHANGES_REQUESTED'
      ? 'You asked for changes. The assigned agent remains blocked until you choose “Let agent continue”.'
      : ['REJECTED', 'CANCELLED'].includes(effectiveState)
        ? 'This task ended without adding more changes. Its review remains available as read-only history.'
        : effectiveState === 'EXPIRED'
          ? 'This task expired. Its review remains available as read-only history, and its agent access cannot resume.'
      : `Waiting for your review. Only the project owner (${ownerId}) can accept or reject these changes.`;
  section.append(guidance);
  const comparison = document.createElement('details'); comparison.className = 'task-technical-details';
  const comparisonSummary = document.createElement('summary'); comparisonSummary.textContent = 'Technical comparison details';
  const comparisonCopy = document.createElement('p');
  comparisonCopy.textContent = `Started from project revision ${review.baseRevision} · agent result revision ${review.branchHeadRevision} · compared with project revision ${review.comparedMainRevision}`;
  comparison.append(comparisonSummary, comparisonCopy); section.append(comparison);
  const conflicts = document.createElement('ul'); conflicts.className = 'task-conflicts';
  for (const conflict of review.conflicts ?? []) {
    const item = document.createElement('li');
    const message = document.createElement('strong');
    message.textContent = 'The same project item was changed both in this task and in the project after the task started.';
    const technical = document.createElement('details'); technical.className = 'task-technical-details';
    const technicalSummary = document.createElement('summary'); technicalSummary.textContent = 'Technical details';
    const technicalCode = document.createElement('code'); technicalCode.textContent = `${conflict.code}: ${conflict.entityType}:${conflict.entityId}`;
    technical.append(technicalSummary, technicalCode);
    item.append(message, technical); conflicts.append(item);
  }
  if (conflicts.children.length) {
    const conflictHeading = document.createElement('h4'); conflictHeading.textContent = 'Conflict to resolve before completion';
    section.append(conflictHeading, conflicts);
  }
  const list = document.createElement('ol'); list.className = 'task-review-items';
  for (const item of review.items) {
    const row = document.createElement('li'); row.dataset.changeId = item.changeId;
    const copy = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = item.summary;
    const technical = document.createElement('details');
    const technicalSummary = document.createElement('summary'); technicalSummary.textContent = 'Technical details';
    const code = document.createElement('code'); code.textContent = item.commandType;
    technical.append(technicalSummary, code); copy.append(strong, technical);
    const select = document.createElement('select'); select.dataset.taskReviewDisposition = item.changeId;
    for (const [value, label] of [
      ['PENDING', 'Pending'], ['USER_ACCEPTED', 'Accept'], ['USER_REJECTED', 'Reject'], ['CHANGES_REQUESTED', 'Request changes'],
    ]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
    if (item.disposition === 'AUTO_ACCEPTED_BY_POLICY') {
      select.replaceChildren();
      const option = document.createElement('option'); option.value = item.disposition; option.textContent = 'Accepted automatically under your task settings'; select.append(option); select.disabled = true;
    } else {
      select.value = item.disposition;
      select.disabled = !reviewEditable;
    }
    row.append(copy, select); list.append(row);
  }
  section.append(list);
  if (reviewEditable) {
    const decide = document.createElement('button'); decide.type = 'button'; decide.dataset.taskControl = 'decide'; decide.textContent = 'Save review decisions';
    section.append(decide);
    const blockedReason = taskMergeBlockedReason(review);
    const merge = document.createElement('button'); merge.type = 'button'; merge.className = 'secondary'; merge.dataset.taskControl = 'merge'; merge.textContent = 'Add accepted changes and complete task';
    merge.disabled = Boolean(blockedReason); merge.title = blockedReason ?? 'Add the accepted changes to the project and complete this task.'; section.append(merge);
    if (blockedReason) {
      const note = document.createElement('p'); note.className = 'task-action-note'; note.textContent = blockedReason; section.append(note);
    }
    const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'secondary'; reject.dataset.taskControl = 'reject'; reject.textContent = TASK_ACTION_LABELS.reject; section.append(reject);
  } else if (effectiveState === 'MERGED' && review.mergeId && !taskWasReverted(entry)) {
    const note = document.createElement('p'); note.className = 'task-action-note';
    note.textContent = 'You can undo the project changes from this task without deleting its task or review history.';
    const revert = document.createElement('button'); revert.type = 'button'; revert.className = 'secondary'; revert.dataset.taskControl = 'revert'; revert.textContent = 'Undo task changes'; section.append(note, revert);
  }
  return section;
}

function renderTaskList() {
  const list = document.createElement('section'); list.className = 'task-list surface-card'; list.dataset.taskView = 'list';
  const header = document.createElement('div'); header.className = 'task-list-header';
  const copy = document.createElement('div'); const listHeading = document.createElement('h2'); listHeading.textContent = 'Tasks';
  const help = document.createElement('p'); help.textContent = 'Choose a task to see who acts next, or create a new task.'; copy.append(listHeading, help);
  const create = document.createElement('button'); create.type = 'button'; create.dataset.taskControl = 'open-create'; create.textContent = 'Create task';
  header.append(copy, create); list.append(header);
  if (!state.tasks.length) {
    list.append(emptyState('No delegated tasks', 'Create a task. Finalize, export, and publish remain unavailable.'));
    return list;
  }
  const items = document.createElement('div'); items.className = 'task-list-items';
  for (const entry of state.tasks) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'task-list-item secondary';
    button.dataset.taskControl = 'select'; button.dataset.taskId = entry.task.taskId;
    const strong = document.createElement('strong'); strong.textContent = entry.task.title;
    const presentation = taskWorkflowPresentation(entry);
    const small = document.createElement('small'); small.textContent = `${presentation.actor} acts next · ${presentation.next}`;
    button.append(strong, taskStateBadge(entry), small); items.append(button);
  }
  list.append(items); return list;
}

function renderTaskDetail(selected) {
  const detail = document.createElement('section'); detail.className = 'task-detail surface-card'; detail.dataset.taskView = 'detail';
  const heading = document.createElement('div'); heading.className = 'panel-heading';
  const headCopy = document.createElement('div'); const selectedEyebrow = document.createElement('p'); selectedEyebrow.className = 'eyebrow'; selectedEyebrow.textContent = 'Selected task';
  const taskTitle = document.createElement('h2'); taskTitle.textContent = selected.task.title;
  const objective = document.createElement('p'); objective.textContent = selected.task.objective; headCopy.append(selectedEyebrow, taskTitle, objective);
  const headingActions = document.createElement('div'); headingActions.className = 'task-detail-header-actions';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'secondary'; back.dataset.taskControl = 'back-to-list'; back.textContent = 'Back to tasks';
  headingActions.append(taskStateBadge(selected), back); heading.append(headCopy, headingActions); detail.append(heading);
  const presentation = taskWorkflowPresentation(selected);
  const workflow = document.createElement('section'); workflow.className = 'task-workflow-state';
  const workflowHeading = document.createElement('h3'); workflowHeading.textContent = 'Current step';
  const actor = document.createElement('p'); actor.className = 'task-next-step'; actor.textContent = `Who acts next: ${presentation.actor}. ${presentation.next}`;
  const consequence = document.createElement('p'); consequence.textContent = `What happens next: ${presentation.consequence}`; workflow.append(workflowHeading, actor, consequence); detail.append(workflow);
  const facts = document.createElement('dl'); facts.className = 'policy-details';
  for (const [label, value] of [
    ['Assigned agent', selected.task.agentId],
    ['Agent may', selected.task.capabilities.map((capability) => TASK_CAPABILITY_LABELS[capability] ?? capability).join(', ')],
    ['Agent access ends', new Date(selected.task.expiresAt).toLocaleString()],
    ['Usage', `${selected.task.usage?.commands ?? 0} of ${selected.task.budget.maxCommands} allowed changes used`],
  ]) { const term = document.createElement('dt'); term.textContent = label; const desc = document.createElement('dd'); desc.textContent = value; facts.append(term, desc); }
  detail.append(facts);
  const technical = document.createElement('details'); technical.className = 'task-technical-details';
  const technicalSummary = document.createElement('summary'); technicalSummary.textContent = 'Technical details';
  const technicalFacts = document.createElement('dl'); technicalFacts.className = 'policy-details';
  for (const [label, value] of [
    ['Isolated work ID', selected.task.branchId], ['Starting / current revision', `r${selected.task.baseRevision} / r${selected.task.headRevision}`],
    ['Capability IDs', selected.task.capabilities.join(', ')], ['Command budget', `${selected.task.usage?.commands ?? 0}/${selected.task.budget.maxCommands} commands`],
  ]) { const term = document.createElement('dt'); term.textContent = label; const desc = document.createElement('dd'); desc.textContent = value; technicalFacts.append(term, desc); }
  technical.append(technicalSummary, technicalFacts); detail.append(technical);
  const controls = document.createElement('div'); controls.className = 'task-controls';
  const actions = presentation.state === 'ACTIVE' ? ['pause', ...(taskHasSavedChanges(selected) ? ['submit-review'] : []), 'cancel']
    : presentation.state === 'PAUSED' ? ['resume', 'cancel']
      : presentation.state === 'CHANGES_REQUESTED' ? ['resume', 'cancel']
        : presentation.state === 'EXPIRED' ? ['cancel'] : [];
  for (const action of actions) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.taskControl = action; button.textContent = TASK_ACTION_LABELS[action] ?? action.replace('-', ' '); if (action === 'cancel') button.className = 'secondary'; controls.append(button);
  }
  detail.append(controls);
  const timelineHeading = document.createElement('h3'); timelineHeading.textContent = 'Progress';
  const timeline = document.createElement('ol'); timeline.className = 'task-timeline';
  for (const event of selected.timeline) {
    const item = document.createElement('li'); const copy = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = TASK_EVENT_LABELS[event.type] ?? 'Task activity updated';
    const small = document.createElement('small'); small.textContent = `${new Date(event.occurredAt).toLocaleTimeString()} · ${taskEventActorLabel(selected, event)}`;
    const technicalEvent = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Technical details';
    const code = document.createElement('code'); code.textContent = `${event.type} · work version ${event.branchRevision ?? '—'}`; technicalEvent.append(summary, code);
    copy.append(strong, small); item.append(copy, technicalEvent); timeline.append(item);
  }
  detail.append(timelineHeading, timeline, renderTaskReview(selected)); return detail;
}

function renderTasks() {
  if (state.taskUi.view === 'create') return renderTaskComposer();
  if (state.taskUi.view === 'detail') {
    const selected = state.tasks.find(({ task }) => task.taskId === state.taskUi.selectedTaskId);
    if (selected) return renderTaskDetail(selected);
    state.taskUi.view = 'list'; state.taskUi.selectedTaskId = null;
  }
  return renderTaskList();
}

function reconcileTaskUiAfterRefresh() {
  if (state.taskUi.view !== 'detail') {
    state.taskUi.selectedTaskId = null;
    return;
  }
  if (!state.tasks.some(({ task }) => task.taskId === state.taskUi.selectedTaskId)) {
    state.taskUi.selectedTaskId = null;
    state.taskUi.view = 'list';
  }
}

function hasLiveTaskComposer() {
  return state.workspace === 'tasks'
    && state.taskUi.view === 'create'
    && elements['workspace-content'].dataset.renderedProjectId === state.project?.projectId
    && Boolean(elements['workspace-content'].querySelector('[data-task-view="create"]'));
}

function renderCollection(items, workspace) {
  if (items.length === 0) {
    const messages = {
      sources: ['No sources registered', 'Register an atlas candidate with its prompt, seed, and artifact URI.'],
      assets: ['No assets defined', 'Cut a registered source into semantic surfaces, props, and items.'],
      rooms: ['Room designer arrives next', 'Room templates, hallways, and set dressing remain explicit future commands.'],
      levels: ['Level composer arrives later', 'Levels will compose approved room revisions through the existing compiler contract.'],
    };
    return emptyState(...messages[workspace]);
  }
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  if (workspace === 'assets') grid.classList.add('asset-grid');
  for (const item of items) {
    if (workspace === 'assets') {
      const assetCard = card(item.name, item.kind, `Crop ${item.region.width}×${item.region.height} at ${item.region.x}, ${item.region.y}.`, [
        ['ID', item.id], ['Source', item.sourceId], ['Status', item.status], ['Role', item.properties.role],
      ]);
      assetCard.classList.add('asset-card');
      assetCard.dataset.assetId = item.id;
      assetCard.prepend(assetPreview(item));
      grid.append(assetCard);
    }
  }
  return grid;
}

function renderActivityWorkspace() {
  if (!state.activity.length) return emptyState('No activity', 'Accepted commands and durable denied or failed agent attempts will appear here.');
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  for (const event of [...state.activity].reverse()) {
    grid.append(card(event.summary, event.actor.kind, event.commandType, [
      ['Revision', event.revision], ['Actor', event.actor.displayName || event.actor.id], ['Task', event.taskId], ['Time', new Date(event.occurredAt).toLocaleString()],
    ]));
  }
  return grid;
}

function workspaceRenderFingerprint() {
  return JSON.stringify({
    projectId: state.project?.projectId ?? null,
    revision: state.project?.revision ?? null,
    workspace: state.workspace,
    snapshot: state.project?.snapshot ?? null,
    activity: state.workspace === 'activity' ? state.activity : null,
    sourceIntakes: state.workspace === 'sources' ? state.sourceIntakes : null,
    sourceDraft: state.workspace === 'sources' ? state.sourceDraft : null,
    resumingIntakeId: state.workspace === 'sources' ? state.resumingIntakeId : null,
    cutter: state.workspace === 'sources' ? state.cutter : null,
    cutterJob: state.workspace === 'sources' ? state.cutterJob : null,
    cutterJobEvents: state.workspace === 'sources' ? state.cutterJobEvents : null,
    cutterPending: state.cutterPending,
    assetMutationPending: state.assetMutationPending,
    roomMutationPending: state.roomMutationPending,
    taskMutationPending: state.taskMutationPending,
    tasks: state.workspace === 'tasks' ? state.tasks : null,
    taskUi: state.workspace === 'tasks' ? state.taskUi : null,
    assetUi: state.workspace === 'assets' ? {
      search: state.assetUi.search,
      kind: state.assetUi.kind,
      lifecycle: state.assetUi.lifecycle,
      findingSeverity: state.assetUi.findingSeverity,
      selectedProposalId: state.assetUi.selectedProposalId,
      selectedAssetId: state.assetUi.selectedAssetId,
      decisionDrafts: state.assetUi.decisionDrafts,
      decisionContext: state.assetUi.decisionContext,
      dirty: state.assetUi.dirty,
      conflict: state.assetUi.conflict,
    } : null,
    roomUi: state.workspace === 'rooms' ? {
      activeTool: state.roomUi.activeTool,
      dockPanel: state.roomUi.dockPanel,
      lastShapeEdit: state.roomUi.lastShapeEdit,
      shapeDraft: state.roomUi.shapeDraft,
      shapeConflict: state.roomUi.shapeConflict,
      selectedRoomVariantId: state.roomUi.selectedRoomVariantId,
      selectedPlacementId: state.roomUi.selectedPlacementId,
      selectedConnectorId: state.roomUi.selectedConnectorId,
      selectedPaletteAssetId: state.roomUi.selectedPaletteAssetId,
      previewAssetId: state.roomUi.previewAssetId,
      selectedProposalId: state.roomUi.selectedProposalId,
      paletteSearch: state.roomUi.paletteSearch,
      zoom: state.roomUi.zoom,
      layers: state.roomUi.layers,
      decisionDrafts: state.roomUi.decisionDrafts,
      decisionContext: state.roomUi.decisionContext,
      dirty: state.roomUi.dirty,
      conflict: state.roomUi.conflict,
    } : null,
    sourceMutationPending: state.sourceMutationPending,
    labResult: state.workspace === 'overview' ? state.labResult : null,
  });
}

function renderWorkspace({ preserveCutterDraft = false, preserveAssetDraft = false, preserveRoomDraft = false, preserveRoomCanvas = false } = {}) {
  if (cutterDrag) {
    state.cutterDeferredRender = true;
    return;
  }
  captureCutterScroll();
  if (preserveAssetDraft) captureAssetDomState();
  if (preserveRoomDraft) captureRoomDomState();
  const retainedRoomCanvas = preserveRoomCanvas && state.workspace === 'rooms'
    ? elements['workspace-content'].querySelector('.room-canvas-panel') : null;
  if (preserveCutterDraft) captureCutterDomDraft();
  else state.cutterDomDraft = null;
  for (const link of elements['workspace-nav'].querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.workspace === state.workspace);
  }
  const title = {
    overview: 'Project overview', sources: 'Sources & creation details', assets: 'Visual asset library',
    rooms: 'Room & hallway designer', tasks: 'Agent tasks', levels: 'Level composer', activity: 'Activity history',
  }[state.workspace] || 'Project overview';
  elements['workspace-eyebrow'].textContent = title;
  const selectedSourceFile = sourceIntakeFormCache?.querySelector('[data-source-file]');
  if (state.workspace === 'sources' && sourceIntakeFormCache?.isConnected
      && (state.sourceFileChooserActive || selectedSourceFile?.files?.length > 0)) {
    return;
  }
  if (!state.project) {
    elements['workspace-content'].replaceChildren(
      emptyState('No local Studio project', 'Choose “Create / load demo” to exercise the real command API.'),
    );
    elements['workspace-content'].dataset.renderedProjectId = '';
    elements['workspace-content'].dataset.renderedWorkspace = state.workspace;
    return;
  }
  const snapshot = state.project.snapshot;
  let content;
  if (state.workspace === 'overview') content = renderOverview(snapshot);
  else if (state.workspace === 'sources') content = renderSources(snapshot.sources);
  else if (state.workspace === 'assets') content = snapshot.assetLibrary
    ? renderAssetLibrary(snapshot)
    : renderCollection(snapshot.assets, 'assets');
  else if (state.workspace === 'rooms') content = renderRooms(snapshot);
  else if (state.workspace === 'tasks') content = renderTasks();
  else if (state.workspace === 'levels') content = renderCollection(snapshot.levels, 'levels');
  else content = renderActivityWorkspace();
  if (retainedRoomCanvas) {
    const replacementCanvas = content.querySelector?.('.room-canvas-panel');
    if (replacementCanvas) {
      const retainedBoard = retainedRoomCanvas.querySelector('[data-room-board]');
      const replacementBoard = replacementCanvas.querySelector('[data-room-board]');
      if (retainedBoard && replacementBoard?.dataset.shapeEditing === 'true') retainedBoard.dataset.shapeEditing = 'true';
      else if (retainedBoard) delete retainedBoard.dataset.shapeEditing;
      const retainedHint = retainedRoomCanvas.querySelector('.room-canvas-hint');
      const replacementHint = replacementCanvas.querySelector('.room-canvas-hint');
      if (retainedHint && replacementHint) retainedHint.textContent = replacementHint.textContent;
      replacementCanvas.replaceWith(retainedRoomCanvas);
    }
  }
  elements['workspace-content'].replaceChildren(content);
  elements['workspace-content'].dataset.renderedProjectId = state.project.projectId;
  elements['workspace-content'].dataset.renderedWorkspace = state.workspace;
  restoreCutterScroll();
  if (preserveCutterDraft) restoreCutterDomDraft();
  if (preserveAssetDraft) restoreAssetDomState();
  if (preserveRoomDraft) restoreRoomDomState();
}

function renderActivity() {
  elements['activity-count'].textContent = state.activity.length;
  const items = [...state.activity].reverse().map((event) => {
    const item = document.createElement('li');
    item.className = `activity-item ${event.actor.kind}`;
    const meta = document.createElement('div'); meta.className = 'activity-meta';
    const actor = document.createElement('span'); actor.className = 'actor-badge'; actor.textContent = event.actor.kind;
    const revision = document.createElement('span'); revision.textContent = `rev ${event.revision}`;
    const summary = document.createElement('p'); summary.textContent = event.summary;
    const detail = document.createElement('small');
    detail.textContent = `${event.actor.displayName || event.actor.id} · ${event.commandType}${event.taskId ? ` · task ${event.taskId}` : ''}`;
    meta.append(actor, revision); item.append(meta, summary, detail);
    return item;
  });
  elements['activity-list'].replaceChildren(...items);
}

function renderProject({
  preserveWorkspace = false,
  preserveCutterDraft = false,
  preserveAssetDraft = preserveCutterDraft && state.workspace === 'assets',
  preserveRoomDraft = preserveCutterDraft && state.workspace === 'rooms',
} = {}) {
  const project = state.project?.snapshot.project;
  elements['project-name'].textContent = project?.name || 'No project selected';
  elements['project-description'].textContent = project?.description || 'Create the safe demo project to see the shared command core in action.';
  elements['project-status'].textContent = project?.status || 'empty';
  elements['revision-label'].textContent = state.project ? `Revision ${state.project.revision}` : 'Revision —';
  if (!preserveWorkspace) renderWorkspace({ preserveCutterDraft, preserveAssetDraft, preserveRoomDraft });
  renderActivity(); renderAgentAccess();
}

async function publishVisualEvidence() {
  if (!visualFixture) return;
  const root = document.documentElement;
  root.dataset.visualEvidenceReady = 'false';
  root.dataset.visualProjectId = state.project?.projectId ?? 'none';
  root.dataset.visualRevision = String(state.project?.revision ?? -1);
  root.dataset.visualActivityCount = String(state.activity.length);
  root.dataset.visualConnectionState = elements['connection-label'].textContent ?? 'Unknown';
  if (!state.project || elements['connection-label'].textContent !== 'Live') return;
  const pendingImages = [...document.querySelectorAll('.asset-preview.ready img')];
  await Promise.all(pendingImages.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolveImage) => {
      const timeout = setTimeout(resolveImage, 2_000);
      const settle = () => {
        clearTimeout(timeout);
        resolveImage();
      };
      image.addEventListener('load', settle, { once: true });
      image.addEventListener('error', settle, { once: true });
    });
  }));
  await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));

  const loadedImages = [...document.querySelectorAll('.asset-preview.ready img')]
    .filter((image) => image.complete && image.naturalWidth > 0);
  const processingFallbacks = document.querySelectorAll(
    '.asset-preview.fallback[data-preview-state="PROCESSING"]',
  );
  root.dataset.visualWorkspace = state.workspace;
  root.dataset.horizontalOverflow = String(
    root.scrollWidth > root.clientWidth || document.body.scrollWidth > document.body.clientWidth,
  );
  root.dataset.agentPanelOpen = String(
    !elements['agent-access-panel'].hidden
      && elements['agent-access-state'].getAttribute('aria-expanded') === 'true',
  );
  root.dataset.assetCardCount = String(document.querySelectorAll('.asset-card').length);
  root.dataset.readyImageCount = String(loadedImages.length);
  root.dataset.processingFallbackCount = String(processingFallbacks.length);
  root.dataset.roomPlacementCount = String(document.querySelectorAll('.room-placement').length);
  root.dataset.roomFindingCount = String(document.querySelectorAll('.room-findings .asset-findings > li:not(.clear)').length);
  root.dataset.roomCanvasReady = String(Boolean(document.querySelector('[data-room-board]')));
  root.dataset.visualErrorCount = String(visualEvidenceErrors.length);
  root.dataset.agentPolicyMode = state.agentAccess?.mode ?? 'none';
  root.dataset.agentPolicyState = state.agentAccess?.state ?? 'none';
  root.dataset.visualEvidenceReady = 'true';
}

function resetAssetUiProjectContext() {
  state.assetUi.selectedProposalId = null;
  state.assetUi.selectedAssetId = null;
  state.assetUi.decisionDrafts = {};
  state.assetUi.decisionContext = null;
  state.assetUi.dirty = false;
  state.assetUi.conflict = null;
  state.assetUi.domState = null;
}

function resetRoomUiProjectContext() {
  state.roomUi.activeTool = 'SELECT';
  state.roomUi.dockPanel = 'properties';
  state.roomUi.lastShapeEdit = null;
  state.roomUi.shapeDraft = null;
  state.roomUi.shapeConflict = null;
  state.roomUi.selectedRoomVariantId = null;
  state.roomUi.selectedPlacementId = null;
  state.roomUi.selectedConnectorId = null;
  state.roomUi.selectedPaletteAssetId = null;
  state.roomUi.previewAssetId = null;
  state.roomUi.selectedProposalId = null;
  state.roomUi.paletteSearch = '';
  state.roomUi.zoom = 'fit';
  state.roomUi.layers = { STRUCTURAL_SURFACE: true, SET_DRESSING: true, CONNECTORS: true };
  state.roomUi.decisionDrafts = {};
  state.roomUi.decisionContext = null;
  state.roomUi.dirty = false;
  state.roomUi.conflict = null;
  state.roomUi.domState = null;
}

function reconcileRoomUi(project) {
  const library = currentRoomLibrary(project.snapshot);
  if (!library.variants.some(({ roomVariantId }) => roomVariantId === state.roomUi.selectedRoomVariantId)) {
    state.roomUi.selectedRoomVariantId = library.variants[0]?.roomVariantId ?? null;
    state.roomUi.selectedPlacementId = null;
    state.roomUi.selectedConnectorId = null;
  }
  const { variant } = currentRoomVariant(project.snapshot);
  if (state.roomUi.shapeDraft && (!variant
      || state.roomUi.shapeDraft.roomVariantId !== variant.roomVariantId
      || state.roomUi.shapeDraft.baseVersion !== variant.version)) {
    state.roomUi.shapeConflict = state.roomUi.shapeDraft.dirty
      ? 'The room changed while your shape draft was open. Your draft was retained but cannot be saved; reload it from the current room.' : null;
    if (!state.roomUi.shapeDraft.dirty) state.roomUi.shapeDraft = null;
  }
  if (state.roomUi.selectedPlacementId && !variant?.placements.some(({ placementId }) => placementId === state.roomUi.selectedPlacementId)) state.roomUi.selectedPlacementId = null;
  if (state.roomUi.selectedConnectorId && !variant?.connectors.some(({ connectorId }) => connectorId === state.roomUi.selectedConnectorId)) state.roomUi.selectedConnectorId = null;
  if (state.roomUi.selectedPaletteAssetId && !currentAssetLibrary(project.snapshot).assets.some(({ assetId }) => assetId === state.roomUi.selectedPaletteAssetId)) state.roomUi.selectedPaletteAssetId = null;
  if (state.roomUi.previewAssetId && !currentAssetLibrary(project.snapshot).assets.some(({ assetId }) => assetId === state.roomUi.previewAssetId)) state.roomUi.previewAssetId = null;
  const proposal = library.proposals.find(({ proposalId }) => proposalId === state.roomUi.selectedProposalId);
  if (state.roomUi.dirty && state.roomUi.decisionContext && (!proposal || proposal.proposalVersion !== state.roomUi.decisionContext.proposalVersion || proposal.state !== 'PENDING')) {
    state.roomUi.conflict = { proposalId: state.roomUi.decisionContext.proposalId, message: 'The authoritative room proposal changed. Your local draft was retained but cannot be submitted.' };
  } else if (!state.roomUi.dirty) state.roomUi.conflict = null;
}

function reconcileAssetUi(project, previousContext) {
  const library = currentAssetLibrary(project.snapshot);
  if (state.assetUi.selectedAssetId
      && !library.assets.some(({ assetId }) => assetId === state.assetUi.selectedAssetId)) {
    state.assetUi.selectedAssetId = library.assets[0]?.assetId ?? null;
  }
  const selected = library.proposals.find(({ proposalId }) => proposalId === state.assetUi.selectedProposalId) ?? null;
  if (!previousContext || !state.assetUi.dirty) {
    state.assetUi.conflict = null;
    if (selected) {
      state.assetUi.decisionContext = {
        projectId: project.projectId,
        proposalId: selected.proposalId,
        proposalVersion: selected.proposalVersion,
      };
    }
    return;
  }
  if (!selected || selected.proposalVersion !== previousContext.proposalVersion
      || selected.state !== previousContext.state) {
    state.assetUi.conflict = {
      proposalId: previousContext.proposalId,
      message: selected
        ? `Proposal changed from ${previousContext.state} v${previousContext.proposalVersion} to ${selected.state} v${selected.proposalVersion}. Your local draft was retained but cannot be submitted.`
        : 'The selected proposal is no longer present. Your local draft was retained but cannot be submitted.',
    };
  }
}

async function loadProjects(preferredProjectId, { preserveWorkspaceIfUnchanged = false } = {}) {
  const session = await api('/api/ui-session');
  state.agentAccessCsrf = session.csrfToken;
  const response = await api('/api/projects');
  state.projects = response.projects;
  const prior = preferredProjectId || elements['project-select'].value;
  elements['project-select'].replaceChildren();
  if (!state.projects.length) {
    resetSourceIntakeForm();
    cancelCutterJobPolling();
    resetCutterScroll();
    state.cutter = null; state.cutterJob = null; state.cutterJobEvents = [];
    resetAssetUiProjectContext();
    resetRoomUiProjectContext();
    state.tasks = []; state.taskUi.view = 'list'; state.taskUi.selectedTaskId = null;
    const option = document.createElement('option'); option.textContent = 'No projects'; option.value = '';
    elements['project-select'].append(option); state.project = null; state.activity = [];
    state.agentAccess = null; setAgentAccessPanel(false); renderProject(); return;
  }
  for (const project of state.projects) {
    const option = document.createElement('option'); option.value = project.projectId;
    option.textContent = `${project.name} · r${project.revision}`;
    elements['project-select'].append(option);
  }
  elements['project-select'].value = state.projects.some((item) => item.projectId === prior) ? prior : state.projects[0].projectId;
  await loadProject(elements['project-select'].value, { preserveWorkspaceIfUnchanged });
}

let projectLoadGeneration = 0;
async function loadProject(projectId, { preserveWorkspaceIfUnchanged = false } = {}) {
  if (!projectId) return;
  const generation = ++projectLoadGeneration;
  const mayPreserveWorkspace = preserveWorkspaceIfUnchanged
    && state.project?.projectId === projectId
    && elements['workspace-content'].dataset.renderedProjectId === projectId
    && elements['workspace-content'].dataset.renderedWorkspace === state.workspace;
  const previousWorkspaceFingerprint = mayPreserveWorkspace ? workspaceRenderFingerprint() : null;
  const previousAssetContext = state.workspace === 'assets' && state.project?.projectId === projectId
    ? (() => {
      captureAssetDomState();
      const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === state.assetUi.selectedProposalId);
      return proposal ? {
        proposalId: proposal.proposalId,
        proposalVersion: proposal.proposalVersion,
        state: proposal.state,
      } : null;
    })()
    : null;
  if (state.project?.projectId && state.project.projectId !== projectId) {
    state.showMcpLauncherConfig = false;
    cancelCutterJobPolling();
    resetCutterScroll();
    resetAssetUiProjectContext();
    resetRoomUiProjectContext();
    state.tasks = []; state.taskUi.view = 'list'; state.taskUi.selectedTaskId = null;
  }
  if (state.cutter?.projectId && state.cutter.projectId !== projectId) {
    cancelCutterJobPolling();
    resetCutterScroll();
    state.cutter = null; state.cutterJob = null; state.cutterJobEvents = [];
  }
  const [project, activity, agentAccess, sourceIntakes, taskList] = await Promise.all([
    api(`/api/projects/${encodeURIComponent(projectId)}`),
    api(`/api/projects/${encodeURIComponent(projectId)}/activity`),
    api(`/api/projects/${encodeURIComponent(projectId)}/agent-access`),
    api(`/api/projects/${encodeURIComponent(projectId)}/source-intakes`),
    api(`/api/projects/${encodeURIComponent(projectId)}/tasks`).catch(() => ({ tasks: [] })),
  ]);
  const taskDetails = await Promise.all((taskList.tasks ?? []).map((task) => (
    api(`/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.taskId)}`)
  )));
  if (generation !== projectLoadGeneration || elements['project-select'].value !== projectId) return false;
  if (state.project?.projectId !== projectId) {
    state.sourceDraft = null;
    state.resumingIntakeId = null;
    resetSourceIntakeForm();
  }
  state.project = project; state.activity = activity.events;
  reconcileAssetUi(project, previousAssetContext);
  reconcileRoomUi(project);
  if (state.cutter) {
    const sourceExists = project.snapshot.sources.some((source) => source.id === state.cutter.sourceId);
    if (!sourceExists) {
      cancelCutterJobPolling();
      resetCutterScroll();
      state.cutter = null; state.cutterJob = null; state.cutterJobEvents = [];
    }
    else {
      const atlas = (project.snapshot.atlases ?? []).find((candidate) => (
        candidate.id === state.cutter.atlasId && candidate.sourceId === state.cutter.sourceId
      ));
      if (atlas && !state.cutter.dirty && atlas.definitionVersion !== state.cutter.syncedVersion) {
        state.cutter.rectangles = structuredClone(atlas.rectangles);
        state.cutter.name = atlas.name;
        state.cutter.syncedVersion = atlas.definitionVersion;
      }
      if (!atlas?.latestPreviewJobId) {
        cancelCutterJobPolling();
        state.cutterJob = null; state.cutterJobEvents = [];
      } else if (state.cutterJob?.jobId !== atlas.latestPreviewJobId) {
        cancelCutterJobPolling();
        state.cutterJob = null; state.cutterJobEvents = [];
        void loadCutterJob(atlas.latestPreviewJobId);
      } else if (['QUEUED', 'RUNNING'].includes(state.cutterJob?.state)
          || state.cutterJobEvents.at(-1)?.state !== state.cutterJob?.state) {
        void loadCutterJob(atlas.latestPreviewJobId);
      }
    }
  }
  state.agentAccess = agentAccess.effectivePolicy; state.agentAccessCsrf = agentAccess.csrfToken;
  state.hostBindingSupport = agentAccess.hostBindingSupport;
  state.hostBindings = agentAccess.hostBindings;
  state.pendingHosts = agentAccess.pendingHosts;
  state.mcpLauncherConfig = agentAccess.mcpLauncherConfig;
  state.sourceIntakes = sourceIntakes.intakes;
  state.tasks = taskDetails;
  reconcileTaskUiAfterRefresh();
  if (state.resumingIntakeId && !state.sourceIntakes.some((intake) => intake.intakeId === state.resumingIntakeId && intake.state === 'STAGED')) {
    state.resumingIntakeId = null;
  }
  const preserveWorkspace = (mayPreserveWorkspace && hasLiveTaskComposer())
    || (mayPreserveWorkspace && previousWorkspaceFingerprint === workspaceRenderFingerprint());
  renderProject({ preserveWorkspace, preserveCutterDraft: preserveWorkspaceIfUnchanged });
  return true;
}

async function requestAgentAccess(mode, {
  confirmBroaderAccess = false,
  idempotencyKey = crypto.randomUUID(),
} = {}) {
  if (!state.project || !state.agentAccessCsrf) return;
  const previous = state.agentAccess;
  const request = { mode, confirmBroaderAccess, idempotencyKey };
  state.agentAccess = { ...previous, requestedMode: mode, state: 'REQUESTING' };
  renderAgentAccess();
  try {
    const response = await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/agent-access`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify(request),
    });
    state.agentAccess = response.effectivePolicy;
    state.agentAccessCsrf = response.csrfToken;
    state.hostBindingSupport = response.hostBindingSupport;
    state.hostBindings = response.hostBindings;
    state.pendingHosts = response.pendingHosts;
    state.pendingAgentAccess = null;
    if (response.changed) await loadProject(state.project.projectId);
    else renderAgentAccess();
    if (mode === 'custom' || state.agentAccess.state === 'DENIED' || state.agentAccess.warnings?.length) {
      setAgentAccessPanel(true);
    }
    showToast(response.idempotentReplay
      ? 'The original Agent access result was returned without another grant change.'
      : `Effective agent access: ${accessStateLabels[state.agentAccess.state] ?? state.agentAccess.state}.`);
  } catch (error) {
    const retryable = !error.code || error.code === 'INTERNAL_ERROR';
    state.pendingAgentAccess = retryable ? request : null;
    state.agentAccess = {
      ...(previous ?? { mode: 'off', scopes: [], warnings: [] }),
      requestedMode: mode,
      state: retryable ? 'SERVICE_UNAVAILABLE' : 'DENIED',
      warnings: [{ severity: 'warning', message: `${error.code || 'ERROR'}: ${error.message}` }],
    };
    renderAgentAccess(); setAgentAccessPanel(true);
  }
}

async function refresh({ quiet = false, passive = false } = {}) {
  if (state.refreshing || state.cutterPending || state.sourceMutationPending || state.assetMutationPending
      || state.roomMutationPending || state.taskMutationPending) return;
  state.refreshing = true; elements['refresh-button'].disabled = true;
  try {
    await loadProjects(state.project?.projectId, { preserveWorkspaceIfUnchanged: passive });
    elements['connection-dot'].classList.add('online'); elements['connection-label'].textContent = 'Live';
    if (!quiet) showToast('Project status refreshed.');
  } catch (error) {
    elements['connection-dot'].classList.remove('online'); elements['connection-label'].textContent = 'Offline';
    state.agentAccess = {
      ...(state.agentAccess ?? { mode: 'off', scopes: [], warnings: [] }),
      state: 'SERVICE_UNAVAILABLE',
      warnings: [{ severity: 'warning', message: 'The local service is unavailable; header selection grants nothing.' }],
    };
    renderAgentAccess();
    if (!quiet) showToast(`${error.code || 'ERROR'}: ${error.message}`);
  } finally {
    state.refreshing = false; updateMutationControls();
  }
}

elements['workspace-content'].addEventListener('input', (event) => {
  const filter = event.target.closest('[data-asset-filter="search"]');
  if (filter) {
    state.assetUi.search = filter.value;
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }
  const reason = event.target.closest('[data-proposal-reason]');
  if (!reason) return;
  const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === reason.dataset.proposalId);
  const item = proposal?.items.find(({ itemId }) => itemId === reason.dataset.proposalReason);
  if (!proposal || !item || proposal.state !== 'PENDING') return;
  decisionDraft(proposal, item).reason = reason.value;
  state.assetUi.dirty = true;
  reason.closest('[data-proposal-item]')?.setAttribute('data-proposal-rejection-reason', reason.value);
});

elements['workspace-content'].addEventListener('change', (event) => {
  const filter = event.target.closest('[data-asset-filter]:not([data-asset-filter="search"])');
  if (filter) {
    state.assetUi[filter.dataset.assetFilter] = filter.value;
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }
  const proposalSelect = event.target.closest('[data-proposal-select]');
  if (proposalSelect) {
    if (state.assetUi.dirty && !window.confirm('Discard the current unsaved decision draft and inspect another proposal?')) {
      renderWorkspace({ preserveAssetDraft: true });
      return;
    }
    state.assetUi.selectedProposalId = proposalSelect.value;
    state.assetUi.dirty = false; state.assetUi.conflict = null;
    const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === proposalSelect.value);
    state.assetUi.decisionContext = proposal ? {
      projectId: state.project.projectId,
      proposalId: proposal.proposalId,
      proposalVersion: proposal.proposalVersion,
    } : null;
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }
  const disposition = event.target.closest('[data-proposal-disposition]');
  if (!disposition) return;
  const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === disposition.dataset.proposalId);
  const item = proposal?.items.find(({ itemId }) => itemId === disposition.dataset.proposalDisposition);
  if (!proposal || !item || proposal.state !== 'PENDING') return;
  const draft = decisionDraft(proposal, item); draft.disposition = disposition.value;
  if (disposition.value === 'ACCEPTED') draft.reason = '';
  state.assetUi.dirty = true;
  renderWorkspace({ preserveAssetDraft: true });
});

elements['workspace-content'].addEventListener('click', async (event) => {
  const previewRotation = event.target.closest('[data-asset-preview-rotation]');
  if (previewRotation) {
    state.assetUi.previewRotations[previewRotation.dataset.previewKey] = Number(previewRotation.dataset.assetPreviewRotation);
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }
  const copy = event.target.closest('[data-copy-canonical]');
  if (copy) {
    try {
      await navigator.clipboard.writeText(copy.dataset.copyCanonical);
      showToast('Canonical ID copied.');
    } catch {
      showToast('COPY_UNAVAILABLE: Select the visible canonical ID and copy it manually.');
    }
    return;
  }
  const selectAsset = event.target.closest('[data-select-asset]');
  if (selectAsset) {
    state.assetUi.selectedAssetId = selectAsset.dataset.selectAsset;
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }
  const reset = event.target.closest('[data-reset-proposal-draft]');
  if (reset) {
    delete state.assetUi.decisionDrafts[reset.dataset.resetProposalDraft];
    state.assetUi.dirty = false; state.assetUi.conflict = null;
    const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === reset.dataset.resetProposalDraft);
    state.assetUi.decisionContext = proposal ? {
      projectId: state.project.projectId,
      proposalId: proposal.proposalId,
      proposalVersion: proposal.proposalVersion,
    } : null;
    renderWorkspace({ preserveAssetDraft: true });
    return;
  }

  const decide = event.target.closest('[data-proposal-decision]');
  const apply = event.target.closest('[data-proposal-apply]');
  const lifecycle = event.target.closest('[data-asset-lifecycle]');
  if ((!decide && !apply && !lifecycle) || !state.project || !state.agentAccessCsrf
      || state.assetMutationPending || state.cutterPending || state.sourceMutationPending) return;
  const operationProjectId = state.project.projectId;
  const operationRevision = state.project.revision;
  const operationCsrf = state.agentAccessCsrf;
  let operation;
  let target;
  let path;
  let successMessage;
  if (decide) {
    const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === decide.dataset.proposalDecision);
    if (!proposal || proposal.state !== 'PENDING'
        || proposal.proposalVersion !== Number(decide.dataset.proposalVersion)
        || state.assetUi.conflict?.proposalId === proposal.proposalId) {
      showToast('PROPOSAL_CONTEXT_CHANGED: Reload the authoritative proposal before deciding.'); return;
    }
    const decisions = [];
    for (const item of proposal.items) {
      const draft = decisionDraft(proposal, item);
      const reason = draft.reason.trim();
      if (draft.disposition === 'REJECTED' && !reason) {
        showToast(`A rejection reason is required for ${item.name}.`);
        elements['workspace-content'].querySelector(`[data-proposal-reason="${CSS.escape(item.itemId)}"]`)?.focus();
        return;
      }
      decisions.push({ itemId: item.itemId, disposition: draft.disposition, reason: draft.disposition === 'REJECTED' ? reason : null });
    }
    if (!window.confirm(`Record this complete ${decisions.length}-item decision? Applying the accepted subset remains a separate step.`)) return;
    target = proposal.proposalId;
    path = `/api/projects/${encodeURIComponent(operationProjectId)}/asset-proposals/${encodeURIComponent(target)}/decision`;
    operation = {
      expectedRevision: operationRevision,
      idempotencyKey: assetOperationKey('asset-proposal-decision', target, operationProjectId),
      expectedProposalVersion: proposal.proposalVersion,
      decisions,
      confirm: true,
    };
    successMessage = 'Complete proposal decision recorded.';
  } else if (apply) {
    const proposal = currentAssetLibrary().proposals.find(({ proposalId }) => proposalId === apply.dataset.proposalApply);
    if (!proposal || proposal.state !== 'DECIDED'
        || proposal.proposalVersion !== Number(apply.dataset.proposalVersion)) {
      showToast('PROPOSAL_CONTEXT_CHANGED: Reload the authoritative proposal before applying.'); return;
    }
    const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED').length;
    if (!window.confirm(`Apply exactly ${accepted} accepted item${accepted === 1 ? '' : 's'} as one atomic revision? Rejected items create no assets.`)) return;
    target = proposal.proposalId;
    path = `/api/projects/${encodeURIComponent(operationProjectId)}/asset-proposals/${encodeURIComponent(target)}/apply`;
    operation = {
      expectedRevision: operationRevision,
      idempotencyKey: assetOperationKey('asset-proposal-apply', target, operationProjectId),
      expectedProposalVersion: proposal.proposalVersion,
      confirm: true,
    };
    successMessage = `Applied ${accepted} accepted asset${accepted === 1 ? '' : 's'} atomically.`;
  } else {
    const asset = currentAssetLibrary().assets.find(({ assetId }) => assetId === lifecycle.dataset.assetLifecycle);
    if (!asset || asset.assetVersion !== Number(lifecycle.dataset.assetVersion)
        || asset.metadataVersion !== Number(lifecycle.dataset.metadataVersion)) {
      showToast('ASSET_CONTEXT_CHANGED: Reload the authoritative asset before promotion.'); return;
    }
    const targetLifecycle = lifecycle.dataset.targetLifecycle;
    const acceptedWarningFindingIds = [...elements['workspace-content'].querySelectorAll(
      `[data-warning-disposition][data-asset-id="${CSS.escape(asset.assetId)}"]:checked`,
    )].map((input) => input.dataset.warningDisposition);
    if (!window.confirm(`${targetLifecycle === 'FINAL' ? 'Finalize' : 'Promote'} ${asset.name} to ${targetLifecycle}? This creates a new immutable asset version.`)) return;
    target = asset.assetId;
    path = `/api/projects/${encodeURIComponent(operationProjectId)}/assets/${encodeURIComponent(target)}/lifecycle`;
    operation = {
      expectedRevision: operationRevision,
      idempotencyKey: assetOperationKey('asset-lifecycle', `${target}:${targetLifecycle}`, operationProjectId),
      expectedAssetVersion: asset.assetVersion,
      expectedMetadataVersion: asset.metadataVersion,
      targetLifecycle,
      acceptedWarningFindingIds,
      confirm: true,
    };
    successMessage = `${asset.name} promoted to ${targetLifecycle}.`;
  }

  const operationKind = decide ? 'asset-proposal-decision' : apply ? 'asset-proposal-apply' : 'asset-lifecycle';
  const operationTarget = lifecycle ? `${target}:${lifecycle.dataset.targetLifecycle}` : target;
  setAssetMutationPending(true); renderWorkspace({ preserveAssetDraft: true });
  try {
    const response = await api(path, {
      method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
      body: JSON.stringify(operation),
    });
    if (response.projectId !== operationProjectId || response.revision !== operationRevision + 1
        || state.project?.projectId !== operationProjectId) {
      const error = new Error('The mutation response did not match the captured project and revision context.');
      error.code = 'ASSET_CONTEXT_CHANGED'; throw error;
    }
    clearAssetOperationKey(operationKind, operationTarget, operationProjectId);
    if (decide) {
      delete state.assetUi.decisionDrafts[target]; state.assetUi.dirty = false;
      state.assetUi.conflict = null;
    }
    await loadProject(operationProjectId, { preserveWorkspaceIfUnchanged: true });
    showToast(successMessage);
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    if (state.project?.projectId === operationProjectId) {
      await loadProject(operationProjectId, { preserveWorkspaceIfUnchanged: true }).catch(() => {});
    }
  } finally {
    setAssetMutationPending(false); renderWorkspace({ preserveAssetDraft: true });
  }
});

function stableUiId(prefix, name = '') {
  const slug = name.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || prefix;
  return `${prefix}:${slug}:${crypto.randomUUID().slice(0, 8)}`;
}

async function executeRoomMutation({ operation, target, path, body, successMessage, onBeforeReload = null }) {
  if (!state.project || !state.agentAccessCsrf || state.roomMutationPending) return false;
  if (operation !== 'room-shape-set' && state.roomUi.shapeDraft?.dirty) {
    showToast('Save or discard shape changes before changing other room data.'); return false;
  }
  const projectId = state.project.projectId; const revision = state.project.revision; const csrf = state.agentAccessCsrf;
  setRoomMutationPending(true);
  try {
    const response = await api(path, {
      method: 'POST', headers: { 'x-numberdroid-studio-csrf': csrf },
      body: JSON.stringify({ expectedRevision: revision, idempotencyKey: roomOperationKey(operation, target, projectId), ...body }),
    });
    if (response.projectId !== projectId || response.revision !== revision + 1 || state.project?.projectId !== projectId) {
      const error = new Error('The room mutation response did not match the captured project and revision context.');
      error.code = 'ROOM_CONTEXT_CHANGED'; throw error;
    }
    clearRoomOperationKey(operation, target, projectId);
    onBeforeReload?.();
    await loadProject(projectId, { preserveWorkspaceIfUnchanged: true }); showToast(successMessage); return true;
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    if (state.project?.projectId === projectId) await loadProject(projectId, { preserveWorkspaceIfUnchanged: true }).catch(() => {});
    return false;
  } finally {
    setRoomMutationPending(false); renderWorkspace({ preserveRoomDraft: true });
  }
}

elements['workspace-content'].addEventListener('input', (event) => {
  const search = event.target.closest('[data-room-palette-search]');
  if (search) {
    const start = search.selectionStart; state.roomUi.paletteSearch = search.value; renderWorkspace({ preserveRoomDraft: true });
    const replacement = elements['workspace-content'].querySelector('[data-room-palette-search]'); replacement?.focus();
    if (replacement && start !== null) replacement.setSelectionRange(start, start);
    return;
  }
  const reason = event.target.closest('[data-room-proposal-reason]');
  if (!reason) return;
  const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === reason.dataset.proposalId);
  const item = proposal?.items.find(({ itemId }) => itemId === reason.dataset.roomProposalReason);
  if (!proposal || !item || proposal.state !== 'PENDING') return;
  roomProposalDraft(proposal, item).reason = reason.value; state.roomUi.dirty = true;
});

elements['workspace-content'].addEventListener('change', (event) => {
  const roomSelect = event.target.closest('[data-room-variant-select]');
  if (roomSelect) {
    if ((state.roomUi.dirty || state.roomUi.shapeDraft?.dirty) && !window.confirm('Discard the unsaved room draft and switch rooms?')) { renderWorkspace({ preserveRoomDraft: true }); return; }
    state.roomUi.selectedRoomVariantId = roomSelect.value; state.roomUi.selectedPlacementId = null; state.roomUi.selectedConnectorId = null;
    state.roomUi.selectedPaletteAssetId = null; state.roomUi.previewAssetId = null; state.roomUi.selectedProposalId = null; state.roomUi.dirty = false; state.roomUi.conflict = null;
    state.roomUi.shapeDraft = null; state.roomUi.shapeConflict = null; renderWorkspace(); return;
  }
  const layer = event.target.closest('[data-room-layer]');
  if (layer) { state.roomUi.layers[layer.dataset.roomLayer] = layer.checked; renderWorkspace({ preserveRoomDraft: true }); return; }
  const proposalSelect = event.target.closest('[data-room-proposal-select]');
  if (proposalSelect) {
    if (state.roomUi.dirty && !window.confirm('Discard the current room proposal decision draft?')) { renderWorkspace({ preserveRoomDraft: true }); return; }
    state.roomUi.selectedProposalId = proposalSelect.value; state.roomUi.dirty = false; state.roomUi.conflict = null;
    const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === proposalSelect.value);
    state.roomUi.decisionContext = proposal ? { proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion } : null;
    renderWorkspace({ preserveRoomDraft: true }); return;
  }
  const disposition = event.target.closest('[data-room-proposal-disposition]');
  if (!disposition) return;
  const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === disposition.dataset.proposalId);
  const item = proposal?.items.find(({ itemId }) => itemId === disposition.dataset.roomProposalDisposition);
  if (!proposal || !item || proposal.state !== 'PENDING') return;
  const draft = roomProposalDraft(proposal, item); draft.disposition = disposition.value; if (draft.disposition === 'ACCEPTED') draft.reason = '';
  state.roomUi.dirty = true; state.roomUi.decisionContext = { proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion }; renderWorkspace({ preserveRoomDraft: true });
});

elements['workspace-content'].addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-room-form]'); if (!form) return; event.preventDefault();
  if (!state.project || state.roomMutationPending) return;
  const data = new FormData(form); const projectId = state.project.projectId; const { variant } = currentRoomVariant();
  if (form.dataset.roomForm === 'archetype') {
    const displayName = String(data.get('displayName')); const kind = String(data.get('kind')); const preferredWidth = Number(data.get('width')); const preferredHeight = Number(data.get('height'));
    const roomArchetypeId = stableUiId('archetype', displayName);
    await executeRoomMutation({ operation: 'room-archetype-create', target: roomArchetypeId, path: `/api/projects/${encodeURIComponent(projectId)}/room-archetypes`, body: {
      roomArchetypeId, kind, displayName, tags: [],
      dimensionPolicy: { width: { min: 3, preferred: preferredWidth, max: 64 }, height: { min: 3, preferred: preferredHeight, max: 64 } },
      structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: kind === 'hallway' ? 'horizontal' : 'any',
      connectorPolicy: kind === 'hallway' ? { min: 2, max: 32, requiredSides: ['east', 'west'] } : { min: 1, max: 32, requiredSides: [] },
      allowedAssetKinds: ['surface', 'prop', 'item'], allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [],
    }, successMessage: `${kind} archetype created.` });
    return;
  }
  if (form.dataset.roomForm === 'variant') {
    const roomArchetypeId = String(data.get('roomArchetypeId')); const archetype = currentRoomLibrary().archetypes.find((candidate) => candidate.roomArchetypeId === roomArchetypeId);
    const displayName = String(data.get('displayName')); const roomVariantId = stableUiId('room', displayName);
    const width = Number(data.get('width')); const height = Number(data.get('height'));
    const connectors = archetype?.kind === 'hallway' ? [
      { connectorId: stableUiId('connector', 'west'), side: 'west', offset: 1, width: 1, kind: 'opening', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: null },
      { connectorId: stableUiId('connector', 'east'), side: 'east', offset: 1, width: 1, kind: 'opening', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: null },
    ] : [{ connectorId: stableUiId('connector', 'north'), side: 'north', offset: Math.max(0, Math.floor(width / 2)), width: 1, kind: 'opening', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: null }];
    const intentTrace = ['game_design', 'level_design', 'room_design'].map((layer) => ({ layer, ruleId: `ui:${layer}`, summary: `Owner-authored ${layer.replace('_', ' ')} intent`, disposition: 'governing' }));
    const created = await executeRoomMutation({ operation: 'room-variant-create', target: roomVariantId, path: `/api/projects/${encodeURIComponent(projectId)}/rooms`, body: {
      roomVariantId, roomArchetypeId, archetypeVersion: archetype.version, displayName, width, height, intentTrace, connectors, placements: [],
    }, successMessage: `${archetype.kind} DRAFT created.` });
    if (created) state.roomUi.selectedRoomVariantId = roomVariantId; return;
  }
  if (!variant) return;
  const basePath = `/api/projects/${encodeURIComponent(projectId)}/rooms/${encodeURIComponent(variant.roomVariantId)}`;
  if (form.dataset.roomForm === 'shape-coordinates') {
    const parseCells = (value, label) => {
      const seen = new Set(); const cells = [];
      for (const [index, line] of String(value).split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        const match = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(line);
        if (!match) throw new Error(`${label} line ${index + 1} must be x,y.`);
        const cell = { x: Number(match[1]), y: Number(match[2]) }; const key = `${cell.x},${cell.y}`;
        if (cell.x >= variant.width || cell.y >= variant.height) throw new Error(`${label} cell ${key} is outside ${variant.width}×${variant.height}.`);
        if (seen.has(key)) throw new Error(`${label} repeats ${key}.`); seen.add(key); cells.push(cell);
      }
      return cells.sort((left, right) => left.y - right.y || left.x - right.x);
    };
    try {
      const voidCells = parseCells(data.get('voidCells'), 'Outside-room coordinates');
      const blockedCells = parseCells(data.get('blockedCells'), 'Blocked coordinates'); const voidKeys = new Set(voidCells.map(({ x, y }) => `${x},${y}`));
      const overlap = blockedCells.find(({ x, y }) => voidKeys.has(`${x},${y}`));
      if (overlap) throw new Error(`Cell ${overlap.x},${overlap.y} cannot be both outside and blocked.`);
      const draft = roomShapeDraft(variant); const changed = JSON.stringify(draft.voidCells) !== JSON.stringify(voidCells) || JSON.stringify(draft.blockedCells) !== JSON.stringify(blockedCells);
      draft.voidCells = voidCells; draft.blockedCells = blockedCells; draft.dirty = roomShapeDraftChanged(variant, draft); state.roomUi.shapeConflict = null;
      state.roomUi.lastShapeEdit = changed ? 'Structured coordinates applied to the local draft.' : 'Structured coordinates already match the draft.';
      renderWorkspace({ preserveRoomDraft: true });
    } catch (error) { showToast(`SHAPE_COORDINATES_INVALID: ${error.message}`); }
    return;
  }
  if (form.dataset.roomForm === 'resize') {
    const width = Number(data.get('width')); const height = Number(data.get('height'));
    const clippedPlacements = variant.placements.filter((placement) => { const span = roomAssetSpan(exactRoomAsset(placement), placement.rotation); return placement.anchor.x + span.width > width || placement.anchor.y + span.height > height; });
    const clippedConnectors = variant.connectors.filter((connector) => { const edge = connector.side === 'north' || connector.side === 'south' ? width : height; return connector.offset + connector.width > edge; });
    if ((clippedPlacements.length || clippedConnectors.length) && !window.confirm(`Resize requires explicit removal of ${clippedPlacements.length} clipped placement(s) and ${clippedConnectors.length} clipped connector(s). Continue?`)) return;
    await executeRoomMutation({ operation: 'room-resize', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/resize`, body: { expectedRoomVariantVersion: variant.version, width, height, removePlacementIds: clippedPlacements.map(({ placementId }) => placementId), removeConnectorIds: clippedConnectors.map(({ connectorId }) => connectorId) }, successMessage: `Room resized to ${width}×${height}.` }); return;
  }
  if (form.dataset.roomForm === 'connector') {
    const next = [...variant.connectors, { connectorId: stableUiId('connector', String(data.get('side'))), side: String(data.get('side')), offset: Number(data.get('offset')), width: Number(data.get('width')), kind: 'opening', clearanceInside: Number(data.get('clearanceInside')), clearanceOutside: 1, required: true, tags: [], compatibilityProfile: null }];
    await executeRoomMutation({ operation: 'room-connectors-set', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/connectors`, body: { expectedRoomVariantVersion: variant.version, connectors: next }, successMessage: 'Connector aperture added.' }); return;
  }
  if (form.dataset.roomForm === 'intent') {
    const intentTrace = ['game_design', 'level_design', 'room_design'].map((layer) => ({ layer, ruleId: `ui:${layer}`, summary: String(data.get(layer)), disposition: 'governing' }));
    await executeRoomMutation({ operation: 'room-intent-set', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/intent`, body: { expectedRoomVariantVersion: variant.version, intentTrace }, successMessage: 'Three-layer room intent trace saved.' });
  }
});

elements['workspace-content'].addEventListener('click', async (event) => {
  const control = event.target.closest('[data-room-control]'); if (!control || state.workspace !== 'rooms') return;
  const action = control.dataset.roomControl;
  if (['palette-search', 'layer', 'room-select', 'proposal-select', 'proposal-disposition', 'proposal-reason'].includes(action)) return;
  const { variant } = currentRoomVariant();
  if (action === 'editor-tool') {
    const tool = control.dataset.editorTool;
    state.roomUi.activeTool = tool; state.roomUi.dockPanel = 'tool'; state.roomUi.selectedPaletteAssetId = null;
    renderWorkspace({ preserveRoomDraft: true, preserveRoomCanvas: true }); settleRoomEditorControlFocus(`room-tool-${tool}`); return;
  }
  if (action === 'editor-panel') {
    const panel = control.dataset.editorPanel;
    state.roomUi.dockPanel = panel; renderWorkspace({ preserveRoomDraft: true, preserveRoomCanvas: true }); settleRoomEditorControlFocus(`room-panel-${panel}`); return;
  }
  if (action === 'zoom') { state.roomUi.zoom = control.dataset.roomZoom; renderWorkspace({ preserveRoomDraft: true }); return; }
  if (action === 'palette-asset') {
    const asset = currentAssetLibrary().assets.find(({ assetId }) => assetId === control.dataset.paletteAssetId);
    if (asset && ['prop', 'item'].includes(asset.kind)) {
      state.roomUi.previewAssetId = asset.assetId; state.roomUi.selectedPaletteAssetId = null;
    } else state.roomUi.selectedPaletteAssetId = control.dataset.paletteAssetId;
    state.roomUi.selectedPlacementId = null; state.roomUi.selectedConnectorId = null; renderWorkspace({ preserveRoomDraft: true }); return;
  }
  if (action === 'use-preview-asset') { state.roomUi.selectedPaletteAssetId = control.dataset.paletteAssetId; state.roomUi.previewAssetId = control.dataset.paletteAssetId; renderWorkspace({ preserveRoomDraft: true }); return; }
  if (action === 'close-preview-asset') { state.roomUi.previewAssetId = null; state.roomUi.selectedPaletteAssetId = null; renderWorkspace({ preserveRoomDraft: true }); return; }
  if (action === 'shape-reset' && variant) {
    if (state.roomUi.shapeDraft?.dirty && !window.confirm('Discard the unsaved shape changes and reload the saved room version?')) return;
    state.roomUi.shapeDraft = null; state.roomUi.shapeConflict = null; state.roomUi.lastShapeEdit = 'Saved shape reloaded.'; roomShapeDraft(variant); renderWorkspace({ preserveRoomDraft: true }); return;
  }
  if (action === 'placement-select') { state.roomUi.selectedPlacementId = control.dataset.placementId; state.roomUi.selectedPaletteAssetId = null; state.roomUi.selectedConnectorId = null; renderWorkspace({ preserveRoomDraft: true }); return; }
  if (action === 'connector-select') { state.roomUi.selectedConnectorId = control.dataset.connectorId; state.roomUi.selectedPlacementId = null; state.roomUi.selectedPaletteAssetId = null; renderWorkspace({ preserveRoomDraft: true }); return; }
  if (action === 'finding') {
    if (control.dataset.targetKind === 'roomPlacement') { state.roomUi.selectedPlacementId = control.dataset.targetId; state.roomUi.selectedConnectorId = null; }
    if (control.dataset.targetKind === 'roomConnector') { state.roomUi.selectedConnectorId = control.dataset.targetId; state.roomUi.selectedPlacementId = null; }
    renderWorkspace({ preserveRoomDraft: true }); return;
  }
  if (!variant || !state.project || state.roomMutationPending) return;
  const projectId = state.project.projectId; const basePath = `/api/projects/${encodeURIComponent(projectId)}/rooms/${encodeURIComponent(variant.roomVariantId)}`;
  if (action === 'shape-save') {
    const draft = roomShapeDraft(variant); if (!draft?.dirty || state.roomUi.shapeConflict) return;
    if (!window.confirm(`Save the complete shape with ${draft.voidCells.length} outside and ${draft.blockedCells.length} blocked cells as a new room version?`)) return;
    await executeRoomMutation({
      operation: 'room-shape-set', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/shape`,
      body: { expectedRoomVariantVersion: variant.version, voidCells: draft.voidCells, blockedCells: draft.blockedCells },
      successMessage: 'Room shape saved as a new immutable version.', onBeforeReload: () => { draft.dirty = false; },
    });
    return;
  }
  if (action === 'cell') {
    const anchor = { x: Number(control.dataset.x), y: Number(control.dataset.y) };
    if (state.roomUi.activeTool.startsWith('PAINT_')) {
      const draft = roomShapeDraft(variant); if (variant.lifecycle !== 'DRAFT' || state.roomUi.shapeConflict) return;
      const targetKind = { PAINT_ROOM: 'ROOM', PAINT_VOID: 'VOID', PAINT_BLOCKED: 'BLOCKED' }[state.roomUi.activeTool];
      if (roomCellKind(variant, anchor.x, anchor.y) === targetKind) {
        state.roomUi.lastShapeEdit = `Cell ${anchor.x},${anchor.y} is already ${targetKind === 'ROOM' ? 'room floor' : targetKind === 'VOID' ? 'outside room' : 'blocked in room'}.`;
        renderWorkspace({ preserveRoomDraft: true }); return;
      }
      const key = `${anchor.x},${anchor.y}`;
      draft.voidCells = draft.voidCells.filter((cell) => `${cell.x},${cell.y}` !== key);
      draft.blockedCells = draft.blockedCells.filter((cell) => `${cell.x},${cell.y}` !== key);
      if (targetKind === 'VOID') draft.voidCells.push(anchor);
      if (targetKind === 'BLOCKED') draft.blockedCells.push(anchor);
      draft.voidCells.sort((left, right) => left.y - right.y || left.x - right.x);
      draft.blockedCells.sort((left, right) => left.y - right.y || left.x - right.x);
      draft.dirty = roomShapeDraftChanged(variant, draft); state.roomUi.lastShapeEdit = `Cell ${anchor.x},${anchor.y} painted ${targetKind === 'ROOM' ? 'room floor' : targetKind === 'VOID' ? 'outside room' : 'blocked in room'}.`;
      renderWorkspace({ preserveRoomDraft: true }); return;
    }
    if (variant.lifecycle !== 'DRAFT') { showToast(`${variant.lifecycle} room versions are read-only.`); return; }
    if (control.dataset.cellKind !== 'ROOM') { showToast('Choose an ordinary room cell for placement. Outside and blocked cells cannot hold this content.'); return; }
    if (state.roomUi.selectedPlacementId) {
      const placement = variant.placements.find(({ placementId }) => placementId === state.roomUi.selectedPlacementId); if (!placement) return;
      await executeRoomMutation({ operation: 'room-placement-move', target: `${placement.placementId}:${variant.version}`, path: `${basePath}/placements-move`, body: { expectedRoomVariantVersion: variant.version, moves: [{ placementId: placement.placementId, expectedAssetId: placement.assetId, anchor, rotation: placement.rotation }] }, successMessage: `Placement moved to ${anchor.x},${anchor.y}.` }); return;
    }
    const asset = currentAssetLibrary().assets.find(({ assetId }) => assetId === state.roomUi.selectedPaletteAssetId); if (!asset) return;
    const placementId = stableUiId('placement', asset.name);
    await executeRoomMutation({ operation: 'room-placement-add', target: placementId, path: `${basePath}/placements-add`, body: { expectedRoomVariantVersion: variant.version, placements: [{ placementId, assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, layer: asset.kind === 'surface' ? 'STRUCTURAL_SURFACE' : 'SET_DRESSING', anchor, rotation: 0, variantTag: null, proposalId: null, proposalItemId: null }] }, successMessage: `${asset.name} placed at ${anchor.x},${anchor.y}.` });
    return;
  }
  if (['move-placement', 'rotate-placement'].includes(action)) {
    const placement = variant.placements.find(({ placementId }) => placementId === control.dataset.placementId); if (!placement) return;
    const anchor = action === 'move-placement' ? { x: placement.anchor.x + Number(control.dataset.dx), y: placement.anchor.y + Number(control.dataset.dy) } : placement.anchor;
    const rotation = action === 'rotate-placement' ? (placement.rotation + 90) % 360 : placement.rotation;
    await executeRoomMutation({ operation: 'room-placement-move', target: `${placement.placementId}:${variant.version}`, path: `${basePath}/placements-move`, body: { expectedRoomVariantVersion: variant.version, moves: [{ placementId: placement.placementId, expectedAssetId: placement.assetId, anchor, rotation }] }, successMessage: action === 'rotate-placement' ? 'Placement rotated.' : `Placement moved to ${anchor.x},${anchor.y}.` }); return;
  }
  if (action === 'remove-placement') {
    const placement = variant.placements.find(({ placementId }) => placementId === control.dataset.placementId); if (!placement || !window.confirm(`Remove placement ${placement.placementId}? The prior immutable room version remains available.`)) return;
    await executeRoomMutation({ operation: 'room-placement-remove', target: `${placement.placementId}:${variant.version}`, path: `${basePath}/placements-remove`, body: { expectedRoomVariantVersion: variant.version, placements: [{ placementId: placement.placementId, expectedAssetId: placement.assetId }] }, successMessage: 'Placement removed in a new room version.' }); return;
  }
  if (action === 'remove-connector') {
    if (!window.confirm(`Remove connector ${control.dataset.connectorId}?`)) return;
    await executeRoomMutation({ operation: 'room-connectors-set', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/connectors`, body: { expectedRoomVariantVersion: variant.version, connectors: variant.connectors.filter(({ connectorId }) => connectorId !== control.dataset.connectorId) }, successMessage: 'Connector removed in a new room version.' }); return;
  }
  if (action === 'warning-save') {
    const acceptedWarningFindingIds = [...elements['workspace-content'].querySelectorAll('[data-room-warning]:checked')].map((input) => input.dataset.roomWarning);
    await executeRoomMutation({ operation: 'room-warning-save', target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/warning-dispositions`, body: { expectedRoomVariantVersion: variant.version, acceptedWarningFindingIds }, successMessage: 'Current warning dispositions saved.' }); return;
  }
  if (['validate', 'finalize', 'fork'].includes(action)) {
    const messages = { validate: 'Validate this DRAFT as a new immutable version?', finalize: 'Finalize this VALIDATED room? Further edits require an explicit fork.', fork: 'Fork this FINAL room into a new editable DRAFT version?' };
    if (!window.confirm(messages[action])) return;
    await executeRoomMutation({ operation: `room-${action}`, target: `${variant.roomVariantId}:${variant.version}`, path: `${basePath}/${action}`, body: { expectedRoomVariantVersion: variant.version, confirm: true }, successMessage: action === 'fork' ? 'FINAL room forked to a new DRAFT version.' : `Room ${action} complete.` }); return;
  }
  if (action === 'proposal-decide') {
    const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === control.dataset.proposalId);
    if (!proposal || proposal.state !== 'PENDING' || state.roomUi.conflict?.proposalId === proposal.proposalId) { showToast('ROOM_PROPOSAL_CONTEXT_CHANGED: Reload before deciding.'); return; }
    const decisions = [];
    for (const item of proposal.items) {
      const draft = roomProposalDraft(proposal, item); const reason = draft.reason.trim();
      if (draft.disposition === 'REJECTED' && !reason) { showToast(`A rejection reason is required for ${item.itemId}.`); return; }
      decisions.push({ itemId: item.itemId, disposition: draft.disposition, reason: draft.disposition === 'REJECTED' ? reason : null });
    }
    if (!window.confirm(`Record a complete ${decisions.length}-item owner decision?`)) return;
    const success = await executeRoomMutation({ operation: 'room-proposal-decision', target: proposal.proposalId, path: `/api/projects/${encodeURIComponent(projectId)}/room-proposals/${encodeURIComponent(proposal.proposalId)}/decision`, body: { expectedProposalVersion: proposal.proposalVersion, decisions, confirm: true }, successMessage: 'Complete room proposal decision recorded.' });
    if (success) { delete state.roomUi.decisionDrafts[proposal.proposalId]; state.roomUi.dirty = false; state.roomUi.conflict = null; } return;
  }
  if (action === 'proposal-apply') {
    const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === control.dataset.proposalId); if (!proposal || proposal.state !== 'DECIDED') return;
    const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED').length;
    if (!window.confirm(`Atomically apply exactly ${accepted} accepted placement change(s)?`)) return;
    await executeRoomMutation({ operation: 'room-proposal-apply', target: proposal.proposalId, path: `/api/projects/${encodeURIComponent(projectId)}/room-proposals/${encodeURIComponent(proposal.proposalId)}/apply`, body: { expectedProposalVersion: proposal.proposalVersion, confirm: true }, successMessage: `Applied ${accepted} accepted room placement change(s) atomically.` });
  }
});

async function executeTaskRequest(path, body, successMessage) {
  if (!state.project || !state.agentAccessCsrf || state.taskMutationPending) return null;
  const projectId = state.project.projectId;
  state.taskMutationPending = true; updateMutationControls();
  try {
    const result = await api(path, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify(body),
    });
    await loadProject(projectId, { preserveWorkspaceIfUnchanged: true });
    showToast(successMessage); return result;
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`); return null;
  } finally {
    const preserveTaskComposer = hasLiveTaskComposer();
    state.taskMutationPending = false; updateMutationControls();
    if (!preserveTaskComposer) renderWorkspace();
  }
}

elements['workspace-content'].addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-task-form="create"]');
  if (!form || state.workspace !== 'tasks') return;
  event.preventDefault();
  const data = new FormData(form); const projectId = state.project?.projectId; if (!projectId) return;
  const capabilities = ['project.read', ...form.querySelectorAll('input[name="capability"]:checked:not(:disabled)')].map((entry) => (
    typeof entry === 'string' ? entry : entry.value
  ));
  const autoAccept = data.get('autoAccept') === 'on';
  const token = crypto.randomUUID();
  const result = await executeTaskRequest(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
    task: {
      taskId: `task.ui.${token}`,
      branchId: `branch.task.ui.${token}`,
      agentId: String(data.get('agentId')),
      title: String(data.get('title')),
      objective: String(data.get('objective')),
      capabilities,
      objectScopes: [{ kind: 'project', id: projectId }],
      budget: { maxCommands: Number(data.get('maxCommands')), maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: new Date(Date.now() + (Number(data.get('expiryHours')) * 60 * 60 * 1000)).toISOString(),
      autoAcceptPolicy: autoAccept
        ? { enabled: true, allowedCommandTypes: ['room.variant.intent.set'], maxChanges: 2 }
        : { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, 'Task created. The agent can only work within the limits you selected.');
  if (result?.task?.taskId) {
    state.taskUi.selectedTaskId = result.task.taskId;
    state.taskUi.view = 'detail';
    renderWorkspace();
  }
});

elements['workspace-content'].addEventListener('click', async (event) => {
  const control = event.target.closest('[data-task-control]');
  if (!control || state.workspace !== 'tasks' || !state.project) return;
  const action = control.dataset.taskControl;
  if (action === 'open-create') { state.taskUi.view = 'create'; state.taskUi.selectedTaskId = null; renderWorkspace(); return; }
  if (action === 'back-to-list') { state.taskUi.view = 'list'; state.taskUi.selectedTaskId = null; renderWorkspace(); return; }
  if (action === 'select') {
    state.taskUi.selectedTaskId = control.dataset.taskId; state.taskUi.view = 'detail'; renderWorkspace(); return;
  }
  const entry = state.tasks.find(({ task }) => task.taskId === state.taskUi.selectedTaskId);
  if (!entry) return;
  const projectId = state.project.projectId; const taskId = entry.task.taskId;
  const taskBase = `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
  if (['pause', 'resume', 'cancel', 'reject'].includes(action)) {
    if (action === 'cancel' && !window.confirm('Cancel this task? The assigned agent will no longer be able to change it, but its previous work and history will remain available.')) return;
    if (action === 'reject' && !window.confirm('End this task without adding its changes? The assigned agent will no longer be able to change it. The task history remains available.')) return;
    await executeTaskRequest(`${taskBase}/${action}`, { reason: action === 'pause' ? 'Paused from the human task workspace.' : `${action} from the human task workspace.` }, `Task ${action} recorded.`); return;
  }
  if (action === 'submit-review') {
    await executeTaskRequest(`${taskBase}/submit-review`, { reviewId: `review.${taskId}.${crypto.randomUUID().slice(0, 8)}` }, 'The task result is waiting for review.'); return;
  }
  if (action === 'decide') {
    const decisions = [...elements['workspace-content'].querySelectorAll('[data-task-review-disposition]')]
      .filter((select) => select.value !== 'AUTO_ACCEPTED_BY_POLICY' && select.value !== 'PENDING')
      .map((select) => ({ changeId: select.dataset.taskReviewDisposition, disposition: select.value, reason: null }));
    const undecided = [...elements['workspace-content'].querySelectorAll('[data-task-review-disposition]')]
      .some((select) => select.value === 'PENDING');
    if (undecided) { showToast('Every non-policy change needs an accept, reject, or request-changes decision.'); return; }
    if (!decisions.length || !window.confirm(`Save your decision for ${decisions.length} proposed change(s)?`)) return;
    await executeTaskRequest(`${taskBase}/reviews/${encodeURIComponent(entry.review.reviewId)}/decide`, { decisions, confirm: true }, 'Your review decisions were saved.'); return;
  }
  if (action === 'merge') {
    const blockedReason = taskMergeBlockedReason(entry.review);
    if (blockedReason) { showToast(blockedReason); return; }
    if (!window.confirm('Add the accepted changes to the project and complete this task? The assigned agent will no longer be able to make changes for this task.')) return;
    await executeTaskRequest(`${taskBase}/reviews/${encodeURIComponent(entry.review.reviewId)}/merge`, { mergeId: `merge.${taskId}`, confirm: true }, 'Accepted changes added to the project. The task is complete and the agent can no longer change it.'); return;
  }
  if (action === 'revert') {
    if (!window.confirm('Undo the project changes from this completed task? The original task and review will remain in the history.')) return;
    await executeTaskRequest(`/api/projects/${encodeURIComponent(projectId)}/task-merges/${encodeURIComponent(entry.review.mergeId)}/revert`, { revertId: `revert.${entry.review.mergeId}`, confirm: true }, 'The task changes were undone. The original task and review remain in the history.');
  }
});

elements['workspace-nav'].addEventListener('click', (event) => {
  const link = event.target.closest('[data-workspace]');
  if (!link) return;
  if (state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending || state.taskMutationPending) { event.preventDefault(); return; }
  state.workspace = link.dataset.workspace; location.hash = state.workspace; renderWorkspace();
  void publishVisualEvidence();
});
elements['project-select'].addEventListener('change', () => {
  if (state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending || state.taskMutationPending) {
    elements['project-select'].value = state.project?.projectId ?? '';
    return;
  }
  void loadProject(elements['project-select'].value);
});
elements['refresh-button'].addEventListener('click', () => {
  if (!state.cutterPending && !state.sourceMutationPending && !state.assetMutationPending && !state.roomMutationPending && !state.taskMutationPending) void refresh({ passive: true });
});
elements['agent-access-select'].addEventListener('change', () => {
  if (state.sourceMutationPending) return;
  const mode = elements['agent-access-select'].value;
  if (mode === 'custom' || mode === 'propose_draft') {
    requestAgentAccess(mode);
    return;
  }
  const currentMode = state.agentAccess?.mode ?? 'off';
  const broader = mode !== 'off' && mode !== currentMode;
  const preset = state.agentAccess?.presets?.[mode];
  const presetDetails = preset
    ? `\nScopes: ${preset.scopes.join(', ')}\nBranch: ${preset.branchId || 'none'}\nObjects: ${preset.objectScopes.map((scope) => `${scope.kind}:${scope.id}`).join(', ')}\nCommand budget: ${preset.budget.maxCommands}\nExpires: ${new Date(preset.expiresAt).toLocaleString()}`
    : '';
  const confirmed = !broader || window.confirm(
    `Replace Agent access “${currentMode.replaceAll('_', ' ')}” with “${mode.replaceAll('_', ' ')}”?\n\n`
    + `The service resolved the following immutable grant:${presetDetails}\n\nPublish is never included.`,
  );
  if (!confirmed) {
    renderAgentAccess();
    return;
  }
  requestAgentAccess(mode, { confirmBroaderAccess: broader });
});
elements['agent-access-state'].addEventListener('click', () => {
  setAgentAccessPanel(elements['agent-access-panel'].hidden);
});
elements['agent-access-close'].addEventListener('click', () => {
  setAgentAccessPanel(false);
  elements['agent-access-state'].focus();
});
document.addEventListener('keydown', (event) => {
  if (cutterDrag) return;
  if (event.key !== 'Escape' || elements['agent-access-panel'].hidden) return;
  setAgentAccessPanel(false);
  elements['agent-access-state'].focus();
});
document.addEventListener('click', (event) => {
  if (elements['agent-access-panel'].hidden || event.target.closest('.agent-access-control')) return;
  setAgentAccessPanel(false);
});
elements['agent-access-retry'].addEventListener('click', () => {
  if (!state.sourceMutationPending && state.pendingAgentAccess) {
    requestAgentAccess(state.pendingAgentAccess.mode, state.pendingAgentAccess);
  }
});
elements['agent-launcher-show'].addEventListener('click', () => {
  if (state.sourceMutationPending) return;
  state.showMcpLauncherConfig = !state.showMcpLauncherConfig;
  renderAgentAccess(); setAgentAccessPanel(true);
});
elements['agent-pending-list'].addEventListener('click', async (event) => {
  const button = event.target.closest('[data-approve-pending-host]');
  if (!button || !state.project || !state.agentAccessCsrf || state.sourceMutationPending) return;
  if (!window.confirm(`Authorize the waiting MCP host with verification code ${button.dataset.verificationCode}?`)) return;
  button.disabled = true;
  try {
    const response = await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/agent-access/bindings`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({
        pendingHostId: button.dataset.approvePendingHost,
        confirm: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    await loadProject(state.project.projectId);
    setAgentAccessPanel(true);
    showToast(response.idempotentReplay ? 'Original MCP host approval returned.' : 'MCP host authorized.');
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    await loadProject(state.project.projectId);
  }
});
elements['agent-binding-list'].addEventListener('click', async (event) => {
  const button = event.target.closest('[data-revoke-binding]');
  if (!button || !state.project || !state.agentAccessCsrf || state.sourceMutationPending) return;
  if (!window.confirm('Revoke this MCP connection? Its credential will stop working immediately.')) return;
  button.disabled = true;
  try {
    await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/agent-access/bindings/${encodeURIComponent(button.dataset.revokeBinding)}/revoke`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    });
    await loadProject(state.project.projectId);
    setAgentAccessPanel(true);
    showToast('MCP connection revoked.');
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    await loadProject(state.project.projectId);
  }
});
elements['agent-launcher-copy'].addEventListener('click', async () => {
  if (!state.mcpLauncherConfig) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.mcpLauncherConfig, null, 2));
    showToast('Secret-free MCP host setup copied.');
  } catch {
    showToast('Clipboard access was denied. Select and copy the configuration manually.');
  }
});
elements['workspace-content'].addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-cutter-grid-form]');
  if (!form || !state.project || !state.cutter || !state.agentAccessCsrf || state.sourceMutationPending) return;
  event.preventDefault();
  if (state.cutterPending) return;
  const fields = new FormData(form);
  const number = (name) => Number(fields.get(name));
  state.cutter.grid = Object.fromEntries(['rows', 'columns', 'top', 'right', 'bottom', 'left', 'gapX', 'gapY'].map((name) => [name, number(name)]));
  state.cutterPending = true; renderWorkspace();
  try {
    const response = await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/atlases/grid-proposal`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({
        expectedRevision: state.project.revision,
        sourceId: state.cutter.sourceId,
        rows: state.cutter.grid.rows,
        columns: state.cutter.grid.columns,
        margins: {
          top: state.cutter.grid.top, right: state.cutter.grid.right,
          bottom: state.cutter.grid.bottom, left: state.cutter.grid.left,
        },
        gapX: state.cutter.grid.gapX,
        gapY: state.cutter.grid.gapY,
        rectangleIdPrefix: `rect.${state.cutter.atlasId}`.slice(0, 122),
      }),
    });
    if (response.proposal.findings.length) {
      showToast(response.proposal.findings.map((finding) => finding.message).join(' '));
    } else {
      state.cutter.rectangles = structuredClone(response.proposal.rectangles);
      markCutterDefinitionDirty();
      showToast(`${response.proposal.rectangles.length} source-resolution rectangles proposed.`);
    }
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
  } finally {
    state.cutterPending = false; renderWorkspace();
  }
});

elements['workspace-content'].addEventListener('change', (event) => {
  const sourceFile = event.target.closest('[data-source-file]');
  if (sourceFile) {
    state.sourceFileChooserActive = false;
    const status = sourceFile.closest('[data-source-intake-form]')?.querySelector('[data-source-status]');
    const selected = sourceFile.files?.[0];
    if (status) status.textContent = selected
      ? `Selected ${selected.name} (${selected.size.toLocaleString()} bytes). Ready to import.`
      : '';
    return;
  }
  if (!state.cutter || state.sourceMutationPending) return;
  const zoom = event.target.closest('[data-cutter-zoom]');
  if (zoom) { state.cutter.zoom = zoom.value; renderWorkspace(); return; }
  const grid = event.target.closest('[data-cutter-grid-toggle]');
  if (grid) { state.cutter.showGrid = grid.checked; renderWorkspace(); return; }
  const input = event.target.closest('[data-rectangle-index][data-rectangle-field]');
  if (!input) return;
  if (state.cutterPending) return;
  const rectangle = state.cutter.rectangles[Number(input.dataset.rectangleIndex)];
  if (!rectangle) return;
  const field = input.dataset.rectangleField;
  if (field === 'included') {
    rectangle.included = input.checked;
    if (!rectangle.included) {
      rectangle.replacesSliceId = null;
      rectangle.expectedSliceVersion = null;
    }
  } else if (field === 'replacesSliceId') {
    const slice = currentCutterAtlas()?.sliceHeads.find((candidate) => candidate.sliceId === input.value) ?? null;
    rectangle.replacesSliceId = slice?.sliceId ?? null;
    rectangle.expectedSliceVersion = slice?.version ?? null;
  } else rectangle[field] = Number(input.value);
  markCutterDefinitionDirty(); renderWorkspace();
});

elements['workspace-content'].addEventListener('click', (event) => {
  if (event.target.closest('[data-source-file]')) state.sourceFileChooserActive = true;
});

elements['workspace-content'].addEventListener('cancel', (event) => {
  if (event.target.closest('[data-source-file]')) state.sourceFileChooserActive = false;
});

window.addEventListener('focus', () => {
  if (!state.sourceFileChooserActive) return;
  setTimeout(() => { state.sourceFileChooserActive = false; }, 1000);
});

elements['workspace-content'].addEventListener('click', async (event) => {
  const open = event.target.closest('[data-open-cutter]');
  if (open) {
    if (state.cutterPending || state.sourceMutationPending) return;
    const source = state.project?.snapshot.sources.find((candidate) => candidate.id === open.dataset.openCutter);
    if (source) openCutter(source);
    return;
  }
  if (event.target.closest('[data-close-cutter]')) {
    if (state.cutterPending || state.sourceMutationPending) return;
    cancelCutterJobPolling();
    resetCutterScroll();
    state.cutter = null; state.cutterJob = null; state.cutterJobEvents = []; renderWorkspace(); return;
  }
  if (!state.cutter || !state.project || !state.agentAccessCsrf || state.sourceMutationPending) return;
  if (state.cutterPending) return;
  if (event.target.closest('[data-add-rectangle]')) {
    const source = state.project.snapshot.sources.find((candidate) => candidate.id === state.cutter.sourceId);
    state.cutter.rectangles.push({
      rectangleId: `rect.manual.${crypto.randomUUID()}`,
      x: 0, y: 0, width: Math.min(64, source.width), height: Math.min(64, source.height),
      included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null, expectedSliceVersion: null,
    });
    markCutterDefinitionDirty(); renderWorkspace(); return;
  }
  const atlas = currentCutterAtlas();
  const save = event.target.closest('[data-save-atlas]');
  const preview = event.target.closest('[data-preview-atlas]');
  const commit = event.target.closest('[data-commit-atlas]');
  const cancel = event.target.closest('[data-cancel-cutter-job]');
  const retry = event.target.closest('[data-retry-cutter-job]');
  const discard = event.target.closest('[data-discard-cutter-job]');
  if (!save && !preview && !commit && !cancel && !retry && !discard) return;
  const operationProjectId = state.project.projectId;
  const operationRevision = state.project.revision;
  const operationAtlasId = state.cutter.atlasId;
  const operationCutter = state.cutter;
  const operationCsrf = state.agentAccessCsrf;
  const operationJobId = state.cutterJob?.jobId ?? null;
  const operationJobAttempt = state.cutterJob?.attempt ?? null;
  const operationStillCurrent = () => state.project?.projectId === operationProjectId
    && state.cutter === operationCutter && state.cutter?.atlasId === operationAtlasId;
  const acceptJobMutationResponse = (response) => {
    const mutationAtlas = currentCutterAtlas();
    if (response?.projectId !== operationProjectId || response.job?.jobId !== operationJobId
        || response.job?.atlasId !== operationAtlasId
        || response.job?.sourceId !== operationCutter.sourceId
        || mutationAtlas?.sourceId !== operationCutter.sourceId
        || mutationAtlas?.latestPreviewJobId !== operationJobId) {
      cancelCutterJobPolling();
      const error = new Error('The job mutation response does not match the active cutter context.');
      error.code = 'CUTTER_CONTEXT_CHANGED';
      throw error;
    }
    state.cutterJob = response.job;
    state.cutterJobEvents = response.events ?? [];
  };
  setCutterPending(true); renderWorkspace();
  try {
    if (save) {
      const operation = operationCutter.operations.define ??= {
        expectedRevision: operationRevision,
        idempotencyKey: `atlas-define.${crypto.randomUUID()}`,
        sourceId: operationCutter.sourceId,
        name: operationCutter.name,
        expectedAtlasVersion: atlas?.definitionVersion ?? 0,
        rectangles: structuredClone(operationCutter.rectangles),
      };
      const response = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/atlases/${encodeURIComponent(operationAtlasId)}/definition`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      operationCutter.dirty = false; operationCutter.syncedVersion = response.value.definitionVersion;
      state.cutterJob = null; state.cutterJobEvents = [];
      invalidateCutterOperations();
      await loadProject(operationProjectId); showToast(`Atlas definition v${response.value.definitionVersion} saved.`);
    } else if (preview) {
      const operation = operationCutter.operations.preview ??= {
        expectedRevision: operationRevision,
        idempotencyKey: `atlas-preview.${crypto.randomUUID()}`,
        expectedAtlasVersion: atlas.definitionVersion,
        expectedDefinitionFingerprint: atlas.definitionFingerprint,
        jobId: `job.atlas.${crypto.randomUUID()}`,
      };
      await api(`/api/projects/${encodeURIComponent(operationProjectId)}/atlases/${encodeURIComponent(operationAtlasId)}/preview`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      await loadProject(operationProjectId);
      const loaded = await loadCutterJob(operation.jobId, { throwOnError: true });
      if (!loaded) {
        const error = new Error('The cutter context changed before the queued job could be reconciled.');
        error.code = 'CUTTER_CONTEXT_CHANGED';
        throw error;
      }
      operationCutter.operations.preview = null; operationCutter.operations.commit = null;
      showToast('Durable slice preview queued.');
    } else if (commit) {
      if (!window.confirm('Commit exactly these succeeded preview outputs as stable slice heads? This does not create semantic assets.')) return;
      const operation = operationCutter.operations.commit ??= {
        expectedRevision: operationRevision,
        idempotencyKey: `atlas-commit.${crypto.randomUUID()}`,
        expectedAtlasVersion: atlas.definitionVersion,
        expectedDefinitionFingerprint: atlas.definitionFingerprint,
        jobId: operationJobId,
      };
      const response = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/atlases/${encodeURIComponent(operationAtlasId)}/commit`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      state.cutterJob = { ...state.cutterJob, state: 'APPLIED', appliedRevision: response.revision };
      await loadProject(operationProjectId); void loadCutterJob(operationJobId); showToast('Slice heads committed atomically.');
      operationCutter.operations.commit = null;
    } else if (cancel) {
      const operation = operationCutter.operations.cancel ??= {
        operationIdempotencyKey: `job-cancel.${crypto.randomUUID()}`,
      };
      const response = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/jobs/${encodeURIComponent(operationJobId)}/cancel`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      acceptJobMutationResponse(response); operationCutter.operations.cancel = null; renderWorkspace();
      void loadCutterJob(operationJobId); showToast('Cancellation requested.');
    } else if (retry) {
      const operation = operationCutter.operations.retry ??= {
        expectedAttempt: operationJobAttempt,
        operationIdempotencyKey: `job-retry.${crypto.randomUUID()}`,
      };
      const response = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/jobs/${encodeURIComponent(operationJobId)}/retry`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      acceptJobMutationResponse(response); operationCutter.operations.retry = null; renderWorkspace();
      void loadCutterJob(operationJobId); showToast('A new durable attempt was queued.');
    } else if (discard) {
      if (!window.confirm('Discard this unapplied preview job and release its temporary outputs? The job cannot be committed afterward.')) return;
      const operation = operationCutter.operations.discard ??= {
        operationIdempotencyKey: `job-discard.${crypto.randomUUID()}`,
      };
      const response = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/jobs/${encodeURIComponent(operationJobId)}/discard`, {
        method: 'POST', headers: { 'x-numberdroid-studio-csrf': operationCsrf },
        body: JSON.stringify(operation),
      });
      if (!operationStillCurrent()) return;
      acceptJobMutationResponse(response); renderWorkspace();
      await loadProject(operationProjectId); void loadCutterJob(operationJobId);
      operationCutter.operations.discard = null; showToast('Temporary slice previews discarded.');
    }
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    if (state.project?.projectId === operationProjectId) await loadProject(operationProjectId).catch(() => {});
    const pendingJobId = operationCutter.operations.commit?.jobId ?? operationCutter.operations.preview?.jobId ?? operationJobId;
    if (pendingJobId) await loadCutterJob(pendingJobId).catch(() => {});
  } finally {
    setCutterPending(false); renderWorkspace();
  }
});

function cutterSvgPoint(svg, event) {
  if (!svg?.isConnected) return null;
  const screenMatrix = svg.getScreenCTM();
  if (!screenMatrix) return null;
  const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  return point.matrixTransform(screenMatrix.inverse());
}

elements['workspace-content'].addEventListener('pointerdown', (event) => {
  if (state.cutterPending || state.sourceMutationPending) return;
  const resize = event.target.closest('[data-cutter-resize]');
  const move = event.target.closest('[data-cutter-move]');
  const target = resize || move;
  if (!target || !state.cutter) return;
  const index = Number(target.dataset.cutterResize ?? target.dataset.cutterMove);
  const svg = target.closest('svg'); const point = cutterSvgPoint(svg, event);
  if (!point) return;
  cutterDrag = {
    index, mode: resize ? 'resize' : 'move', svg, start: point,
    original: { ...state.cutter.rectangles[index] }, target, pointerId: event.pointerId, changed: false,
  };
  target.setPointerCapture?.(event.pointerId); event.preventDefault();
});
elements['workspace-content'].addEventListener('pointermove', (event) => {
  if (!cutterDrag || !state.cutter || state.cutterPending || state.sourceMutationPending) return;
  const source = state.project.snapshot.sources.find((candidate) => candidate.id === state.cutter.sourceId);
  if (!source || !cutterDrag.svg.isConnected || !cutterDrag.target.isConnected) {
    settleCutterDrag();
    return;
  }
  const point = cutterSvgPoint(cutterDrag.svg, event);
  if (!point) {
    settleCutterDrag();
    return;
  }
  const dx = Math.round(point.x - cutterDrag.start.x); const dy = Math.round(point.y - cutterDrag.start.y);
  const rectangle = state.cutter.rectangles[cutterDrag.index];
  if (!rectangle) {
    settleCutterDrag();
    return;
  }
  if (cutterDrag.mode === 'move') {
    rectangle.x = Math.max(0, Math.min(source.width - rectangle.width, cutterDrag.original.x + dx));
    rectangle.y = Math.max(0, Math.min(source.height - rectangle.height, cutterDrag.original.y + dy));
  } else {
    rectangle.width = Math.max(1, Math.min(source.width - rectangle.x, cutterDrag.original.width + dx));
    rectangle.height = Math.max(1, Math.min(source.height - rectangle.y, cutterDrag.original.height + dy));
  }
  const geometryChanged = ['x', 'y', 'width', 'height']
    .some((field) => rectangle[field] !== cutterDrag.original[field]);
  if (geometryChanged && !cutterDrag.changed) {
    cutterDrag.changed = true;
    markCutterDefinitionDirty();
  }
  const group = cutterDrag.target.closest('g');
  if (!group || group.children.length < 3) {
    settleCutterDrag();
    return;
  }
  const [shape, label, handle] = group.children;
  shape.setAttribute('x', rectangle.x); shape.setAttribute('y', rectangle.y); shape.setAttribute('width', rectangle.width); shape.setAttribute('height', rectangle.height);
  label.setAttribute('x', rectangle.x + 10); label.setAttribute('y', rectangle.y + 24);
  handle.setAttribute('x', rectangle.x + rectangle.width - 12); handle.setAttribute('y', rectangle.y + rectangle.height - 12);
});
elements['workspace-content'].addEventListener('pointerup', settleCutterDrag);
elements['workspace-content'].addEventListener('pointercancel', settleCutterDrag);
elements['workspace-content'].addEventListener('lostpointercapture', settleCutterDrag);
elements['workspace-content'].addEventListener('keydown', (event) => {
  const resize = event.target.closest('[data-cutter-resize]');
  const move = event.target.closest('[data-cutter-move]');
  if ((!resize && !move) || !state.cutter || state.cutterPending || state.sourceMutationPending
      || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const index = Number((resize || move).dataset.cutterResize ?? (resize || move).dataset.cutterMove);
  const rectangle = state.cutter.rectangles[index];
  const source = state.project.snapshot.sources.find((candidate) => candidate.id === state.cutter.sourceId);
  const step = event.shiftKey ? 10 : 1;
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
  if (resize) {
    rectangle.width = Math.max(1, Math.min(source.width - rectangle.x, rectangle.width + dx));
    rectangle.height = Math.max(1, Math.min(source.height - rectangle.y, rectangle.height + dy));
  } else {
    rectangle.x = Math.max(0, Math.min(source.width - rectangle.width, rectangle.x + dx));
    rectangle.y = Math.max(0, Math.min(source.height - rectangle.height, rectangle.y + dy));
  }
  markCutterDefinitionDirty(); event.preventDefault(); renderWorkspace();
  const focusSelector = resize ? `[data-cutter-resize="${index}"]` : `[data-cutter-move="${index}"]`;
  requestAnimationFrame(() => document.querySelector(focusSelector)?.focus());
});

if (visualFixture) {
  const cutterPointerTrace = [];
  const recordCutterPointerEvent = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    cutterPointerTrace.push({
      sequence: cutterPointerTrace.length + 1,
      type: event.type,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      buttons: event.buttons,
      exactProbeTarget: target === window.__cutterDragProbeTarget,
      targetMoveIndex: target?.closest('[data-cutter-move]')?.dataset.cutterMove ?? null,
      targetConnected: target?.isConnected ?? false,
      hasPointerCapture: Boolean(target?.hasPointerCapture?.(event.pointerId)),
    });
    if (cutterPointerTrace.length > 24) cutterPointerTrace.shift();
  };
  for (const type of ['pointerdown', 'gotpointercapture', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    elements['workspace-content'].addEventListener(type, recordCutterPointerEvent);
  }
  window.__numberdroidStudioVisualTest = Object.freeze({
    resetCutterPointerTrace() {
      cutterPointerTrace.length = 0;
      return cutterPointerTrace.length;
    },
    clearCutterPointerTrace() {
      cutterPointerTrace.length = 0;
      return cutterPointerTrace.length;
    },
    forceChangedCutterProjectionRender() {
      if (!state.cutter || !state.cutterJob) return null;
      state.cutterJob = {
        ...state.cutterJob,
        visualFixtureProjectionMarker: (state.cutterJob.visualFixtureProjectionMarker ?? 0) + 1,
      };
      const marker = state.cutterJob.visualFixtureProjectionMarker;
      renderWorkspace({ preserveCutterDraft: true });
      return {
        marker,
        dragActive: Boolean(cutterDrag),
        deferred: state.cutterDeferredRender,
      };
    },
    cutterInteractionState() {
      return {
        dragActive: Boolean(cutterDrag),
        pointerId: cutterDrag?.pointerId ?? null,
        changed: cutterDrag?.changed ?? false,
        targetConnected: cutterDrag?.target?.isConnected ?? false,
        hasPointerCapture: Boolean(cutterDrag?.target?.hasPointerCapture?.(cutterDrag.pointerId)),
        deferred: state.cutterDeferredRender,
        dirty: state.cutter?.dirty ?? null,
        marker: state.cutterJob?.visualFixtureProjectionMarker ?? null,
        pointerTrace: cutterPointerTrace.slice(),
      };
    },
    async exerciseRoomShapeRefresh() {
      if (state.workspace !== 'rooms' || !state.roomUi.activeTool.startsWith('PAINT_')) return null;
      document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]')?.click();
      const draftCell = document.querySelector('.room-cell[data-x="1"][data-y="0"]');
      draftCell?.focus(); draftCell?.click();
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      const before = document.querySelector('.room-cell[data-x="1"][data-y="0"]');
      before?.focus();
      const beforeVoidCount = state.roomUi.shapeDraft?.voidCells.length ?? null;
      await loadProject(state.project.projectId, { preserveWorkspaceIfUnchanged: true });
      const after = document.querySelector('.room-cell[data-x="1"][data-y="0"]');
      return {
        beforeVoidCount,
        afterVoidCount: state.roomUi.shapeDraft?.voidCells.length ?? null,
        dirty: state.roomUi.shapeDraft?.dirty ?? false,
        focused: document.activeElement === after,
        sameNode: before === after,
      };
    },
    async exerciseRoomShapeConflict() {
      if (state.workspace !== 'rooms' || !state.roomUi.activeTool.startsWith('PAINT_')) return null;
      document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]')?.click();
      document.querySelector('.room-cell[data-x="1"][data-y="0"]')?.click();
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      const currentVariant = currentRoomVariant().variant;
      const blockedCells = currentVariant.blockedCells?.some(({ x, y }) => x === 2 && y === 2)
        ? [{ x: 1, y: 2 }] : [{ x: 2, y: 2 }];
      const response = await fetch(`/api/projects/${encodeURIComponent(state.project.projectId)}/rooms/${encodeURIComponent(currentVariant.roomVariantId)}/shape`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
        body: JSON.stringify({
          expectedRevision: state.project.revision,
          idempotencyKey: `visual.4-5.concurrent-shape.${state.project.revision}`,
          expectedRoomVariantVersion: currentVariant.version,
          voidCells: currentVariant.voidCells,
          blockedCells,
        }),
      });
      if (!response.ok) throw new Error(`Concurrent shape mutation failed: ${response.status}`);
      await loadProject(state.project.projectId, { preserveWorkspaceIfUnchanged: true });
      await publishVisualEvidence();
      return {
        dirty: state.roomUi.shapeDraft?.dirty ?? false,
        conflict: state.roomUi.shapeConflict,
        revision: state.project.revision,
      };
    },
    roomShapeState() {
      return {
        dirty: state.roomUi.shapeDraft?.dirty ?? false,
        conflict: state.roomUi.shapeConflict,
        voidCells: structuredClone(state.roomUi.shapeDraft?.voidCells ?? []),
        blockedCells: structuredClone(state.roomUi.shapeDraft?.blockedCells ?? []),
      };
    },
    async exerciseRoomCoordinateOverlapRejection() {
      const form = document.querySelector('[data-room-form="shape-coordinates"]');
      const before = structuredClone(state.roomUi.shapeDraft); if (!form || !before) return null;
      const coordinate = '2,0'; const voidInput = form.elements.voidCells; const blockedInput = form.elements.blockedCells;
      voidInput.value = `${voidInput.value}\n${coordinate}`; blockedInput.value = `${blockedInput.value}\n${coordinate}`;
      form.requestSubmit(); await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return {
        arraysUnchanged: JSON.stringify(state.roomUi.shapeDraft?.voidCells) === JSON.stringify(before.voidCells)
          && JSON.stringify(state.roomUi.shapeDraft?.blockedCells) === JSON.stringify(before.blockedCells),
        dirtyUnchanged: state.roomUi.shapeDraft?.dirty === before.dirty,
        message: elements.toast.textContent,
      };
    },
    async exerciseRoomDirtyMutationGuard() {
      const beforeRevision = state.project?.revision ?? null;
      const { variant } = currentRoomVariant();
      const accepted = await executeRoomMutation({
        operation: 'room-resize', target: `${variant.roomVariantId}:${variant.version}:visual-guard`,
        path: `/api/projects/${encodeURIComponent(state.project.projectId)}/rooms/${encodeURIComponent(variant.roomVariantId)}/resize`,
        body: { expectedRoomVariantVersion: variant.version, width: variant.width, height: variant.height, removePlacementIds: [], removeConnectorIds: [] },
        successMessage: 'Unexpected dirty-draft resize.',
      });
      return { accepted, beforeRevision, afterRevision: state.project?.revision ?? null, message: elements.toast.textContent };
    },
    async refreshVisualEvidence() {
      await publishVisualEvidence();
      const preview = document.querySelector('.room-placement-preview .useful-asset-preview');
      const image = preview?.querySelector('.asset-preview.ready img');
      return {
        ready: preview?.dataset.previewReady ?? null,
        loaded: Boolean(image?.complete && image.naturalWidth > 0),
      };
    },
  });
}

elements['workspace-content'].addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-source-intake-form]');
  if (!form) return;
  event.preventDefault();
  if (!state.project || !state.agentAccessCsrf || state.sourceMutationPending || state.cutterPending
    || elements['project-select'].value !== state.project.projectId) {
    showToast('Source import is unavailable while the project context is changing.');
    return;
  }
  const operationProjectId = state.project.projectId;
  const operationRevision = state.project.revision;
  const operationCsrf = state.agentAccessCsrf;
  const operationForm = form;
  const fields = new FormData(form);
  const file = fields.get('file');
  const stagedIntake = state.sourceIntakes.find((intake) => (
    intake.state === 'STAGED' && intake.intakeId === state.resumingIntakeId
  ));
  if (!stagedIntake && (!(file instanceof File) || file.size === 0)) return;
  const sourceOrigin = stagedIntake?.origin ?? String(fields.get('origin'));
  state.sourceDraft = {
    sourceId: String(fields.get('sourceId')), name: String(fields.get('name')), origin: sourceOrigin,
    prompt: String(fields.get('prompt') ?? ''), provider: String(fields.get('provider') ?? ''),
    model: String(fields.get('model') ?? ''), modelVersion: String(fields.get('modelVersion') ?? ''),
  };
  const status = form.querySelector('[data-source-status]');
  const submit = form.querySelector('button[type="submit"]');
  const uploadIdempotencyKey = stagedIntake
    ? null
    : sourceOperationKey('source-intake-upload', 'pending', operationProjectId);
  const commitIdempotencyTarget = stagedIntake?.intakeId ?? 'pending';
  const commitIdempotencyKey = sourceOperationKey(
    'source-intake-commit', commitIdempotencyTarget, operationProjectId,
  );
  const operationIsCurrent = () => (
    state.sourceMutationPending
    && state.project?.projectId === operationProjectId
    && state.project.revision === operationRevision
    && state.agentAccessCsrf === operationCsrf
    && sourceIntakeFormCache === operationForm
  );
  const assertOperationCurrent = () => {
    if (operationIsCurrent()) return;
    const error = new Error('The source import context changed before the operation completed. No further mutation was sent.');
    error.code = 'SOURCE_INTAKE_CONTEXT_CHANGED';
    throw error;
  };
  setSourceMutationPending(true); form.setAttribute('aria-busy', 'true'); submit.disabled = true;
  status.textContent = stagedIntake ? 'Committing staged source…' : 'Verifying and staging source…';
  let intake = stagedIntake ? { intakeId: stagedIntake.intakeId, artifact: stagedIntake.intake.artifact } : null;
  let durableIntakeReady = Boolean(stagedIntake);
  try {
    if (!intake) {
      const expectedDigest = await sha256Hex(file);
      assertOperationCurrent();
      intake = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/source-intakes`, {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-numberdroid-studio-csrf': operationCsrf,
          'x-numberdroid-idempotency-key': uploadIdempotencyKey,
          'x-numberdroid-source-origin': sourceOrigin,
          'x-numberdroid-expected-sha256': expectedDigest,
        },
        body: file,
      });
      assertOperationCurrent();
      if (intake?.schemaVersion !== 1 || intake.projectId !== operationProjectId
        || typeof intake.intakeId !== 'string' || !intake.intakeId
        || !intake.artifact || typeof intake.artifact.uri !== 'string') {
        const error = new Error('The source intake response did not match the captured project context.');
        error.code = 'SOURCE_INTAKE_CONTEXT_CHANGED';
        throw error;
      }
      clearSourceOperationKey('source-intake-upload', 'pending', operationProjectId);
      if (!state.sourceIntakes.some((candidate) => candidate.intakeId === intake.intakeId)) {
        state.sourceIntakes.push({
          schemaVersion: 1,
          projectId: operationProjectId,
          intakeId: intake.intakeId,
          state: 'STAGED',
          origin: sourceOrigin,
          intake: { artifact: intake.artifact },
        });
      }
      state.resumingIntakeId = intake.intakeId;
      durableIntakeReady = true;
      status.textContent = 'Source staged; committing semantic revision…';
    }
    assertOperationCurrent();
    const nullable = (value) => String(value || '').trim() || null;
    const generated = sourceOrigin === 'imported_generation';
    const committed = await api(`/api/projects/${encodeURIComponent(operationProjectId)}/sources`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': operationCsrf },
      body: JSON.stringify({
        expectedRevision: operationRevision,
        idempotencyKey: commitIdempotencyKey,
        intakeId: intake.intakeId,
        sourceId: String(fields.get('sourceId')),
        name: String(fields.get('name')),
        artifactUri: intake.artifact.uri,
        mediaType: intake.artifact.mediaType,
        byteSize: intake.artifact.byteSize,
        width: intake.artifact.width,
        height: intake.artifact.height,
        provenance: {
          origin: sourceOrigin,
          prompt: generated ? nullable(fields.get('prompt')) : null,
          negativePrompt: null,
          seed: null,
          provider: generated ? nullable(fields.get('provider')) : null,
          model: generated ? nullable(fields.get('model')) : null,
          modelVersion: generated ? nullable(fields.get('modelVersion')) : null,
          generator: null,
          parameters: {},
          referenceArtifactUris: [],
          parentSourceIds: [],
        },
      }),
    });
    assertOperationCurrent();
    if (committed?.schemaVersion !== 1 || committed.projectId !== operationProjectId
      || committed.revision !== operationRevision + 1) {
      const error = new Error('The source commit response did not match the captured project and revision context.');
      error.code = 'SOURCE_INTAKE_CONTEXT_CHANGED';
      throw error;
    }
    clearSourceOperationKey('source-intake-commit', commitIdempotencyTarget, operationProjectId);
    state.sourceDraft = null; state.resumingIntakeId = null; resetSourceIntakeForm();
    await loadProject(operationProjectId);
    showToast('Source imported through an atomic intake claim.');
  } catch (error) {
    const errorText = `${error.code || 'ERROR'}: ${error.message}`;
    status.textContent = errorText;
    const needsStagedRecovery = durableIntakeReady && intake && state.resumingIntakeId === intake.intakeId;
    if (needsStagedRecovery) resetSourceIntakeForm();
    const projectReloaded = state.project?.projectId === operationProjectId
      ? await loadProject(operationProjectId).catch(() => false)
      : false;
    if (needsStagedRecovery && !projectReloaded) renderWorkspace();
    const stillStaged = durableIntakeReady && intake
      && state.resumingIntakeId === intake.intakeId
      && state.sourceIntakes.some((candidate) => candidate.intakeId === intake.intakeId && candidate.state === 'STAGED');
    const activeStatus = elements['workspace-content'].querySelector('[data-source-status]');
    if (activeStatus) activeStatus.textContent = stillStaged
      ? `${errorText} Intake ${intake.intakeId} remains staged; retry commits this exact artifact or discard it.`
      : errorText;
    showToast(errorText);
  } finally {
    setSourceMutationPending(false);
    if (form.isConnected) {
      form.removeAttribute('aria-busy'); submit.disabled = !state.agentAccessCsrf;
    }
  }
});
elements['workspace-content'].addEventListener('click', async (event) => {
  const resume = event.target.closest('[data-resume-source-intake]');
  const discard = event.target.closest('[data-discard-source-intake]');
  if ((!resume && !discard) || state.sourceMutationPending) return;
  const intakeId = (resume || discard).dataset.resumeSourceIntake ?? (resume || discard).dataset.discardSourceIntake;
  if (resume) {
    const selectedFile = sourceIntakeFormCache?.querySelector('[data-source-file]')?.files?.[0] ?? null;
    if (selectedFile && !window.confirm(
      `Resume staged intake ${intakeId}? The selected file ${selectedFile.name} and the current import form will be cleared.`,
    )) return;
    resetSourceIntakeForm();
    state.resumingIntakeId = intakeId;
    state.sourceDraft = null;
    renderWorkspace();
    elements['workspace-content'].querySelector('[name="sourceId"]')?.focus();
    return;
  }
  if (!state.project || !state.agentAccessCsrf
    || !window.confirm('Discard this staged source intake and release its temporary project reference?')) return;
  discard.disabled = true;
  try {
    await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/source-intakes/${encodeURIComponent(intakeId)}/abandon`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({ idempotencyKey: sourceOperationKey('source-intake-abandon', intakeId) }),
    });
    clearSourceOperationKey('source-intake-abandon', intakeId);
    if (state.resumingIntakeId === intakeId) state.resumingIntakeId = null;
    await loadProject(state.project.projectId);
    showToast('Staged source intake discarded.');
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    await loadProject(state.project.projectId).catch(() => {});
  }
});
elements['workspace-content'].addEventListener('click', async (event) => {
  const propose = event.target.closest('[data-source-review-propose]');
  const decide = event.target.closest('[data-source-review-decision]');
  const button = propose || decide;
  if (!button || !state.project || !state.agentAccessCsrf || state.sourceMutationPending) return;
  const action = propose ? 'propose' : 'decide';
  const disposition = decide?.dataset.sourceReviewDecision;
  let note = null;
  if (disposition === 'REJECTED') {
    note = window.prompt('Why is this source being rejected? A reason is required.');
    if (note === null) return;
    note = note.trim();
    if (!note) {
      showToast('A rejection reason is required.');
      return;
    }
  }
  if (action === 'decide' && !window.confirm(`${disposition === 'APPROVED' ? 'Approve' : 'Reject'} this original source? This records an explicit owner decision.`)) return;
  button.disabled = true;
  try {
    await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/sources/${encodeURIComponent(button.dataset.sourceId)}/review`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({
        expectedRevision: state.project.revision,
        idempotencyKey: `source-review.${crypto.randomUUID()}`,
        action,
        ...(note ? { note } : {}),
        ...(disposition ? { disposition, confirm: true } : {}),
      }),
    });
    await loadProject(state.project.projectId);
    showToast(action === 'propose' ? 'Source proposed for human review.' : `Source ${disposition.toLowerCase()}.`);
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    await loadProject(state.project.projectId).catch(() => {});
  }
});
elements['workspace-content'].addEventListener('click', async (event) => {
  const button = event.target.closest('[data-demo-action]');
  if (!button || state.sourceMutationPending) return;
  button.disabled = true;
  try {
    const response = await api(`/api/demo/action?action=${encodeURIComponent(button.dataset.demoAction)}`, {
      method: 'POST', headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
    });
    state.labResult = {
      ok: true,
      action: button.textContent,
      code: response.replayed ? 'REPLAYED_WITHOUT_DUPLICATE' : 'COMMITTED',
      message: response.replayed ? `Original revision ${response.revision} returned; project head did not advance.` : `Revision ${response.revision} committed.`,
    };
  } catch (error) {
    state.labResult = { ok: false, action: button.textContent, code: error.code || 'ERROR', message: error.message };
  }
  await refresh({ quiet: true });
  showToast(`${state.labResult.code}: ${state.labResult.message}`);
});
elements['demo-button'].addEventListener('click', async () => {
  if (state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending) return;
  elements['demo-button'].disabled = true;
  try {
    const project = await api('/api/demo', {
      method: 'POST', headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
    });
    await loadProjects(project.projectId); showToast('Demo created through the transactional command core.');
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
  } finally {
    updateMutationControls();
  }
});
window.addEventListener('hashchange', () => {
  if (state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending) {
    history.replaceState(null, '', `#${state.workspace}`);
    return;
  }
  state.workspace = location.hash.slice(1) || 'overview'; renderWorkspace();
  void publishVisualEvidence();
});

await refresh({ quiet: true });
if (visualFixture === 'agent-access') setAgentAccessPanel(true);
await publishVisualEvidence();
if (!visualFixture) setInterval(() => refresh({ quiet: true, passive: true }), 5000);
