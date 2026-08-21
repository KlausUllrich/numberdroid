const ACCESS_OPTIONS = Object.freeze([
  Object.freeze({ value: 'off', label: 'Off' }),
  Object.freeze({ value: 'read_only', label: 'Read only' }),
  Object.freeze({ value: 'propose_draft', label: 'Propose in draft' }),
  Object.freeze({ value: 'execute_scoped', label: 'Execute scoped task' }),
  Object.freeze({ value: 'custom', label: 'Custom…' }),
]);

const ACCESS_MODES = new Set(ACCESS_OPTIONS.map(({ value }) => value));
const PREVIEW_FALLBACK_STATES = new Set(['PROCESSING', 'MISSING', 'UNSUPPORTED', 'LOAD_FAILED']);
const SUPPORTED_PREVIEW_MEDIA = new Set(['image/png', 'image/webp']);

function warning(code, message, severity = 'warning') {
  return Object.freeze({ code, message, severity });
}

function grantState(grant, now) {
  if (grant.revokedAt) return 'revoked';
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return 'expired';
  return 'active';
}

function newestGrant(grants, state, now) {
  return [...grants]
    .reverse()
    .find((grant) => grantState(grant, now) === state) ?? null;
}

function actualAccess(snapshot, now) {
  const grants = Array.isArray(snapshot.grants) ? snapshot.grants : [];
  const active = newestGrant(grants, 'active', now);
  if (active) {
    if (active.budget && active.usage && active.usage.commands >= active.budget.maxCommands) {
      return { grant: active, mode: 'off', state: 'DENIED', deniedReason: 'COMMAND_BUDGET_EXHAUSTED' };
    }
    const scopeSet = new Set(active.scopes);
    const isReadOnly = scopeSet.size === 1 && scopeSet.has('project.read');
    const isDraftProposal = !scopeSet.has('project.status.write')
      && (scopeSet.has('source.write') || scopeSet.has('asset.write'));
    return {
      grant: active,
      mode: isReadOnly ? 'read_only' : (isDraftProposal ? 'propose_draft' : 'execute_scoped'),
      state: isReadOnly ? 'ACTIVE_READ_ONLY' : (isDraftProposal ? 'ACTIVE_DRAFT' : 'ACTIVE_EXECUTE'),
    };
  }
  const expired = newestGrant(grants, 'expired', now);
  if (expired) return { grant: expired, mode: 'off', state: 'EXPIRED' };
  const revoked = newestGrant(grants, 'revoked', now);
  if (revoked) return { grant: revoked, mode: 'off', state: 'REVOKED' };
  return { grant: null, mode: 'off', state: 'OFF' };
}

function basePolicy(projectView, now) {
  const access = actualAccess(projectView.snapshot, now);
  const warnings = [];
  if (access.grant && access.state.startsWith('ACTIVE')) {
    if (!access.grant.expiresAt) {
      warnings.push(warning('NO_EXPIRY_LEGACY', 'This legacy grant has no expiry. Rotate it through a bounded Header policy before authorizing a host.'));
    }
    const remainingCommands = access.grant.budget && access.grant.usage
      ? access.grant.budget.maxCommands - access.grant.usage.commands
      : null;
    if (remainingCommands !== null && remainingCommands <= Math.max(1, Math.ceil(access.grant.budget.maxCommands * 0.1))) {
      warnings.push(warning('COMMAND_BUDGET_LOW', `${remainingCommands} agent command(s) remain in this grant.`));
    }
  }
  if (access.deniedReason === 'COMMAND_BUDGET_EXHAUSTED') {
    warnings.push(warning('COMMAND_BUDGET_EXHAUSTED', 'The active grant has exhausted its command budget and grants no further execution.'));
  }
  const budget = access.grant?.budget && access.grant?.usage ? {
    status: 'ENFORCED',
    limits: structuredClone(access.grant.budget),
    used: structuredClone(access.grant.usage),
    remaining: {
      commands: Math.max(0, access.grant.budget.maxCommands - access.grant.usage.commands),
      jobs: Math.max(0, access.grant.budget.maxJobs - access.grant.usage.jobs),
      artifactBytes: Math.max(0, access.grant.budget.maxArtifactBytes - access.grant.usage.artifactBytes),
      costCents: Math.max(0, access.grant.budget.maxCostCents - access.grant.usage.costCents),
    },
  } : { status: 'NOT_AVAILABLE', limits: null, used: null, remaining: null };
  return {
    schemaVersion: 1,
    projectId: projectView.projectId,
    mode: access.mode,
    state: access.state,
    taskId: access.grant?.taskId ?? null,
    branchId: access.grant?.branchId ?? null,
    scopes: access.state.startsWith('ACTIVE') ? [...access.grant.scopes] : [],
    objectScopes: access.state.startsWith('ACTIVE') ? structuredClone(access.grant.objectScopes ?? []) : [],
    expiresAt: access.grant?.expiresAt ?? null,
    budget,
    runningJobs: 0,
    warnings,
    options: ACCESS_OPTIONS,
    authoritySource: 'HOST_SERVICE_VALIDATED_GRANT',
    selectionCreatesAuthority: false,
  };
}

