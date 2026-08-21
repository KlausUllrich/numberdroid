import { COMMAND_DEFINITIONS, KNOWN_GRANT_SCOPES, getCommandDefinition, listCommandDefinitions } from '../../domain/src/command-catalog.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { headRevision } from './project-store.js';
import {
  optionalString,
  requireActor,
  requireArtifactUri,
  requireEnum,
  requireId,
  requireInteger,
  requireIsoDate,
  requireRecord,
  requireString,
} from '../../domain/src/validation.js';
import { deepClone, deepFreeze, fingerprint } from './value-utils.js';

const PROJECT_STATUSES = ['draft', 'active', 'paused', 'in_review', 'archived'];
const SOURCE_MEDIA_TYPES = ['image/png', 'image/webp'];
const ASSET_KINDS = ['surface', 'prop', 'item'];
const ASSET_STATUSES = ['draft', 'in_review'];

const AUTHORITY_FIELDS = ['actor', 'taskId', 'grantId', 'branchId', 'bindingToken', 'issuerActorId'];

function validateExecutionContext(raw) {
  const context = requireRecord(raw, 'trustedExecutionContext');
  const actor = requireActor(context.actor);
  return {
    actor,
    taskId: context.taskId === undefined || context.taskId === null ? null : requireId(context.taskId, 'trustedExecutionContext.taskId'),
    grantId: context.grantId === undefined || context.grantId === null ? null : requireId(context.grantId, 'trustedExecutionContext.grantId'),
    branchId: context.branchId === undefined || context.branchId === null ? null : requireId(context.branchId, 'trustedExecutionContext.branchId'),
    correlationId: context.correlationId === undefined || context.correlationId === null
      ? null
      : requireId(context.correlationId, 'trustedExecutionContext.correlationId'),
  };
}

function validateEnvelope(raw, rawExecutionContext) {
  const envelope = requireRecord(raw, 'command');
  for (const field of AUTHORITY_FIELDS) {
    invariant(!Object.hasOwn(envelope, field), 'UNTRUSTED_AUTHORITY_FIELD', `Command DTO must not contain authority field: ${field}.`, {
      field,
    });
  }
  const executionContext = validateExecutionContext(rawExecutionContext);
  const schemaVersion = requireInteger(envelope.schemaVersion, 'schemaVersion', { min: 1 });
  const type = requireString(envelope.type, 'type', { max: 100 });
  const dryRun = envelope.dryRun === undefined ? false : envelope.dryRun;
  const baseRevision = requireInteger(envelope.baseRevision, 'baseRevision', { min: 0 });
  const expectedVersion = requireInteger(envelope.expectedVersion, 'expectedVersion', { min: 0 });
  invariant(getCommandDefinition(type), 'UNKNOWN_COMMAND', `Unknown Studio command: ${type}.`, { type });
  invariant(schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported Studio command schema version.', {
    schemaVersion,
    supported: [1],
  });
  invariant(typeof dryRun === 'boolean', 'VALIDATION_ERROR', 'dryRun must be a boolean.', { field: 'dryRun' });
  invariant(
    baseRevision === expectedVersion,
    'VERSION_INVARIANT_VIOLATION',
    'Checkpoint 1A requires expectedVersion to equal the project baseRevision.',
    { baseRevision, expectedVersion },
  );
  const payload = requireRecord(envelope.payload ?? {}, 'payload');
  assertNoEmbeddedDataUris(payload);
  return {
    schemaVersion,
    commandId: requireId(envelope.commandId, 'commandId'),
    idempotencyKey: requireId(envelope.idempotencyKey, 'idempotencyKey'),
    type,
    projectId: requireId(envelope.projectId, 'projectId'),
    baseRevision,
    expectedVersion,
    dryRun,
    ...executionContext,
    payload,
  };
}

