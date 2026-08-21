import { createHash } from 'node:crypto';
import { StudioError } from '../../../packages/domain/src/index.js';
import { effectiveAgentAccessProjection } from './http-projections.js';

const PRESETS = Object.freeze({
  read_only: Object.freeze({
    rank: 1,
    scopes: Object.freeze(['project.read']),
    durationMs: 8 * 60 * 60 * 1000,
    budget: Object.freeze({ maxCommands: 100, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 }),
  }),
  propose_draft: Object.freeze({
    rank: 2,
    scopes: Object.freeze(['project.read', 'source.write', 'asset.write']),
    durationMs: 4 * 60 * 60 * 1000,
    budget: Object.freeze({ maxCommands: 50, maxJobs: 10, maxArtifactBytes: 268435456, maxCostCents: 0 }),
  }),
  execute_scoped: Object.freeze({
    rank: 3,
    scopes: Object.freeze(['project.read', 'source.write', 'asset.write', 'project.status.write']),
    durationMs: 60 * 60 * 1000,
    budget: Object.freeze({ maxCommands: 100, maxJobs: 10, maxArtifactBytes: 536870912, maxCostCents: 0 }),
  }),
});

const MODES = new Set(['off', ...Object.keys(PRESETS), 'custom']);
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function activeGrant(snapshot, now) {
  return [...snapshot.grants].reverse().find((grant) => (
    !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now))
  )) ?? null;
}

function latestGrant(snapshot) {
  return snapshot.grants.at(-1) ?? null;
}

function modeRank(mode) {
  return mode === 'off' ? 0 : (PRESETS[mode]?.rank ?? 0);
}

function stableOperationId(projectId, idempotencyKey) {
  return createHash('sha256').update(`${projectId}\0${idempotencyKey}`, 'utf8').digest('hex').slice(0, 40);
}

function grantMatchesPreset(grant, mode) {
  const preset = PRESETS[mode];
  if (!grant || !preset || grant.scopes.length !== preset.scopes.length) return false;
  const actualScopes = new Set(grant.scopes);
  return preset.scopes.every((scope) => actualScopes.has(scope));
}

function validateRequest(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new StudioError('VALIDATION_ERROR', 'Agent access request must be an object.');
  }
  const allowedKeys = new Set(['mode', 'confirmBroaderAccess', 'idempotencyKey']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new StudioError('VALIDATION_ERROR', 'Agent access request contains an unsupported field.');
  }
  if (typeof body.mode !== 'string' || !MODES.has(body.mode)) {
    throw new StudioError('UNKNOWN_AGENT_ACCESS_MODE', 'The requested Agent access mode is not supported.', {
      allowedModes: [...MODES],
    });
  }
  if (body.mode !== 'custom' && (typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(body.idempotencyKey))) {
    throw new StudioError('VALIDATION_ERROR', 'A valid idempotencyKey is required for Agent access changes.');
  }
  if (body.confirmBroaderAccess !== undefined && typeof body.confirmBroaderAccess !== 'boolean') {
    throw new StudioError('VALIDATION_ERROR', 'confirmBroaderAccess must be a boolean.');
  }
  return {
    mode: body.mode,
    confirmBroaderAccess: body.confirmBroaderAccess === true,
    idempotencyKey: body.idempotencyKey ?? null,
  };
}

function confirmationDetails(projectView, mode, now) {
  const current = effectiveAgentAccessProjection(projectView, { now });
  const target = activeGrant(projectView.snapshot, now) ?? latestGrant(projectView.snapshot);
  const preset = PRESETS[mode];
  return {
    currentMode: current.mode,
    requestedMode: mode,
    scopes: [...preset.scopes],
    taskId: target?.taskId ?? null,
    branchId: target?.branchId ?? null,
    objectScopes: structuredClone(target?.objectScopes ?? [{ kind: 'project', id: projectView.projectId }]),
    budget: structuredClone(preset.budget),
    expiresAt: new Date(Date.parse(now) + preset.durationMs).toISOString(),
    publishIncluded: false,
  };
}

function policyWithPresetSummaries(projectView, now, requestedMode) {
  const policy = effectiveAgentAccessProjection(projectView, { now, requestedMode });
  return {
    ...policy,
    presets: Object.fromEntries(Object.keys(PRESETS).map((mode) => [
      mode,
      confirmationDetails(projectView, mode, now),
    ])),
  };
}

function ownerContext(projectView) {
  return {
    actor: { id: projectView.snapshot.project.ownerId, kind: 'human', displayName: 'Local designer' },
    taskId: null,
    grantId: null,
    branchId: 'branch.main',
  };
}

function commandDto({ commandId, idempotencyKey, type, projectView, payload }) {
  return {
    schemaVersion: 1,
    commandId,
    idempotencyKey,
    type,
    projectId: projectView.projectId,
    baseRevision: projectView.revision,
    expectedVersion: projectView.revision,
    dryRun: false,
    payload,
  };
}

async function executeOwnerAtHead(studioService, projectId, command, { retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const projectView = await studioService.readProjectTrusted(projectId);
    try {
      return await studioService.execute(commandDto({ ...command, projectView }), ownerContext(projectView));
    } catch (error) {
      lastError = error;
      if (error?.code !== 'REVISION_CONFLICT') throw error;
    }
  }
  throw lastError;
}

