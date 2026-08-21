const visualFixture = new URLSearchParams(location.search).get('visualFixture');
const visualEvidenceErrors = [];
if (visualFixture) {
  document.documentElement.dataset.visualEvidenceReady = 'false';
  window.addEventListener('error', (event) => {
    visualEvidenceErrors.push(event.message || 'window error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    visualEvidenceErrors.push(event.reason?.message || 'unhandled rejection');
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
  workspace: location.hash.slice(1) || 'overview',
  refreshing: false,
};

function sourceOperationKey(operation, target = 'pending') {
  const key = `${operation}:${state.project?.projectId ?? 'none'}:${target}`;
  if (!state.sourceOperationKeys.has(key)) {
    state.sourceOperationKeys.set(key, `${operation}.${crypto.randomUUID()}`);
  }
  return state.sourceOperationKeys.get(key);
}

function clearSourceOperationKey(operation, target = 'pending') {
  state.sourceOperationKeys.delete(`${operation}:${state.project?.projectId ?? 'none'}:${target}`);
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
  elements['agent-access-select'].disabled = disabled || policy?.state === 'REQUESTING';
  elements['agent-access-state'].disabled = disabled;
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
  file.disabled = Boolean(stagedIntake);
  const sourceId = document.createElement('input');
  sourceId.name = 'sourceId'; sourceId.required = true; sourceId.maxLength = 128; sourceId.placeholder = 'source.family-hygiene-floor';
  sourceId.pattern = '[A-Za-z0-9][A-Za-z0-9._:-]{0,127}';
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
  submit.disabled = state.sourceMutationPending || !state.agentAccessCsrf;
  const status = document.createElement('p');
  status.dataset.sourceStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.textContent = stagedIntake ? `Ready to commit staged intake ${stagedIntake.intakeId}.` : '';
  form.append(heading, fields, status, submit);
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
    const discard = document.createElement('button');
    discard.type = 'button'; discard.className = 'secondary'; discard.textContent = 'Discard'; discard.dataset.discardSourceIntake = intake.intakeId;
    item.append(copy, resume, discard); list.append(item);
  }
  section.append(list);
  return section;
}

function renderSources(items) {
  const fragment = document.createDocumentFragment();
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
        actions.append(button);
      }
    } else if (['IMPORTED', 'GENERATED'].includes(lifecycle) && review === 'PENDING') {
      const propose = document.createElement('button');
      propose.type = 'button'; propose.textContent = 'Propose for review';
      propose.className = 'secondary'; propose.dataset.sourceReviewPropose = ''; propose.dataset.sourceId = item.id;
      actions.append(propose);
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
  const values = [
    ['Sources', snapshot.sources.length], ['Assets', snapshot.assets.length],
    ['Rooms', snapshot.rooms.length], ['Levels', snapshot.levels.length],
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
    card('Background jobs', 'Reserved', 'Generation, slicing, preview, validation, and export jobs enter with the asset vertical slice.', [
      ['Queue', 'not advertised yet'], ['Running', 0], ['Failed', 0],
    ]),
    card('Room authoring', 'Next checkpoint', 'Hallway and single-room composition will consume the approved library.'),
    card('MCP transport', 'Official 2026-07-28', 'Local stdio uses private host pairing and the same semantic command core as this visual shell.'),
  );
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

function renderWorkspace() {
  for (const link of elements['workspace-nav'].querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.workspace === state.workspace);
  }
  const title = {
    overview: 'Project overview', sources: 'Source & generation provenance', assets: 'Visual asset library',
    rooms: 'Room & hallway designer', levels: 'Level composer', activity: 'Immutable activity ledger',
  }[state.workspace] || 'Project overview';
  elements['workspace-eyebrow'].textContent = title;
  elements['workspace-content'].replaceChildren();
  if (!state.project) {
    elements['workspace-content'].append(emptyState('No local Studio project', 'Choose “Create / load demo” to exercise the real command API.'));
    return;
  }
  const snapshot = state.project.snapshot;
  let content;
  if (state.workspace === 'overview') content = renderOverview(snapshot);
  else if (state.workspace === 'sources') content = renderSources(snapshot.sources);
  else if (state.workspace === 'assets') content = renderCollection(snapshot.assets, 'assets');
  else if (state.workspace === 'rooms') content = renderCollection(snapshot.rooms, 'rooms');
  else if (state.workspace === 'levels') content = renderCollection(snapshot.levels, 'levels');
  else content = renderActivityWorkspace();
  elements['workspace-content'].append(content);
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

function renderProject() {
  const project = state.project?.snapshot.project;
  elements['project-name'].textContent = project?.name || 'No project selected';
  elements['project-description'].textContent = project?.description || 'Create the safe demo project to see the shared command core in action.';
  elements['project-status'].textContent = project?.status || 'empty';
  elements['revision-label'].textContent = state.project ? `Revision ${state.project.revision}` : 'Revision —';
  renderWorkspace(); renderActivity(); renderAgentAccess();
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
  root.dataset.visualErrorCount = String(visualEvidenceErrors.length);
  root.dataset.agentPolicyMode = state.agentAccess?.mode ?? 'none';
  root.dataset.agentPolicyState = state.agentAccess?.state ?? 'none';
  root.dataset.visualEvidenceReady = 'true';
}

async function loadProjects(preferredProjectId) {
  const session = await api('/api/ui-session');
  state.agentAccessCsrf = session.csrfToken;
  const response = await api('/api/projects');
  state.projects = response.projects;
  const prior = preferredProjectId || elements['project-select'].value;
  elements['project-select'].replaceChildren();
  if (!state.projects.length) {
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
  await loadProject(elements['project-select'].value);
}

async function loadProject(projectId) {
  if (!projectId) return;
  if (state.project?.projectId && state.project.projectId !== projectId) state.showMcpLauncherConfig = false;
  const [project, activity, agentAccess, sourceIntakes] = await Promise.all([
    api(`/api/projects/${encodeURIComponent(projectId)}`),
    api(`/api/projects/${encodeURIComponent(projectId)}/activity`),
    api(`/api/projects/${encodeURIComponent(projectId)}/agent-access`),
    api(`/api/projects/${encodeURIComponent(projectId)}/source-intakes`),
  ]);
  state.project = project; state.activity = activity.events;
  state.agentAccess = agentAccess.effectivePolicy; state.agentAccessCsrf = agentAccess.csrfToken;
  state.hostBindingSupport = agentAccess.hostBindingSupport;
  state.hostBindings = agentAccess.hostBindings;
  state.pendingHosts = agentAccess.pendingHosts;
  state.mcpLauncherConfig = agentAccess.mcpLauncherConfig;
  state.sourceIntakes = sourceIntakes.intakes;
  if (state.resumingIntakeId && !state.sourceIntakes.some((intake) => intake.intakeId === state.resumingIntakeId && intake.state === 'STAGED')) {
    state.resumingIntakeId = null;
  }
  renderProject();
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

async function refresh({ quiet = false } = {}) {
  if (state.refreshing) return;
  state.refreshing = true; elements['refresh-button'].disabled = true;
  try {
    await loadProjects(state.project?.projectId);
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
    state.refreshing = false; elements['refresh-button'].disabled = false;
  }
}

elements['workspace-nav'].addEventListener('click', (event) => {
  const link = event.target.closest('[data-workspace]');
  if (!link) return;
  state.workspace = link.dataset.workspace; location.hash = state.workspace; renderWorkspace();
  void publishVisualEvidence();
});
elements['project-select'].addEventListener('change', () => loadProject(elements['project-select'].value));
elements['refresh-button'].addEventListener('click', () => refresh());
elements['agent-access-select'].addEventListener('change', () => {
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
  if (event.key !== 'Escape' || elements['agent-access-panel'].hidden) return;
  setAgentAccessPanel(false);
  elements['agent-access-state'].focus();
});
document.addEventListener('click', (event) => {
  if (elements['agent-access-panel'].hidden || event.target.closest('.agent-access-control')) return;
  setAgentAccessPanel(false);
});
elements['agent-access-retry'].addEventListener('click', () => {
  if (state.pendingAgentAccess) requestAgentAccess(state.pendingAgentAccess.mode, state.pendingAgentAccess);
});
elements['agent-launcher-show'].addEventListener('click', () => {
  state.showMcpLauncherConfig = !state.showMcpLauncherConfig;
  renderAgentAccess(); setAgentAccessPanel(true);
});
elements['agent-pending-list'].addEventListener('click', async (event) => {
  const button = event.target.closest('[data-approve-pending-host]');
  if (!button || !state.project || !state.agentAccessCsrf) return;
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
  if (!button || !state.project || !state.agentAccessCsrf) return;
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
  const form = event.target.closest('[data-source-intake-form]');
  if (!form || !state.project || !state.agentAccessCsrf) return;
  event.preventDefault();
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
  state.sourceMutationPending = true; form.setAttribute('aria-busy', 'true'); submit.disabled = true;
  status.textContent = stagedIntake ? 'Committing staged source…' : 'Verifying and staging source…';
  try {
    let intake = stagedIntake ? { intakeId: stagedIntake.intakeId, artifact: stagedIntake.intake.artifact } : null;
    if (!intake) {
      const expectedDigest = await sha256Hex(file);
      intake = await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/source-intakes`, {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-numberdroid-studio-csrf': state.agentAccessCsrf,
          'x-numberdroid-idempotency-key': sourceOperationKey('source-intake-upload'),
          'x-numberdroid-source-origin': sourceOrigin,
          'x-numberdroid-expected-sha256': expectedDigest,
        },
        body: file,
      });
      clearSourceOperationKey('source-intake-upload');
      state.resumingIntakeId = intake.intakeId;
      status.textContent = 'Source staged; committing semantic revision…';
    }
    const nullable = (value) => String(value || '').trim() || null;
    const generated = sourceOrigin === 'imported_generation';
    await api(`/api/projects/${encodeURIComponent(state.project.projectId)}/sources`, {
      method: 'POST',
      headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
      body: JSON.stringify({
        expectedRevision: state.project.revision,
        idempotencyKey: sourceOperationKey('source-intake-commit', intake.intakeId),
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
    clearSourceOperationKey('source-intake-commit', intake.intakeId);
    state.sourceDraft = null; state.resumingIntakeId = null;
    await loadProject(state.project.projectId);
    showToast('Source imported through an atomic intake claim.');
  } catch (error) {
    status.textContent = `${error.code || 'ERROR'}: ${error.message}`;
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
    await loadProject(state.project.projectId).catch(() => {});
  } finally {
    state.sourceMutationPending = false;
    if (form.isConnected) {
      form.removeAttribute('aria-busy'); submit.disabled = !state.agentAccessCsrf;
    }
  }
});
elements['workspace-content'].addEventListener('click', async (event) => {
  const resume = event.target.closest('[data-resume-source-intake]');
  const discard = event.target.closest('[data-discard-source-intake]');
  if (!resume && !discard) return;
  const intakeId = (resume || discard).dataset.resumeSourceIntake ?? (resume || discard).dataset.discardSourceIntake;
  if (resume) {
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
  if (!button || !state.project || !state.agentAccessCsrf) return;
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
  if (!button) return;
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
  elements['demo-button'].disabled = true;
  try {
    const project = await api('/api/demo', {
      method: 'POST', headers: { 'x-numberdroid-studio-csrf': state.agentAccessCsrf },
    });
    await loadProjects(project.projectId); showToast('Demo created through the transactional command core.');
  } catch (error) {
    showToast(`${error.code || 'ERROR'}: ${error.message}`);
  } finally {
    elements['demo-button'].disabled = false;
  }
});
window.addEventListener('hashchange', () => {
  state.workspace = location.hash.slice(1) || 'overview'; renderWorkspace();
  void publishVisualEvidence();
});

await refresh({ quiet: true });
if (visualFixture === 'agent-access') setAgentAccessPanel(true);
await publishVisualEvidence();
if (!visualFixture) setInterval(() => refresh({ quiet: true }), 5000);
