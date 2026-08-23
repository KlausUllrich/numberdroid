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
    scopes: Object.freeze(['project.read', 'source.write', 'source.intake.commit', 'source.review.propose', 'asset.write']),
    durationMs: 4 * 60 * 60 * 1000,
    budget: Object.freeze({ maxCommands: 50, maxJobs: 10, maxArtifactBytes: 268435456, maxCostCents: 0 }),
  }),
  execute_scoped: Object.freeze({
    rank: 3,
    scopes: Object.freeze(['project.read', 'source.write', 'source.intake.commit', 'source.review.propose', 'atlas.write', 'asset.write', 'project.status.write']),
    durationMs: 60 * 60 * 1000,
    budget: Object.freeze({ maxCommands: 100, maxJobs: 10, maxArtifactBytes: 536870912, maxCostCents: 0 }),
  }),
});

const MODES = new Set(['off', ...Object.keys(PRESETS), 'custom']);
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function activeGrants(snapshot, now) {
  return snapshot.grants.filter((grant) => (
    !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now))
  ));
}

function activeGrant(snapshot, now) {
  return activeGrants(snapshot, now).at(-1) ?? null;
}

function latestGrant(snapshot) {
  return snapshot.grants.at(-1) ?? null;
}

function redactedBinding(binding) {
  const { grantId: _grantId, ...redacted } = binding;
  return redacted;
}

function stableOperationId(projectId, idempotencyKey) {
  return createHash('sha256').update(`${projectId}\0${idempotencyKey}`, 'utf8').digest('hex').slice(0, 40);
}

function grantMatchesPreset(grant, mode, now) {
  const preset = PRESETS[mode];
  if (!grant || !preset || grant.scopes.length !== preset.scopes.length) return false;
  const actualScopes = new Set(grant.scopes);
  const boundedExpiry = grant.expiresAt
    && Date.parse(grant.expiresAt) > Date.parse(now)
    && Date.parse(grant.expiresAt) <= Date.parse(now) + preset.durationMs;
  const boundedBudget = grant.budget && Object.entries(preset.budget)
    .every(([key, value]) => Number.isInteger(grant.budget[key]) && grant.budget[key] <= value);
  return preset.scopes.every((scope) => actualScopes.has(scope)) && boundedExpiry && boundedBudget;
}

function broadensGrant(grant, preset, now) {
  if (!grant) return true;
  const existingScopes = new Set(grant.scopes);
  if (preset.scopes.some((scope) => !existingScopes.has(scope))) return true;
  const targetExpiry = Date.parse(now) + preset.durationMs;
  if (grant.expiresAt && targetExpiry > Date.parse(grant.expiresAt)) return true;
  if (!grant.budget || !grant.usage) return true;
  const remaining = {
    maxCommands: Math.max(0, grant.budget.maxCommands - grant.usage.commands),
    maxJobs: Math.max(0, grant.budget.maxJobs - grant.usage.jobs),
    maxArtifactBytes: Math.max(0, grant.budget.maxArtifactBytes - grant.usage.artifactBytes),
    maxCostCents: Math.max(0, grant.budget.maxCostCents - grant.usage.costCents),
  };
  return Object.entries(preset.budget).some(([key, value]) => value > remaining[key]);
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

function validateBindingApproval(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new StudioError('VALIDATION_ERROR', 'MCP host approval must be an object.');
  }
  const allowedKeys = new Set(['pendingHostId', 'confirm', 'idempotencyKey']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new StudioError('VALIDATION_ERROR', 'MCP host approval contains an unsupported field.');
  }
  if (typeof body.pendingHostId !== 'string' || !body.pendingHostId.startsWith('pending-host.')) {
    throw new StudioError('VALIDATION_ERROR', 'A valid pendingHostId is required.');
  }
  if (body.confirm !== true) throw new StudioError('HOST_PAIRING_CONFIRMATION_REQUIRED', 'MCP host approval requires explicit confirmation.');
  if (typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)) {
    throw new StudioError('VALIDATION_ERROR', 'A valid idempotencyKey is required for MCP host approval.');
  }
  return body;
}