function assertNoEmbeddedDataUris(value, path = 'payload') {
  if (typeof value === 'string') {
    invariant(!value.trimStart().startsWith('data:'), 'EMBEDDED_ARTIFACT_FORBIDDEN', 'Payloads must use artifact URIs, not embedded data URIs.', {
      field: path,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoEmbeddedDataUris(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertNoEmbeddedDataUris(child, `${path}.${key}`);
  }
}

function commandFingerprint(command) {
  return fingerprint({
    schemaVersion: command.schemaVersion,
    type: command.type,
    projectId: command.projectId,
    baseRevision: command.baseRevision,
    expectedVersion: command.expectedVersion,
    actor: command.actor,
    taskId: command.taskId,
    grantId: command.grantId,
    branchId: command.branchId,
    payload: command.payload,
  });
}

function findCommandRevision(document, commandId) {
  return document.revisions.find((revision) => revision.command.commandId === commandId) ?? null;
}

function findIdempotentRevision(document, key) {
  return document.revisions.find((revision) => revision.command.idempotencyKey === key) ?? null;
}

function replayResult(revision) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.number,
    value: deepClone(revision.result),
    event: deepClone(revision.event),
    replayed: true,
  });
}

function committedResult(revision) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.number,
    value: deepClone(revision.result),
    event: deepClone(revision.event),
    replayed: false,
  });
}

function proposalResult(revision, definition) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.parentRevision,
    value: deepClone(revision.result),
    event: null,
    replayed: false,
    dryRun: true,
    proposal: {
      commandType: revision.command.type,
      baseRevision: revision.parentRevision,
      expectedVersion: revision.parentRevision,
      wouldCreateRevision: revision.number,
      summary: revision.event.summary,
      changes: deepClone(revision.event.changes),
      findings: [],
      requiredCapabilities: definition.requiredScope ? [definition.requiredScope] : [],
    },
  });
}

function redactAgentOnlySourceLocations(snapshot) {
  const redacted = deepClone(snapshot);
  redacted.sources = redacted.sources.map((source) => (
    /^studio:\/\/artifacts\/sha256\/[a-f0-9]{64}$/.test(source.artifactUri)
      ? source
      : { ...source, artifactUri: null, artifactAvailability: 'LEGACY_EXTERNAL_LOCATION_REDACTED' }
  ));
  return redacted;
}

function assertReplayMatches(revision, incomingFingerprint) {
  invariant(
    revision.command.fingerprint === incomingFingerprint,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used for a different command.',
    {
      idempotencyKey: revision.command.idempotencyKey,
      originalCommandId: revision.command.commandId,
      originalRevision: revision.number,
    },
  );
}

function assertAuthorized(command, snapshot, definition, now) {
  if (command.actor.kind === 'human' && command.actor.id === snapshot.project.ownerId) {
    return;
  }

  invariant(!definition.ownerOnly, 'FORBIDDEN', 'Only the project owner may run this command.', {
    commandType: command.type,
  });
  invariant(command.actor.kind === 'agent', 'FORBIDDEN', 'This command requires the project owner or a granted agent.');
  invariant(command.taskId && command.grantId, 'GRANT_REQUIRED', 'Agent commands require taskId and grantId.', {
    commandType: command.type,
  });

  const grant = snapshot.grants.find((candidate) => candidate.id === command.grantId);
  invariant(grant, 'GRANT_NOT_FOUND', 'The requested grant does not exist.', { grantId: command.grantId });
  invariant(grant.revokedAt === null, 'GRANT_REVOKED', 'The requested grant has been revoked.', {
    grantId: grant.id,
  });
  invariant(grant.agentId === command.actor.id, 'GRANT_ACTOR_MISMATCH', 'The grant belongs to another agent.', {
    grantId: grant.id,
  });
  invariant(grant.taskId === command.taskId, 'GRANT_TASK_MISMATCH', 'The grant belongs to another task.', {
    grantId: grant.id,
  });
  invariant(grant.branchId === command.branchId, 'GRANT_BRANCH_MISMATCH', 'The grant belongs to another branch.', {
    expectedBranchId: grant.branchId,
  });
  invariant(!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now), 'GRANT_EXPIRED', 'The grant has expired.', {
    grantId: grant.id,
    expiresAt: grant.expiresAt,
  });
  invariant(grant.scopes.includes(definition.requiredScope), 'GRANT_SCOPE_MISSING', 'The grant lacks the required scope.', {
    grantId: grant.id,
    requiredScope: definition.requiredScope,
  });
  invariant(
    grant.objectScopes.some((scope) => scope.kind === 'project' && scope.id === command.projectId),
    'OBJECT_SCOPE_DENIED',
    'The grant does not cover this project object scope.',
  );
  invariant(grant.usage.commands < grant.budget.maxCommands, 'BUDGET_EXCEEDED', 'The grant command budget is exhausted.', {
    consumed: grant.usage.commands,
    limit: grant.budget.maxCommands,
  });
}