export function createHumanAgentAccessController({
  studioService,
  hostBindingStore = null,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!studioService) throw new TypeError('studioService is required.');
  const operations = new Map();
  let mutationQueue = Promise.resolve();

  async function read(projectId) {
    const projectView = await studioService.readProjectTrusted(projectId);
    return policyWithPresetSummaries(projectView, clock());
  }

  async function perform(projectId, request, operation) {
    let projectView = await studioService.readProjectTrusted(projectId);
    let now = clock();
    let currentPolicy = effectiveAgentAccessProjection(projectView, { now });
    const currentActiveGrant = activeGrant(projectView.snapshot, now);
    if (request.mode === currentPolicy.mode
      && currentPolicy.state.startsWith('ACTIVE')
      && grantMatchesPreset(currentActiveGrant, request.mode)) {
      hostBindingStore?.alignBindingsToGrant({
        projectId,
        toGrantId: currentActiveGrant.id,
        reboundBy: projectView.snapshot.project.ownerId,
      });
      return { changed: false, effectivePolicy: await read(projectId) };
    }
    if (request.mode === 'off' && !activeGrant(projectView.snapshot, now)) {
      return { changed: false, effectivePolicy: await read(projectId) };
    }
    if (modeRank(request.mode) > modeRank(currentPolicy.mode) && !request.confirmBroaderAccess) {
      throw new StudioError(
        'BROADER_ACCESS_CONFIRMATION_REQUIRED',
        'Broader Agent access requires explicit human confirmation.',
        confirmationDetails(projectView, request.mode, now),
      );
    }

    const existingActive = currentActiveGrant;
    const target = existingActive ?? latestGrant(projectView.snapshot);
    if (request.mode !== 'off' && !target) {
      throw new StudioError(
        'AGENT_TARGET_REQUIRED',
        'No prior agent task exists. Configure the agent and task in the separate human-only editor first.',
      );
    }

    if (existingActive && !existingActive.revokedAt) {
      await executeOwnerAtHead(studioService, projectId, {
        commandId: operation.revokeCommandId,
        idempotencyKey: operation.revokeIdempotencyKey,
        type: 'grant.revoke',
        payload: { grantId: existingActive.id, reason: `Header Agent access changed to ${request.mode}.` },
      });
    }

    if (request.mode !== 'off') {
      const preset = PRESETS[request.mode];
      projectView = await studioService.readProjectTrusted(projectId);
      now = clock();
      if (!projectView.snapshot.grants.some((grant) => grant.id === operation.newGrantId)) {
        await executeOwnerAtHead(studioService, projectId, {
          commandId: operation.issueCommandId,
          idempotencyKey: operation.issueIdempotencyKey,
          type: 'grant.issue',
          payload: {
            grantId: operation.newGrantId,
            agentId: target.agentId,
            taskId: target.taskId,
            branchId: target.branchId,
            scopes: [...preset.scopes],
            objectScopes: structuredClone(target.objectScopes?.length
              ? target.objectScopes
              : [{ kind: 'project', id: projectId }]),
            budget: structuredClone(preset.budget),
            expiresAt: new Date(Date.parse(now) + preset.durationMs).toISOString(),
          },
        });
      }
      if (hostBindingStore) {
        hostBindingStore.alignBindingsToGrant({
          projectId,
          toGrantId: operation.newGrantId,
          reboundBy: projectView.snapshot.project.ownerId,
        });
      }
    }

    currentPolicy = await read(projectId);
    return { changed: true, effectivePolicy: currentPolicy };
  }

  async function change(projectId, rawBody) {
    const request = validateRequest(rawBody);
    if (request.mode === 'custom') {
      const projectView = await studioService.readProjectTrusted(projectId);
      return {
        changed: false,
        effectivePolicy: policyWithPresetSummaries(projectView, clock(), 'custom'),
      };
    }

    const operationKey = `${projectId}:${request.idempotencyKey}`;
    const fingerprint = JSON.stringify({ projectId, mode: request.mode });
    const prior = operations.get(operationKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new StudioError('IDEMPOTENCY_CONFLICT', 'The Agent access idempotency key was reused for a different mode.');
      }
      const result = await prior.promise;
      return { ...structuredClone(result), idempotentReplay: true };
    }

    const operationId = stableOperationId(projectId, request.idempotencyKey);
    const operation = {
      fingerprint,
      revokeCommandId: `header-access.revoke.${operationId}`,
      revokeIdempotencyKey: `header-access.revoke.${operationId}`,
      issueCommandId: `header-access.issue.${operationId}`,
      issueIdempotencyKey: `header-access.issue.${operationId}`,
      newGrantId: `grant.header-access.${operationId}`,
    };
    const run = mutationQueue.then(() => perform(projectId, request, operation));
    operation.promise = run;
    operations.set(operationKey, operation);
    mutationQueue = run.catch(() => undefined);
    try {
      const result = await run;
      return { ...structuredClone(result), idempotentReplay: false };
    } catch (error) {
      operations.delete(operationKey);
      throw error;
    }
  }

  return Object.freeze({ read, change });
}

export const AGENT_ACCESS_PRESETS = PRESETS;
