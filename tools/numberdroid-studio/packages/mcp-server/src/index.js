import { MAX_ATLAS_JOB_ATTEMPTS, StudioError } from '../../domain/src/index.js';

function commandInputSchema(definition) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'commandId', 'idempotencyKey', 'projectId', 'baseRevision', 'expectedVersion', 'payload'],
    properties: {
      schemaVersion: { type: 'integer', enum: [1] },
      commandId: { type: 'string' },
      idempotencyKey: { type: 'string' },
      projectId: { type: 'string' },
      baseRevision: { type: 'integer', minimum: 0 },
      expectedVersion: { type: 'integer', minimum: 0 },
      dryRun: { type: 'boolean', default: false },
      payload: definition.payloadSchema,
    },
  };
}

/**
 * Transport-neutral, MCP-shaped tool contract. The official MCP SDK transport
 * is a Checkpoint 1B adapter; it registers these secured definitions without
 * duplicating application behavior.
 */
export function createAgentToolCatalog(studioService, { contextProvider } = {}) {
  if (!studioService) {
    throw new StudioError('VALIDATION_ERROR', 'A StudioService is required.');
  }
  if (typeof contextProvider !== 'function') {
    throw new StudioError('VALIDATION_ERROR', 'A trusted MCP host contextProvider is required.');
  }

  const agentDefinitions = studioService.commandCatalog.filter(
    (definition) => !definition.ownerOnly
      && definition.type !== 'project.create'
      && (!definition.requiresDurableAgentLedger || studioService.agentAttemptAuditReady === true)
      && (!definition.requiresDurableJobStore || studioService.durableJobStoreReady === true),
  );

  async function authority(invocationContext, requestedProjectId) {
    const context = await contextProvider(invocationContext);
    if (!context?.projectId) {
      throw new StudioError(
        'UNTRUSTED_AGENT_CONTEXT',
        'The MCP host did not provide a trusted project binding.',
      );
    }
    if (context.projectId !== requestedProjectId) {
      throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside the MCP host context.', {
        contextProjectId: context.projectId,
        requestedProjectId,
      });
    }
    return context;
  }

  const commandTools = agentDefinitions.map((definition) => ({
    name: definition.toolName,
    title: definition.type,
    description: definition.description,
    inputSchema: commandInputSchema(definition),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (input, invocationContext) => {
      const context = await authority(invocationContext, input.projectId);
      return studioService.execute({
        schemaVersion: input.schemaVersion,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        type: definition.type,
        projectId: input.projectId,
        baseRevision: input.baseRevision,
        expectedVersion: input.expectedVersion,
        dryRun: input.dryRun ?? false,
        payload: input.payload,
      }, context, { signal: invocationContext?.mcpReq?.signal });
    },
  }));

  const atlasJobTools = studioService.durableJobStoreReady === true
    && studioService.agentAttemptAuditReady === true ? [
    {
      name: 'studio_atlas_propose_grid',
      title: 'Propose an atlas grid',
      description: 'Calculate a non-authoritative regular-grid proposal for an approved PNG source without pixel inference or mutation.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'projectId', 'expectedRevision', 'sourceId', 'rows', 'columns', 'margins', 'gapX', 'gapY'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] },
          projectId: { type: 'string' },
          expectedRevision: { type: 'integer', minimum: 1 },
          sourceId: { type: 'string' },
          rows: { type: 'integer', minimum: 1, maximum: 64 },
          columns: { type: 'integer', minimum: 1, maximum: 64 },
          margins: {
            type: 'object', additionalProperties: false,
            required: ['top', 'right', 'bottom', 'left'],
            properties: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, { type: 'integer', minimum: 0 }])),
          },
          gapX: { type: 'integer', minimum: 0 },
          gapY: { type: 'integer', minimum: 0 },
          rectangleIdPrefix: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        const context = await authority(invocationContext, input.projectId);
        return studioService.proposeAtlasGrid(input, context, { signal: invocationContext?.mcpReq?.signal });
      },
    },
    {
      name: 'studio_job_read',
      title: 'Read a Studio job',
      description: 'Read the current durable state and result metadata for a project-scoped Studio job.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'projectId', 'jobId'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] },
          projectId: { type: 'string' },
          jobId: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        const context = await authority(invocationContext, input.projectId);
        return studioService.readJob(input, context, { signal: invocationContext?.mcpReq?.signal });
      },
    },
    {
      name: 'studio_job_cancel',
      title: 'Cancel a Studio job',
      description: 'Request durable cooperative cancellation of a queued or running atlas preview job.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'projectId', 'jobId', 'operationIdempotencyKey'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] }, projectId: { type: 'string' },
          jobId: { type: 'string' }, operationIdempotencyKey: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        const context = await authority(invocationContext, input.projectId);
        return studioService.cancelJob(input, context, { signal: invocationContext?.mcpReq?.signal });
      },
    },
    {
      name: 'studio_job_retry',
      title: 'Retry a Studio job',
      description: 'Queue a new audited attempt for a failed or cancelled atlas preview job.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'projectId', 'jobId', 'expectedAttempt', 'operationIdempotencyKey'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] }, projectId: { type: 'string' },
          jobId: { type: 'string' }, expectedAttempt: { type: 'integer', minimum: 1, maximum: MAX_ATLAS_JOB_ATTEMPTS },
          operationIdempotencyKey: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        const context = await authority(invocationContext, input.projectId);
        return studioService.retryJob(input, context, { signal: invocationContext?.mcpReq?.signal });
      },
    },
    {
      name: 'studio_job_discard',
      title: 'Discard a Studio job',
      description: 'Release temporary outputs from a terminal unapplied job; applied jobs cannot be discarded.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'projectId', 'jobId', 'operationIdempotencyKey'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] }, projectId: { type: 'string' },
          jobId: { type: 'string' }, operationIdempotencyKey: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        const context = await authority(invocationContext, input.projectId);
        return studioService.discardJob(input, context, { signal: invocationContext?.mcpReq?.signal });
      },
    },
  ] : [];

  return [
    {
      name: 'studio_command_catalog_list',
      title: 'List Studio semantic commands',
      description: 'Return the exact command catalog exposed to visual and agent adapters.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async () => ({ schemaVersion: 1, commands: agentDefinitions }),
    },
    {
      name: 'studio_project_read',
      title: 'Read Studio project head',
      description: 'Read the current project snapshot when the actor has project.read.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'projectId'],
        properties: { schemaVersion: { type: 'integer', enum: [1] }, projectId: { type: 'string' } },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input, invocationContext) => {
        if (input.schemaVersion !== 1) {
          throw new StudioError('SCHEMA_VERSION_UNSUPPORTED', 'Unsupported Studio read schema version.', {
            schemaVersion: input.schemaVersion,
            supported: [1],
          });
        }
        const context = await authority(invocationContext, input.projectId);
        return studioService.readProject(
          { projectId: input.projectId },
          context,
          { signal: invocationContext?.mcpReq?.signal },
        );
      },
    },
    ...commandTools,
    ...atlasJobTools,
  ];
}

export function findAgentTool(tools, name) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new StudioError('TOOL_NOT_FOUND', `Unknown Studio agent tool: ${name}.`, { name });
  }
  return tool;
}

export { buildOfficialMcpServer, serveOfficialMcpStdio } from './official-server.js';
export { jsonSchemaToZod } from './schema-adapter.js';