function validateScopes(value) {
  invariant(Array.isArray(value) && value.length > 0, 'VALIDATION_ERROR', 'scopes must be a non-empty array.');
  const scopes = [...new Set(value.map((scope, index) => requireString(scope, `scopes[${index}]`, { max: 100 })))];
  for (const scope of scopes) {
    invariant(KNOWN_GRANT_SCOPES.includes(scope), 'VALIDATION_ERROR', `Unknown grant scope: ${scope}.`, { scope });
  }
  return scopes.sort();
}

function validateObjectScopes(value) {
  invariant(Array.isArray(value) && value.length > 0, 'VALIDATION_ERROR', 'objectScopes must be a non-empty array.');
  return value.map((candidate, index) => {
    const scope = requireRecord(candidate, `payload.objectScopes[${index}]`);
    return {
      kind: requireString(scope.kind, `payload.objectScopes[${index}].kind`, { max: 100 }),
      id: requireId(scope.id, `payload.objectScopes[${index}].id`),
    };
  });
}

function validateBudget(value) {
  const budget = requireRecord(value, 'payload.budget');
  return {
    maxCommands: requireInteger(budget.maxCommands, 'payload.budget.maxCommands', { min: 1 }),
    maxJobs: requireInteger(budget.maxJobs, 'payload.budget.maxJobs', { min: 0 }),
    maxArtifactBytes: requireInteger(budget.maxArtifactBytes, 'payload.budget.maxArtifactBytes', { min: 0 }),
    maxCostCents: budget.maxCostCents === undefined
      ? 0
      : requireInteger(budget.maxCostCents, 'payload.budget.maxCostCents', { min: 0 }),
  };
}