function validateBindingRevoke(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new StudioError('VALIDATION_ERROR', 'MCP host revocation must be an object.');
  }
  if (Object.keys(body).some((key) => key !== 'idempotencyKey')
    || typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)) {
    throw new StudioError('VALIDATION_ERROR', 'MCP host revocation requires only a valid idempotencyKey.');
  }
  return body;
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
  pairingBroker = null,
  agentTaskService = null,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!studioService) throw new TypeError('studioService is required.');
  const operations = new Map();
  let mutationQueue = Promise.resolve();
  let hostMutationQueue = Promise.resolve();

  async function read(projectId) {
    const projectView = await studioService.readProjectTrusted(projectId);
    return policyWithPresetSummaries(projectView, clock());
  }

  async function perform(projectId, request, operation) {
    let projectView = await studioService.readProjectTrusted(projectId);
    let now = clock();
    let currentPolicy = effectiveAgentAccessProjection(projectView, { now });
    const currentActiveGrants = activeGrants(projectView.snapshot, now);
    const currentActiveGrant = currentActiveGrants.at(-1) ?? null;
    if (request.mode === currentPolicy.mode
      && currentPolicy.state.startsWith('ACTIVE')
      && currentActiveGrants.length === 1
      && grantMatchesPreset(currentActiveGrant, request.mode, now)) {
      return { changed: false, effectivePolicy: await read(projectId) };
    }
    if (request.mode === 'off' && currentActiveGrants.length === 0) {
      return { changed: false, effectivePolicy: await read(projectId) };
    }
    if (request.mode !== 'off' && broadensGrant(currentActiveGrant, PRESETS[request.mode], now)
      && !request.confirmBroaderAccess) {
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

    for (const grant of currentActiveGrants) {
      const grantSuffix = createHash('sha256').update(grant.id, 'utf8').digest('hex').slice(0, 12);
      await executeOwnerAtHead(studioService, projectId, {
        commandId: `${operation.revokeCommandId}.${grantSuffix}`,
        idempotencyKey: `${operation.revokeIdempotencyKey}.${grantSuffix}`,
        type: 'grant.revoke',
        payload: { grantId: grant.id, reason: `Header Agent access changed to ${request.mode}.` },
      });
    }
    if (currentActiveGrants.length) {
      hostBindingStore?.revokeActiveForProject(projectId, {
        revokedBy: projectView.snapshot.project.ownerId,
        reason: `Bound grant was replaced by Header Agent access mode ${request.mode}.`,
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
        effectivePolicy: policyWithPresetSummaries(projectView, clock(), request.mode),
      };
    }
    if (request.mode === 'propose_draft') {
      const projectView = await studioService.readProjectTrusted(projectId);
      const actual = effectiveAgentAccessProjection(projectView, { now: clock() });
      if (actual.mode === 'propose_draft' && actual.state === 'ACTIVE_DRAFT') {
        return { changed: false, effectivePolicy: policyWithPresetSummaries(projectView, clock()) };
      }
      return {
        changed: false,
        effectivePolicy: policyWithPresetSummaries(projectView, clock(), request.mode),
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

    const persisted = hostBindingStore?.beginAgentAccessOperation({
      projectId,
      idempotencyKey: request.idempotencyKey,
      fingerprint,
    });
    if (persisted?.status === 'COMPLETED') {
      return { ...structuredClone(persisted.result), idempotentReplay: true };
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
      hostBindingStore?.completeAgentAccessOperation({
        projectId,
        idempotencyKey: request.idempotencyKey,
        fingerprint,
        result,
      });
      return { ...structuredClone(result), idempotentReplay: false };
    } catch (error) {
      operations.delete(operationKey);
      throw error;
    }
  }

  async function listBindings(projectId) {
    await studioService.readProjectTrusted(projectId);
    return hostBindingStore?.listForProject(projectId) ?? [];
  }

  async function listPendingHosts(projectId) {
    await studioService.readProjectTrusted(projectId);
    return pairingBroker?.list(projectId) ?? [];
  }

  async function createBinding(projectId, rawBody) {
    if (!hostBindingStore || !pairingBroker) {
      throw new StudioError('HOST_BINDING_DISABLED', 'MCP HostBindings require the SQLite Studio store.');
    }
    const request = validateBindingApproval(rawBody);
    const operationKey = `binding-approve.${stableOperationId(projectId, request.idempotencyKey)}`;
    const fingerprint = JSON.stringify({ projectId, pendingHostId: request.pendingHostId, action: 'approve' });
    const run = hostMutationQueue.then(async () => {
      const persisted = hostBindingStore.beginAgentAccessOperation({
        projectId, idempotencyKey: operationKey, fingerprint,
      });
      if (persisted.status === 'COMPLETED') {
        return { ...persisted.result, idempotentReplay: true };
      }
      pairingBroker.get(projectId, request.pendingHostId);
      const projectView = await studioService.readProjectTrusted(projectId);
      const now = clock();
      const grant = activeGrant(projectView.snapshot, now);
      if (!grant) {
        throw new StudioError('GRANT_NOT_ACTIVE', 'Choose an active Agent access mode before creating an MCP connection.');
      }
      if (effectiveAgentAccessProjection(projectView, { now }).mode === 'propose_draft'
        && !agentTaskService?.hasTask(projectId, grant.taskId, grant.branchId)) {
        throw new StudioError('DRAFT_BRANCH_NOT_AVAILABLE_1B', 'Draft MCP hosts require a live isolated Checkpoint 4 task branch.');
      }
      let issued = null;
      try {
        issued = hostBindingStore.issue({
          projectId,
          grantId: grant.id,
          agentId: grant.agentId,
          taskId: grant.taskId,
          branchId: grant.branchId,
          issuedBy: projectView.snapshot.project.ownerId,
          expiresAt: grant.expiresAt ?? null,
        });
        const result = {
          schemaVersion: 1,
          binding: redactedBinding(issued.binding),
          pendingHostId: request.pendingHostId,
        };
        pairingBroker.approve(projectId, request.pendingHostId, {
          token: issued.token,
          binding: result.binding,
        });
        hostBindingStore.completeAgentAccessOperation({
          projectId, idempotencyKey: operationKey, fingerprint, result,
        });
        return { ...result, idempotentReplay: false };
      } catch (error) {
        if (issued) {
          try {
            hostBindingStore.revoke(issued.binding.bindingId, {
              revokedBy: projectView.snapshot.project.ownerId,
              reason: 'Pairing delivery failed before authorization completed.',
            });
          } catch {
            // A concurrent revocation is already fail-closed.
          }
        }
        hostBindingStore.abandonAgentAccessOperation({
          projectId, idempotencyKey: operationKey, fingerprint,
        });
        throw error;
      }
    });
    hostMutationQueue = run.catch(() => undefined);
    return run;
  }

  async function revokeBinding(projectId, bindingId, rawBody) {
    if (!hostBindingStore) {
      throw new StudioError('HOST_BINDING_DISABLED', 'MCP HostBindings require the SQLite Studio store.');
    }
    const request = validateBindingRevoke(rawBody);
    const operationKey = `binding-revoke.${stableOperationId(projectId, request.idempotencyKey)}`;
    const fingerprint = JSON.stringify({ projectId, bindingId, action: 'revoke' });
    const run = hostMutationQueue.then(async () => {
      const persisted = hostBindingStore.beginAgentAccessOperation({
        projectId, idempotencyKey: operationKey, fingerprint,
      });
      if (persisted.status === 'COMPLETED') return { ...persisted.result, idempotentReplay: true };
      const projectView = await studioService.readProjectTrusted(projectId);
      const binding = hostBindingStore.listForProject(projectId).find((candidate) => candidate.bindingId === bindingId);
      if (!binding) {
        throw new StudioError('HOST_BINDING_NOT_FOUND', 'The MCP connection does not belong to this project.');
      }
      const result = binding.status === 'REVOKED'
        ? { schemaVersion: 1, bindingId, revokedAt: binding.revokedAt }
        : hostBindingStore.revoke(bindingId, {
          revokedBy: projectView.snapshot.project.ownerId,
          reason: 'Revoked from the human Agent access panel.',
        });
      hostBindingStore.completeAgentAccessOperation({
        projectId, idempotencyKey: operationKey, fingerprint, result,
      });
      return { ...result, idempotentReplay: false };
    });
    hostMutationQueue = run.catch(() => undefined);
    return run;
  }

  return Object.freeze({ read, change, listBindings, listPendingHosts, createBinding, revokeBinding });
}

export const AGENT_ACCESS_PRESETS = PRESETS;