export function effectiveAgentAccessProjection(projectView, { requestedMode, now = new Date().toISOString() } = {}) {
  const policy = basePolicy(projectView, now);
  if (requestedMode === undefined || requestedMode === null) return structuredClone(policy);
  if (!ACCESS_MODES.has(requestedMode)) {
    return {
      ...structuredClone(policy),
      requestedMode,
      state: 'DENIED',
      warnings: [warning('UNKNOWN_AGENT_ACCESS_MODE', 'The requested Agent access option is not supported.')],
    };
  }
  if (requestedMode === 'custom') {
    return {
      ...structuredClone(policy),
      requestedMode,
      customEditorRequired: true,
      warnings: [
        ...policy.warnings,
        warning('CUSTOM_NOT_AVAILABLE_1B', 'The detailed Custom policy editor is reserved for a later checkpoint; no authority changed. Use a bounded preset in 1B.', 'info'),
      ],
    };
  }
  if (requestedMode === 'propose_draft') {
    return {
      ...structuredClone(policy),
      requestedMode,
      draftWorkspaceRequired: true,
      warnings: [
        ...policy.warnings,
        warning('DRAFT_BRANCH_NOT_AVAILABLE_1B', 'Propose in draft needs isolated branch heads. It is reserved for a later checkpoint and grants nothing in 1B.', 'info'),
      ],
    };
  }
  if (requestedMode === policy.mode) {
    return { ...structuredClone(policy), requestedMode };
  }

  const messages = {
    off: policy.state.startsWith('ACTIVE')
      ? 'Off requires a confirmed service operation that revokes the current grant and all bound MCP hosts.'
      : 'No active grant exists.',
    read_only: policy.state === 'ACTIVE_EXECUTE'
      ? 'Read only requires a service-side grant rotation and revokes hosts bound to the broader grant.'
      : 'No active read-only grant is available for this project and task.',
    propose_draft: 'Draft-only proposal authority requires a confirmed service-side grant on the existing task branch.',
    execute_scoped: 'Scoped execution requires explicit broadening confirmation and a new immutable grant.',
  };
  return {
    ...structuredClone(policy),
    requestedMode,
    state: 'DENIED',
    warnings: [warning('MODE_NOT_BACKED_BY_GRANT', messages[requestedMode])],
  };
}

function safePreviewResource(resourceUri) {
  return typeof resourceUri === 'string'
    && /^\/api\/projects\/[^/]+\/artifacts\/sha256\/[a-f0-9]{64}$/.test(resourceUri);
}

function fallbackPreview(asset, state) {
  const safeState = PREVIEW_FALLBACK_STATES.has(state) ? state : 'MISSING';
  return {
    schemaVersion: 1,
    state: safeState,
    resourceUri: null,
    kind: asset.kind,
    alt: `${asset.kind} preview: ${safeState.toLowerCase().replace('_', ' ')}`,
  };
}