function applyCommand(command, snapshot, now) {
  const payload = command.payload;
  const next = deepClone(snapshot);
  next.project.updatedAt = now;
  if (command.actor.kind === 'agent') {
    const grantIndex = next.grants.findIndex((grant) => grant.id === command.grantId);
    next.grants[grantIndex] = {
      ...next.grants[grantIndex],
      usage: {
        ...next.grants[grantIndex].usage,
        commands: next.grants[grantIndex].usage.commands + 1,
      },
    };
  }

  switch (command.type) {
    case 'grant.issue': {
      const grantId = requireId(payload.grantId, 'payload.grantId');
      invariant(!next.grants.some((grant) => grant.id === grantId), 'ENTITY_EXISTS', 'The grant ID already exists.', {
        grantId,
      });
      const taskId = requireId(payload.taskId, 'payload.taskId');
      invariant(command.taskId === null || command.taskId === taskId, 'VALIDATION_ERROR', 'Envelope taskId and grant taskId differ.');
      const grant = {
        id: grantId,
        agentId: requireId(payload.agentId, 'payload.agentId'),
        taskId,
        branchId: requireId(payload.branchId, 'payload.branchId'),
        scopes: validateScopes(payload.scopes),
        objectScopes: validateObjectScopes(payload.objectScopes),
        budget: validateBudget(payload.budget),
        usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
        expiresAt: payload.expiresAt ? requireIsoDate(payload.expiresAt, 'payload.expiresAt') : null,
        issuedAt: now,
        issuedBy: command.actor.id,
        revokedAt: null,
        revokeReason: null,
        status: 'ACTIVE',
      };
      next.grants.push(grant);
      return {
        snapshot: next,
        result: { grantId },
        summary: `Grant ${grantId} issued to ${grant.agentId} for task ${taskId}.`,
        changes: [{ entityType: 'grant', entityId: grantId, operation: 'created' }],
      };
    }
    case 'grant.revoke': {
      const grantId = requireId(payload.grantId, 'payload.grantId');
      const index = next.grants.findIndex((grant) => grant.id === grantId);
      invariant(index >= 0, 'ENTITY_NOT_FOUND', 'The grant does not exist.', { grantId });
      invariant(next.grants[index].revokedAt === null, 'ENTITY_STATE_CONFLICT', 'The grant is already revoked.', {
        grantId,
      });
      next.grants[index] = {
        ...next.grants[index],
        revokedAt: now,
        revokeReason: optionalString(payload.reason, 'payload.reason', { max: 500 }),
        status: 'REVOKED',
      };
      return {
        snapshot: next,
        result: { grantId },
        summary: `Grant ${grantId} revoked.`,
        changes: [{ entityType: 'grant', entityId: grantId, operation: 'revoked' }],
      };
    }
    case 'project.status.set': {
      const status = requireEnum(payload.status, 'payload.status', PROJECT_STATUSES);
      next.project.status = status;
      next.project.statusNote = optionalString(payload.note, 'payload.note', { max: 1000 });
      return {
        snapshot: next,
        result: { status },
        summary: `Project status changed to ${status}.`,
        changes: [{ entityType: 'project', entityId: command.projectId, operation: 'status_changed' }],
      };
    }
    case 'source.register': {
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      invariant(!next.sources.some((source) => source.id === sourceId), 'ENTITY_EXISTS', 'The source ID already exists.', {
        sourceId,
      });
      const provenance = requireRecord(payload.provenance, 'payload.provenance');
      const source = {
        id: sourceId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        artifactUri: requireArtifactUri(payload.artifactUri, 'payload.artifactUri'),
        mediaType: requireEnum(payload.mediaType, 'payload.mediaType', SOURCE_MEDIA_TYPES),
        width: payload.width === undefined ? null : requireInteger(payload.width, 'payload.width', { min: 1 }),
        height: payload.height === undefined ? null : requireInteger(payload.height, 'payload.height', { min: 1 }),
        provenance: {
          prompt: requireString(provenance.prompt, 'payload.provenance.prompt', { max: 20000 }),
          seed: provenance.seed ?? null,
          model: optionalString(provenance.model, 'payload.provenance.model', { max: 200 }),
          generator: optionalString(provenance.generator, 'payload.provenance.generator', { max: 200 }),
        },
        registeredAt: now,
        registeredBy: command.actor.id,
      };
      invariant(
        typeof source.provenance.seed === 'string' || typeof source.provenance.seed === 'number' || source.provenance.seed === null,
        'VALIDATION_ERROR',
        'payload.provenance.seed must be a string, number, or null.',
      );
      next.sources.push(source);
      return {
        snapshot: next,
        result: { sourceId },
        summary: `Source ${sourceId} registered with reproducible provenance.`,
        changes: [{ entityType: 'source', entityId: sourceId, operation: 'created' }],
      };
    }
    case 'asset.define': {
      const assetId = requireId(payload.assetId, 'payload.assetId');
      invariant(!next.assets.some((asset) => asset.id === assetId), 'ENTITY_EXISTS', 'The asset ID already exists.', {
        assetId,
      });
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      invariant(next.sources.some((source) => source.id === sourceId), 'ENTITY_NOT_FOUND', 'The source does not exist.', {
        sourceId,
      });
      const region = requireRecord(payload.region, 'payload.region');
      const asset = {
        id: assetId,
        sourceId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        kind: requireEnum(payload.kind, 'payload.kind', ASSET_KINDS),
        region: {
          x: requireInteger(region.x, 'payload.region.x', { min: 0 }),
          y: requireInteger(region.y, 'payload.region.y', { min: 0 }),
          width: requireInteger(region.width, 'payload.region.width', { min: 1 }),
          height: requireInteger(region.height, 'payload.region.height', { min: 1 }),
        },
        properties: payload.properties === undefined ? {} : deepClone(requireRecord(payload.properties, 'payload.properties')),
        status: payload.status === undefined ? 'draft' : requireEnum(payload.status, 'payload.status', ASSET_STATUSES),
        definedAt: now,
        definedBy: command.actor.id,
      };
      next.assets.push(asset);
      return {
        snapshot: next,
        result: { assetId },
        summary: `${asset.kind} asset ${assetId} defined from source ${sourceId}.`,
        changes: [{ entityType: 'asset', entityId: assetId, operation: 'created' }],
      };
    }
    default:
      throw new StudioError('UNKNOWN_COMMAND', `Unknown Studio command: ${command.type}.`);
  }
}

