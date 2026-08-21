import { StudioError } from '../../domain/src/index.js';

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
    (definition) => !definition.ownerOnly && definition.type !== 'project.create',
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
