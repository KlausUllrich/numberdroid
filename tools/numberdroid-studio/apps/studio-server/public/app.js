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
  },
  roomMutationPending: false,
  roomOperationKeys: new Map(),
  roomUi: {
    selectedRoomVariantId: null,
    selectedPlacementId: null,
    selectedConnectorId: null,
    selectedPaletteAssetId: null,
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
  const pending = state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending;
  elements['project-select'].disabled = pending;
  elements['refresh-button'].disabled = pending || state.refreshing;
  elements['demo-button'].disabled = pending;
  elements['agent-access-select'].disabled = pending || !state.project || !state.agentAccess
    || state.agentAccess.state === 'REQUESTING';
  elements['agent-access-state'].disabled = pending || !state.project || !state.agentAccess;
  elements['agent-access-panel'].inert = pending;
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
  const mutationPending = state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending;
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
  const canAuthorizeHost = hasActivePolicy && policy?.mode !== 'propose_draft';
  elements['agent-launcher-show'].disabled = state.hostBindingSupport !== 'AVAILABLE' || !state.mcpLauncherConfig;
  const bindingSupport = state.hostBindingSupport === 'AVAILABLE'
    ? (canAuthorizeHost
      ? 'Start the local host, then authorize its waiting verification code here.'
      : policy?.mode === 'propose_draft'
        ? 'Draft host authorization waits for real branch heads in a later checkpoint.'
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

function assetPreview(asset) {
  const preview = asset.preview;
  if (preview?.state !== 'READY' || !preview.resourceUri) return previewFallback(asset, preview?.state);
  const figure = document.createElement('figure');
  figure.className = 'asset-preview ready';
  figure.dataset.previewState = 'READY';
  const image = document.createElement('img');
  image.src = preview.resourceUri;
  image.alt = preview.alt || `${asset.name} preview`;
  image.loading = visualFixture ? 'eager' : 'lazy'; image.decoding = 'async';
  image.addEventListener('error', () => figure.replaceWith(previewFallback(asset, 'LOAD_FAILED')), { once: true });
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

function safeV2Preview(asset) {
  const declared = asset?.preview;
  const digest = asset?.sliceBinding?.digest;
  const projectId = state.project?.projectId;
  const safeProjectPrefix = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/`
    : null;
  if (declared?.state === 'READY' && typeof declared.resourceUri === 'string'
      && safeProjectPrefix && declared.resourceUri.startsWith(safeProjectPrefix)
      && /^[a-f0-9]{64}$/.test(declared.resourceUri.slice(safeProjectPrefix.length))) {
    return assetPreview({ ...asset, preview: declared });
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
    });
  }
  return previewFallback(asset, declared?.state ?? (
    asset?.sliceBinding?.mediaType && asset.sliceBinding.mediaType !== 'image/png' ? 'UNSUPPORTED' : 'MISSING'
  ));
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
  help.textContent = 'PNG or WebP is ingested into project-scoped CAS first, then committed through one semantic intake command. No provider is called.';
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
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Checkpoint 2B · source-resolution crop';
  const title = document.createElement('h2'); title.textContent = cutter.name;
  const help = document.createElement('p');
  help.textContent = 'Define exact half-open integer rectangles on the approved original. Preview produces deterministic PNG crops; it does not resize, clean seams, infer gameplay meaning, or create Asset Library entries.';
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
    section.append(sectionHeading('Durable job events', 'Redacted transition history for cancellation, retry, completion, apply, and discard.'), history);
  }

  const previewOutputs = ['SUCCEEDED', 'APPLIED'].includes(state.cutterJob?.state)
    ? (state.cutterJob.outputs ?? [])
    : [];
  if (previewOutputs.length) {
    const previews = document.createElement('div'); previews.className = 'slice-preview-grid';
    previewOutputs.forEach((output, index) => previews.append(cutterPreviewCard(output, index, state.project.projectId)));
    section.append(sectionHeading('Job previews', 'Temporary outputs remain job-owned until the explicit commit below.'), previews);
  }
  if (atlas?.sliceHeads.length) {
    const committedGrid = document.createElement('div'); committedGrid.className = 'slice-preview-grid committed';
    atlas.sliceHeads.forEach((slice, index) => committedGrid.append(cutterPreviewCard({ ...slice, rectangleId: `${slice.rectangleId} · ${slice.sliceId} v${slice.version}` }, index, state.project.projectId)));
    section.append(sectionHeading('Committed slice heads', 'Stable slice identities. These are still crops, not semantic surfaces, props, or items.'), committedGrid);
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
    fragment.append(emptyState('No sources registered', 'Import a PNG or WebP with explicit origin and provenance.'));
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
  fragment.append(metrics, sectionHeading('Production board', 'The first end-to-end slice shares one transactional core with agent adapters.'));
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  grid.append(
    card('Source provenance', 'Ready', 'Prompts, seeds, models, and artifact URIs are first-class data.'),
    card('Atlas & asset semantics', 'Foundation', 'Source crops become stable semantic asset IDs without pixel-inferred gameplay.'),
    card(
      'Agent task authority',
      activeGrants.length ? 'Granted' : 'Human only',
      activeGrants.length
        ? `${activeGrants.length} task-scoped grant(s) are visible and revocable.`
        : 'No agent currently has mutation authority.',
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
    card('Room authoring', snapshot.roomLibrary ? 'Checkpoint 3' : 'Ready', 'Single rooms and hallways preserve intent, edge connectors, exact asset pins, findings, and immutable lifecycle versions.'),
    card('MCP transport', 'Official 2026-07-28', 'Local stdio uses private host pairing and the same semantic command core as this visual shell.'),
  );
  if (snapshot.assetLibrary) grid.append(card(
    'V2 asset library',
    v2Assets ? 'Slice-bound' : 'Ready for proposals',
    'Immutable asset versions preserve typed semantics, findings, and exact committed-slice lineage.',
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
  article.append(safeV2Preview(asset));
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
  provenance.append(lineage, digest, proposal); article.append(provenance);

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
  article.append(headingRow, safeV2Preview(item));
  const identity = document.createElement('div'); identity.className = 'proposal-identity';
  const primary = document.createElement('strong'); primary.textContent = `${display.label} · ${item.kind}`;
  identity.append(
    primary,
    copyableCanonical('Canonical slice ID', item.sliceBinding?.sliceId ?? item.sliceId, `proposal-slice-${proposal.proposalId}-${item.itemId}`),
    copyableCanonical('Proposed asset ID', item.assetId, `proposal-asset-${proposal.proposalId}-${item.itemId}`),
  );
  const provenance = document.createElement('small');
  provenance.textContent = `${display.atlasName} · slice v${item.sliceBinding?.sliceVersion ?? item.expectedSliceVersion} · committed r${item.sliceBinding?.committedRevision ?? '—'} · sha256:${item.sliceBinding?.digest ?? 'unresolved'}`;
  identity.append(provenance); article.append(identity, proposalDiffRows(item));

  const findings = document.createElement('details'); findings.open = (item.findings ?? []).length > 0;
  const findingsSummary = document.createElement('summary');
  findingsSummary.textContent = `Deterministic findings · ${findingSummary(item.findings)}`;
  findings.append(findingsSummary, findingsList(item.findings)); article.append(findings);

  if (proposal.state === 'PENDING') {
    const draft = decisionDraft(proposal, item);
    const controls = document.createElement('div'); controls.className = 'proposal-decision-fields';
    const select = document.createElement('select');
    select.dataset.proposalDisposition = item.itemId;
    select.dataset.proposalId = proposal.proposalId;
    select.dataset.assetFocusKey = `proposal-disposition-${item.itemId}`;
    select.setAttribute('aria-label', `Decision for ${item.name}`);
    for (const [value, label] of [['ACCEPTED', 'Accept'], ['REJECTED', 'Reject']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
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
  fragment.append(sectionHeading('V2 asset inventory', 'Filter immutable slice-bound heads. Cards show typed semantics, findings, and exact provenance.'), filters);

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
  const pill = document.createElement('span'); pill.className = 'status-pill'; pill.textContent = value;
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

function renderRoomPalette(variant, snapshot) {
  const panel = document.createElement('section'); panel.className = 'room-panel room-palette';
  const heading = document.createElement('div'); heading.className = 'room-panel-heading';
  const title = document.createElement('h3'); title.textContent = 'Asset palette';
  const count = document.createElement('small');
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Filter assets'; search.value = state.roomUi.paletteSearch;
  search.dataset.roomPaletteSearch = 'true'; search.dataset.roomControl = 'palette-search'; search.dataset.roomFocusKey = 'room-palette-search'; search.setAttribute('aria-label', 'Filter room asset palette');
  const needle = state.roomUi.paletteSearch.trim().toLocaleLowerCase('en-US');
  const assets = currentAssetLibrary(snapshot).assets.filter((asset) => !needle || [asset.name, asset.assetId, ...(asset.metadata?.tags ?? [])]
    .some((value) => String(value).toLocaleLowerCase('en-US').includes(needle)));
  count.textContent = `${assets.length} exact-version assets`;
  heading.append(title, count); panel.append(heading, search);
  const list = document.createElement('div'); list.className = 'room-palette-list'; list.dataset.roomScroll = 'palette';
  for (const asset of assets) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'room-palette-item';
    button.dataset.roomControl = 'palette-asset'; button.dataset.paletteAssetId = asset.assetId;
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
    const button = roomControl(label, 'zoom', { roomZoom: value }); button.dataset.selected = String(state.roomUi.zoom === value); zoom.append(button);
  }
  const layers = document.createElement('div'); layers.className = 'room-layer-controls';
  for (const [value, label] of [['STRUCTURAL_SURFACE', 'Surfaces'], ['SET_DRESSING', 'Set dressing'], ['CONNECTORS', 'Connectors']]) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.roomUi.layers[value]; input.dataset.roomLayer = value; input.dataset.roomControl = 'layer';
    layers.append(roomField(label, input));
  }
  toolbar.append(origin, zoom, layers); panel.append(toolbar);
  const scroll = document.createElement('div'); scroll.className = 'room-canvas-scroll'; scroll.dataset.roomScroll = 'canvas';
  const board = document.createElement('div'); board.className = 'room-board'; board.dataset.roomBoard = 'true';
  const cellSize = state.roomUi.zoom === '2' ? 58 : state.roomUi.zoom === '1' ? 38 : 28;
  board.style.setProperty('--room-width', String(variant.width)); board.style.setProperty('--room-height', String(variant.height));
  board.style.setProperty('--room-cell', `${cellSize}px`);
  const grid = document.createElement('div'); grid.className = 'room-cell-grid';
  for (let y = 0; y < variant.height; y += 1) {
    for (let x = 0; x < variant.width; x += 1) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'room-cell';
      cell.dataset.roomControl = 'cell'; cell.dataset.x = String(x); cell.dataset.y = String(y);
      cell.setAttribute('aria-label', `Cell ${x}, ${y}`); const coordinate = document.createElement('span'); coordinate.textContent = `${x},${y}`; cell.append(coordinate); grid.append(cell);
    }
  }
  board.append(grid);
  if (state.roomUi.layers.CONNECTORS) {
    for (const connector of variant.connectors) {
      const geometry = connectorGeometry(connector, variant); const clearance = document.createElement('button');
      clearance.type = 'button'; clearance.className = `room-connector ${geometry.side}`;
      clearance.dataset.roomControl = 'connector-select'; clearance.dataset.connectorId = connector.connectorId;
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
  hint.textContent = variant.lifecycle === 'DRAFT'
    ? state.roomUi.selectedPlacementId ? 'Choose a grid coordinate to move the selected placement; arrow controls are available in the inspector.'
      : state.roomUi.selectedPaletteAssetId ? 'Choose a grid coordinate to place the selected exact-version asset.'
        : 'Select a palette asset to place, or select an existing placement to move.'
    : `${variant.lifecycle} versions are read-only. Fork a FINAL version to continue authoring.`;
  panel.append(hint); return panel;
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
    panel.append(summary, roomControl('Remove connector', 'remove-connector', { connectorId: selectedConnector.connectorId }));
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

function renderRoomEditForms(variant) {
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
  section.append(sectionHeading('Authoring controls', 'Resize explicitly, author edge apertures and clearance, and retain the three-layer intent trace.'), resize, connector, intent); return section;
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
  fragment.append(renderRoomCreation(library));
  if (!library.variants.length) {
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
  const detail = document.createElement('p'); detail.textContent = `${archetype?.displayName ?? variant.roomArchetypeId} · exact archetype v${variant.archetypeVersion} · room v${variant.version} · ${findingSummary(variant.findings)}`;
  identity.append(heading, detail); header.append(selectorLabel, identity, roomStatusPill(variant.lifecycle)); fragment.append(header);
  const layout = document.createElement('div'); layout.className = 'room-designer-layout';
  layout.append(renderRoomPalette(variant, snapshot), renderRoomCanvas(variant, snapshot), renderRoomInspector(variant, snapshot)); fragment.append(layout);
  fragment.append(renderRoomEditForms(variant), renderRoomLifecycle(variant), renderRoomProposalReview(variant, library.proposals));
  return fragment;
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
      selectedRoomVariantId: state.roomUi.selectedRoomVariantId,
      selectedPlacementId: state.roomUi.selectedPlacementId,
      selectedConnectorId: state.roomUi.selectedConnectorId,
      selectedPaletteAssetId: state.roomUi.selectedPaletteAssetId,
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

function renderWorkspace({ preserveCutterDraft = false, preserveAssetDraft = false, preserveRoomDraft = false } = {}) {
  if (cutterDrag) {
    state.cutterDeferredRender = true;
    return;
  }
  captureCutterScroll();
  if (preserveAssetDraft) captureAssetDomState();
  if (preserveRoomDraft) captureRoomDomState();
  if (preserveCutterDraft) captureCutterDomDraft();
  else state.cutterDomDraft = null;
  for (const link of elements['workspace-nav'].querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.workspace === state.workspace);
  }
  const title = {
    overview: 'Project overview', sources: 'Source & generation provenance', assets: 'Visual asset library',
    rooms: 'Room & hallway designer', levels: 'Level composer', activity: 'Immutable activity ledger',
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
  else if (state.workspace === 'levels') content = renderCollection(snapshot.levels, 'levels');
  else content = renderActivityWorkspace();
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
  state.roomUi.selectedRoomVariantId = null;
  state.roomUi.selectedPlacementId = null;
  state.roomUi.selectedConnectorId = null;
  state.roomUi.selectedPaletteAssetId = null;
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
  if (state.roomUi.selectedPlacementId && !variant?.placements.some(({ placementId }) => placementId === state.roomUi.selectedPlacementId)) state.roomUi.selectedPlacementId = null;
  if (state.roomUi.selectedConnectorId && !variant?.connectors.some(({ connectorId }) => connectorId === state.roomUi.selectedConnectorId)) state.roomUi.selectedConnectorId = null;
  if (state.roomUi.selectedPaletteAssetId && !currentAssetLibrary(project.snapshot).assets.some(({ assetId }) => assetId === state.roomUi.selectedPaletteAssetId)) state.roomUi.selectedPaletteAssetId = null;
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
  }
  if (state.cutter?.projectId && state.cutter.projectId !== projectId) {
    cancelCutterJobPolling();
    resetCutterScroll();
    state.cutter = null; state.cutterJob = null; state.cutterJobEvents = [];
  }
  const [project, activity, agentAccess, sourceIntakes] = await Promise.all([
    api(`/api/projects/${encodeURIComponent(projectId)}`),
    api(`/api/projects/${encodeURIComponent(projectId)}/activity`),
    api(`/api/projects/${encodeURIComponent(projectId)}/agent-access`),
    api(`/api/projects/${encodeURIComponent(projectId)}/source-intakes`),
  ]);
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
  if (state.resumingIntakeId && !state.sourceIntakes.some((intake) => intake.intakeId === state.resumingIntakeId && intake.state === 'STAGED')) {
    state.resumingIntakeId = null;
  }
  const preserveWorkspace = mayPreserveWorkspace
    && previousWorkspaceFingerprint === workspaceRenderFingerprint();
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
  if (state.refreshing || state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending) return;
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

async function executeRoomMutation({ operation, target, path, body, successMessage }) {
  if (!state.project || !state.agentAccessCsrf || state.roomMutationPending) return false;
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
    const start = search.selectionStart; state.roomUi.paletteSearch = search.value; renderWorkspace();
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
    if (state.roomUi.dirty && !window.confirm('Discard the unsaved room proposal decision draft and switch rooms?')) { renderWorkspace(); return; }
    state.roomUi.selectedRoomVariantId = roomSelect.value; state.roomUi.selectedPlacementId = null; state.roomUi.selectedConnectorId = null;
    state.roomUi.selectedProposalId = null; state.roomUi.dirty = false; state.roomUi.conflict = null; renderWorkspace(); return;
  }
  const layer = event.target.closest('[data-room-layer]');
  if (layer) { state.roomUi.layers[layer.dataset.roomLayer] = layer.checked; renderWorkspace(); return; }
  const proposalSelect = event.target.closest('[data-room-proposal-select]');
  if (proposalSelect) {
    if (state.roomUi.dirty && !window.confirm('Discard the current room proposal decision draft?')) { renderWorkspace(); return; }
    state.roomUi.selectedProposalId = proposalSelect.value; state.roomUi.dirty = false; state.roomUi.conflict = null;
    const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === proposalSelect.value);
    state.roomUi.decisionContext = proposal ? { proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion } : null;
    renderWorkspace(); return;
  }
  const disposition = event.target.closest('[data-room-proposal-disposition]');
  if (!disposition) return;
  const proposal = currentRoomLibrary().proposals.find(({ proposalId }) => proposalId === disposition.dataset.proposalId);
  const item = proposal?.items.find(({ itemId }) => itemId === disposition.dataset.roomProposalDisposition);
  if (!proposal || !item || proposal.state !== 'PENDING') return;
  const draft = roomProposalDraft(proposal, item); draft.disposition = disposition.value; if (draft.disposition === 'ACCEPTED') draft.reason = '';
  state.roomUi.dirty = true; state.roomUi.decisionContext = { proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion }; renderWorkspace();
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
  if (action === 'zoom') { state.roomUi.zoom = control.dataset.roomZoom; renderWorkspace(); return; }
  if (action === 'palette-asset') { state.roomUi.selectedPaletteAssetId = control.dataset.paletteAssetId; state.roomUi.selectedPlacementId = null; state.roomUi.selectedConnectorId = null; renderWorkspace(); return; }
  if (action === 'placement-select') { state.roomUi.selectedPlacementId = control.dataset.placementId; state.roomUi.selectedPaletteAssetId = null; state.roomUi.selectedConnectorId = null; renderWorkspace(); return; }
  if (action === 'connector-select') { state.roomUi.selectedConnectorId = control.dataset.connectorId; state.roomUi.selectedPlacementId = null; state.roomUi.selectedPaletteAssetId = null; renderWorkspace(); return; }
  if (action === 'finding') {
    if (control.dataset.targetKind === 'roomPlacement') { state.roomUi.selectedPlacementId = control.dataset.targetId; state.roomUi.selectedConnectorId = null; }
    if (control.dataset.targetKind === 'roomConnector') { state.roomUi.selectedConnectorId = control.dataset.targetId; state.roomUi.selectedPlacementId = null; }
    renderWorkspace(); return;
  }
  if (!variant || !state.project || state.roomMutationPending) return;
  const projectId = state.project.projectId; const basePath = `/api/projects/${encodeURIComponent(projectId)}/rooms/${encodeURIComponent(variant.roomVariantId)}`;
  if (action === 'cell') {
    const anchor = { x: Number(control.dataset.x), y: Number(control.dataset.y) };
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

elements['workspace-nav'].addEventListener('click', (event) => {
  const link = event.target.closest('[data-workspace]');
  if (!link) return;
  if (state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending) { event.preventDefault(); return; }
  state.workspace = link.dataset.workspace; location.hash = state.workspace; renderWorkspace();
  void publishVisualEvidence();
});
elements['project-select'].addEventListener('change', () => {
  if (state.cutterPending || state.sourceMutationPending || state.assetMutationPending || state.roomMutationPending) {
    elements['project-select'].value = state.project?.projectId ?? '';
    return;
  }
  void loadProject(elements['project-select'].value);
});
elements['refresh-button'].addEventListener('click', () => {
  if (!state.cutterPending && !state.sourceMutationPending && !state.assetMutationPending && !state.roomMutationPending) void refresh({ passive: true });
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