function createRevision({ command, number, now, commandHash, snapshot, result, summary, changes }) {
  const event = {
    id: `activity:${command.commandId}`,
    projectId: command.projectId,
    revision: number,
    occurredAt: now,
    actor: deepClone(command.actor),
    taskId: command.taskId,
    commandId: command.commandId,
    commandType: command.type,
    status: 'committed',
    summary,
    changes: deepClone(changes),
  };
  return deepFreeze({
    id: `revision:${number}`,
    number,
    parentRevision: number - 1,
    committedAt: now,
    command: {
      schemaVersion: command.schemaVersion,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      type: command.type,
      actor: deepClone(command.actor),
      taskId: command.taskId,
      grantId: command.grantId,
      fingerprint: commandHash,
    },
    snapshot: deepClone(snapshot),
    result: deepClone(result),
    event,
  });
}

function createProjectRevision(command, now, commandHash) {
  invariant(command.actor.kind === 'human', 'FORBIDDEN', 'A human owner must create the project.');
  invariant(command.actor.id === command.payload.ownerId, 'FORBIDDEN', 'The creating actor must be the project owner.');
  invariant(command.baseRevision === 0, 'REVISION_CONFLICT', 'A new project must use baseRevision 0.');
  const name = requireString(command.payload.name, 'payload.name', { max: 160 });
  const snapshot = {
    project: {
      id: command.projectId,
      name,
      description: optionalString(command.payload.description, 'payload.description', { max: 2000 }),
      ownerId: requireId(command.payload.ownerId, 'payload.ownerId'),
      status: 'draft',
      statusNote: null,
      createdAt: now,
      updatedAt: now,
    },
    grants: [],
    sources: [],
    assets: [],
    rooms: [],
    levels: [],
  };
  return createRevision({
    command,
    number: 1,
    now,
    commandHash,
    snapshot,
    result: { projectId: command.projectId },
    summary: `Project ${name} created.`,
    changes: [{ entityType: 'project', entityId: command.projectId, operation: 'created' }],
  });
}

export class StudioService {
  #store;
  #clock;

  constructor({ store, clock = () => new Date().toISOString() }) {
    invariant(store, 'VALIDATION_ERROR', 'A ProjectStore is required.');
    this.#store = store;
    this.#clock = clock;
  }

  get commandCatalog() {
    return listCommandDefinitions();
  }