export function assetPreviewProjection(asset, source, { projectId = null } = {}) {
  const declared = asset.preview ?? source?.preview ?? null;
  if (declared?.state === 'READY' && safePreviewResource(declared.resourceUri)) {
    return {
      schemaVersion: 1,
      state: 'READY',
      resourceUri: declared.resourceUri,
      kind: asset.kind,
      alt: declared.alt || `${asset.name} preview`,
    };
  }
  if (declared?.state && PREVIEW_FALLBACK_STATES.has(declared.state)) {
    return fallbackPreview(asset, declared.state);
  }
  if (declared?.state === 'READY') return fallbackPreview(asset, 'LOAD_FAILED');
  if (!source?.artifactUri) return fallbackPreview(asset, 'MISSING');
  if (!SUPPORTED_PREVIEW_MEDIA.has(source.mediaType)) return fallbackPreview(asset, 'UNSUPPORTED');
  const digest = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(source.artifactUri)?.[1] ?? null;
  const wholeSourceRegion = Number.isInteger(source.width) && Number.isInteger(source.height)
    && asset.region?.x === 0 && asset.region?.y === 0
    && asset.region?.width === source.width && asset.region?.height === source.height;
  if (digest && projectId && wholeSourceRegion) {
    return {
      schemaVersion: 1,
      state: 'READY',
      resourceUri: `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${digest}`,
      kind: asset.kind,
      alt: `${asset.name} preview`,
    };
  }
  return fallbackPreview(asset, 'PROCESSING');
}

export function sourcePreviewProjection(source, { projectId = null } = {}) {
  if (!SUPPORTED_PREVIEW_MEDIA.has(source.mediaType)) {
    return {
      schemaVersion: 1,
      state: 'UNSUPPORTED',
      resourceUri: null,
      alt: `${source.name} source preview unavailable`,
      derivative: false,
    };
  }
  const digest = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(source.artifactUri ?? '')?.[1] ?? null;
  if (!digest || !projectId) {
    return {
      schemaVersion: 1,
      state: 'MISSING',
      resourceUri: null,
      alt: `${source.name} source preview unavailable`,
      derivative: false,
    };
  }
  return {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${digest}`,
    alt: `${source.name} original source preview`,
    derivative: false,
  };
}

export function jobHttpProjection(jobView) {
  const projected = structuredClone(jobView);
  if (!Array.isArray(projected.job?.outputs)) return projected;
  projected.job.outputs = projected.job.outputs.map((output) => {
    const ready = ['SUCCEEDED', 'APPLIED'].includes(projected.job.state)
      && typeof projected.projectId === 'string'
      && /^[a-f0-9]{64}$/.test(output.digest ?? '')
      && SUPPORTED_PREVIEW_MEDIA.has(output.mediaType);
    return {
      ...output,
      preview: {
        schemaVersion: 1,
        state: ready ? 'READY' : (SUPPORTED_PREVIEW_MEDIA.has(output.mediaType) ? 'MISSING' : 'UNSUPPORTED'),
        resourceUri: ready
          ? `/api/projects/${encodeURIComponent(projected.projectId)}/artifacts/sha256/${output.digest}`
          : null,
        alt: `Atlas preview ${output.rectangleId}`,
      },
    };
  });
  return projected;
}

export function projectHttpProjection(projectView) {
  const sourceById = new Map(projectView.snapshot.sources.map((source) => [source.id, source]));
  return {
    ...structuredClone(projectView),
    snapshot: {
      ...structuredClone(projectView.snapshot),
      sources: projectView.snapshot.sources.map((source) => ({
        ...structuredClone(source),
        preview: sourcePreviewProjection(source, { projectId: projectView.projectId }),
      })),
      atlases: (projectView.snapshot.atlases ?? []).map((atlas) => ({
        ...structuredClone(atlas),
        sliceHeads: atlas.sliceHeads.map((slice) => ({
          ...structuredClone(slice),
          preview: {
            schemaVersion: 1,
            state: 'READY',
            resourceUri: `/api/projects/${encodeURIComponent(projectView.projectId)}/artifacts/sha256/${slice.digest}`,
            alt: `${atlas.name} slice ${slice.rectangleId}`,
          },
        })),
      })),
      assets: projectView.snapshot.assets.map((asset) => ({
        ...structuredClone(asset),
        preview: assetPreviewProjection(asset, sourceById.get(asset.sourceId), { projectId: projectView.projectId }),
      })),
    },
  };
}