  async execute(rawCommand, trustedExecutionContext) {
    const command = validateEnvelope(rawCommand, trustedExecutionContext);
    const definition = getCommandDefinition(command.type);
    const commandHash = commandFingerprint(command);
    const existing = await this.#store.loadProject(command.projectId);

    if (existing) {
      if (!command.dryRun) {
        const prior = findIdempotentRevision(existing, command.idempotencyKey);
        if (prior) {
          assertReplayMatches(prior, commandHash);
          return replayResult(prior);
        }
      }
      const duplicateCommand = findCommandRevision(existing, command.commandId);
      invariant(!duplicateCommand, 'COMMAND_ID_CONFLICT', 'The command ID was already committed.', {
        commandId: command.commandId,
        originalRevision: duplicateCommand?.number,
      });
    }

    const now = this.#clock();
    requireIsoDate(now, 'clock');

    if (command.type === 'project.create') {
      invariant(!existing, 'PROJECT_EXISTS', 'The project already exists.', { projectId: command.projectId });
      const revision = createProjectRevision(command, now, commandHash);
      if (command.dryRun) {
        return proposalResult(revision, definition);
      }
      try {
        await this.#store.createProject({
          formatVersion: 1,
          projectId: command.projectId,
          createdAt: now,
          revisions: [revision],
        });
        return committedResult(revision);
      } catch (error) {
        return this.#replayAfterConcurrentCommit(error, command, commandHash);
      }
    }

    invariant(existing, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId: command.projectId });
    const head = headRevision(existing);
    invariant(command.baseRevision === head.number, 'REVISION_CONFLICT', 'The project changed after the command was prepared.', {
      projectId: command.projectId,
      expectedRevision: command.baseRevision,
      actualRevision: head.number,
    });
    assertAuthorized(command, head.snapshot, definition, now);
    const applied = applyCommand(command, head.snapshot, now);
    const revision = createRevision({
      command,
      number: head.number + 1,
      now,
      commandHash,
      ...applied,
    });
    if (command.dryRun) {
      return proposalResult(revision, definition);
    }

    try {
      await this.#store.appendRevision(command.projectId, command.baseRevision, revision);
      return committedResult(revision);
    } catch (error) {
      return this.#replayAfterConcurrentCommit(error, command, commandHash);
    }
  }

  async #replayAfterConcurrentCommit(error, command, commandHash) {
    if (!['PROJECT_EXISTS', 'REVISION_CONFLICT'].includes(error?.code)) {
      throw error;
    }
    const latest = await this.#store.loadProject(command.projectId);
    const prior = latest && findIdempotentRevision(latest, command.idempotencyKey);
    if (!prior) {
      const duplicateCommand = latest && findCommandRevision(latest, command.commandId);
      if (duplicateCommand) {
        throw new StudioError('COMMAND_ID_CONFLICT', 'The command ID was concurrently committed with another idempotency key.', {
          commandId: command.commandId,
          originalRevision: duplicateCommand.number,
        });
      }
      throw error;
    }
    assertReplayMatches(prior, commandHash);
    return replayResult(prior);
  }

  async readProjectTrusted(projectId) {
    requireId(projectId, 'projectId');
    const document = await this.#store.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    return deepFreeze({
      schemaVersion: 1,
      projectId,
      revision: head.number,
      snapshot: deepClone(head.snapshot),
    });
  }

  async readProject(request, trustedExecutionContext) {
    const input = requireRecord(request, 'request');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(input, field), 'UNTRUSTED_AUTHORITY_FIELD', `Read request must not contain authority field: ${field}.`, {
        field,
      });
    }
    const projectId = requireId(input.projectId, 'projectId');
    const { actor, taskId, grantId, branchId } = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    assertAuthorized(
      { actor, taskId, grantId, branchId, projectId, type: 'project.read' },
      head.snapshot,
      { ownerOnly: false, requiredScope: 'project.read' },
      this.#clock(),
    );
    if (actor.kind === 'agent') {
      const effectiveGrant = head.snapshot.grants.find((grant) => grant.id === grantId);
      const { grants: _secretGrants, ...redactedSnapshot } = redactAgentOnlySourceLocations(head.snapshot);
      return deepFreeze({
        schemaVersion: 1,
        projectId,
        revision: head.number,
        snapshot: redactedSnapshot,
        effectivePolicy: {
          taskId: effectiveGrant.taskId,
          branchId: effectiveGrant.branchId,
          scopes: [...effectiveGrant.scopes],
          objectScopes: deepClone(effectiveGrant.objectScopes),
          budget: deepClone(effectiveGrant.budget),
          usage: deepClone(effectiveGrant.usage),
          status: 'active',
          expiresAt: effectiveGrant.expiresAt,
        },
      });
    }
    return deepFreeze({ schemaVersion: 1, projectId, revision: head.number, snapshot: deepClone(head.snapshot) });
  }

  async listActivityTrusted(projectId, { afterRevision = 0 } = {}) {
    requireId(projectId, 'projectId');
    requireInteger(afterRevision, 'afterRevision', { min: 0 });
    const document = await this.#store.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    return deepFreeze(
      document.revisions
        .filter((revision) => revision.number > afterRevision)
        .map((revision) => deepClone(revision.event)),
    );
  }

  async listProjectsTrusted() {
    return deepFreeze(await this.#store.listProjects());
  }
}

export function implementedCommandTypes() {
  return COMMAND_DEFINITIONS.map((definition) => definition.type);
}
