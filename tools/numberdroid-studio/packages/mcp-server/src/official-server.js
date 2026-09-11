import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import {
  createAgentToolCatalog,
  findAgentTool,
} from './index.js';
import {
  AUTHORING_V2_CAPABILITIES_URI_TEMPLATE,
  authorizeAgentProject,
  createAuthoringV2McpSurface,
} from './authoring-v2.js';
import { jsonSchemaToZod } from './schema-adapter.js';

function redactTerminalDetails(value) {
  if (Array.isArray(value)) return value.map(redactTerminalDetails);
  if (!value || typeof value !== 'object') return value;
  const sensitiveKeys = new Set([
    'authorization', 'bindingId', 'bindingToken', 'cause', 'directory', 'endpoint',
    'filename', 'grantId', 'path', 'socket', 'token',
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeys.has(key)
      && !/(?:secret|password|credential|privatekey)/i.test(key))
    .map(([key, entry]) => [key, redactTerminalDetails(entry)]));
}

export function officialErrorPayload(error) {
  const declaredCode = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(error.code)
    ? error.code
    : 'INTERNAL_ERROR';
  const internal = declaredCode === 'INTERNAL_ERROR';
  return {
    schemaVersion: 1,
    status: 'ERROR',
    error: {
      code: declaredCode,
      message: internal ? 'Unexpected Studio error.' : (error?.message ?? 'Studio request failed.'),
      details: internal ? {} : redactTerminalDetails(error?.details ?? {}),
    },
  };
}

function toolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function toolError(error) {
  const payload = officialErrorPayload(error);
  return {
    content: [{ type: 'text', text: `${payload.error.code}: ${payload.error.message}` }],
    structuredContent: payload,
    isError: true,
  };
}

function operationContext(invocationContext, requestAbortRegistry) {
  const sourceSignal = invocationContext?.mcpReq?.signal;
  const requestId = invocationContext?.mcpReq?.id;
  const controller = new AbortController();
  const abort = () => controller.abort(sourceSignal?.reason);
  if (sourceSignal?.aborted) abort();
  else sourceSignal?.addEventListener('abort', abort, { once: true });
  if (requestId !== undefined) requestAbortRegistry?.set(requestId, controller);
  return {
    context: invocationContext?.mcpReq
      ? { ...invocationContext, mcpReq: { ...invocationContext.mcpReq, signal: controller.signal } }
      : invocationContext,
    signal: controller.signal,
    cleanup() {
      sourceSignal?.removeEventListener('abort', abort);
      if (requestId !== undefined && requestAbortRegistry?.get(requestId) === controller) {
        requestAbortRegistry.delete(requestId);
      }
    },
  };
}

export class CancellationAwareStdioTransport {
  #inner;
  #requestAbortRegistry;
  onmessage;
  onclose;
  onerror;

  constructor({ requestAbortRegistry, inner = new StdioServerTransport() }) {
    this.#requestAbortRegistry = requestAbortRegistry;
    this.#inner = inner;
  }

  get sessionId() { return this.#inner.sessionId; }
  get hasPerRequestStream() { return this.#inner.hasPerRequestStream; }

  async start() {
    this.#inner.onmessage = (message, extra) => {
      if (message?.method === 'notifications/cancelled' && message.params?.requestId !== undefined) {
        this.#requestAbortRegistry.get(message.params.requestId)?.abort(message.params.reason);
      }
      this.onmessage?.(message, extra);
    };
    this.#inner.onclose = () => this.onclose?.();
    this.#inner.onerror = (error) => this.onerror?.(error);
    return this.#inner.start();
  }

  send(message, options) { return this.#inner.send(message, options); }
  setProtocolVersion(version) { return this.#inner.setProtocolVersion?.(version); }
  setSupportedProtocolVersions(versions) { return this.#inner.setSupportedProtocolVersions?.(versions); }

  async close() {
    for (const controller of this.#requestAbortRegistry.values()) controller.abort('MCP stdio transport closed');
    this.#requestAbortRegistry.clear();
    return this.#inner.close();
  }
}

export function buildOfficialMcpServer({
  studioGateway,
  contextProvider,
  serverContext,
  requestAbortRegistry = new Map(),
  authoringV2 = null,
  assemblyV1 = null,
  animationV1 = null,
  reviewV1 = null,
} = {}) {
  if (!studioGateway) throw new TypeError('studioGateway is required.');
  const catalog = createAgentToolCatalog(studioGateway, { contextProvider, authoringV2, assemblyV1, animationV1, reviewV1 });
  const authoringV2Surface = authoringV2 === null || authoringV2 === undefined
    ? null
    : createAuthoringV2McpSurface(studioGateway, authoringV2, {
      authorizeProject: (invocationContext, requestedProjectId) => authorizeAgentProject(
        contextProvider,
        invocationContext,
        requestedProjectId,
      ),
    });
  if (authoringV2Surface) {
    for (const requiredTool of [
      'studio_project_read',
      'studio_job_read',
      'studio_asset_query',
      'studio_room_query',
      'studio_task_read',
    ]) findAgentTool(catalog, requiredTool);
  }
  const server = new McpServer(
    { name: 'numberdroid-studio', version: '0.2.0' },
    {
      capabilities: { tools: {}, resources: {} },
      instructions: 'Semantic, revision-safe Numberdroid Studio authoring. Authority is host-bound and never supplied in tool arguments.',
    },
  );

  for (const tool of catalog) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: jsonSchemaToZod(tool.inputSchema),
        annotations: tool.annotations,
      },
      async (input, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          return toolResult(await tool.execute(input, operation.context));
        } catch (error) {
          if (operation.signal.aborted) throw error;
          return toolError(error);
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  const projectRead = findAgentTool(catalog, 'studio_project_read');
  server.registerResource(
    'studio-project',
    new ResourceTemplate('studio://projects/{projectId}', { list: undefined }),
    {
      title: 'Studio project head',
      description: 'Current redacted project projection at an explicit revision.',
      mimeType: 'application/json',
    },
    async (uri, { projectId }, invocationContext) => {
      const operation = operationContext(invocationContext, requestAbortRegistry);
      try {
        const value = await projectRead.execute({ schemaVersion: 1, projectId }, operation.context);
        return {
          contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
        };
      } catch (error) {
        if (operation.signal.aborted) throw error;
        const value = officialErrorPayload(error);
        return {
          contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
        };
      } finally {
        operation.cleanup();
      }
    },
  );

  const jobRead = catalog.find(({ name }) => name === 'studio_job_read');
  if (jobRead) {
    server.registerResource(
      'studio-job',
      new ResourceTemplate('studio://projects/{projectId}/jobs/{jobId}', { list: undefined }),
      {
        title: 'Studio job state',
        description: 'Current authorized state, progress, results, and project-scoped preview links for a durable Studio job.',
        mimeType: 'application/json',
      },
      async (uri, { projectId, jobId }, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const value = await jobRead.execute({ schemaVersion: 1, projectId, jobId }, operation.context);
          return {
            contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
          };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          const value = officialErrorPayload(error);
          return {
            contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
          };
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  const assetQuery = catalog.find(({ name }) => name === 'studio_asset_query');
  if (assetQuery) {
    server.registerResource(
      'studio-asset',
      new ResourceTemplate('studio://projects/{projectId}/assets/{assetId}', { list: undefined }),
      {
        title: 'Studio V2 asset',
        description: 'Current authorized V2 asset head, immutable slice lineage, findings, and proposal provenance.',
        mimeType: 'application/json',
      },
      async (uri, { projectId, assetId }, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const value = await assetQuery.execute({
            schemaVersion: 1,
            projectId,
            assetId,
            includeProposals: false,
            limit: 1,
          }, operation.context);
          return {
            contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
          };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          const value = officialErrorPayload(error);
          return {
            contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
          };
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  const roomQuery = catalog.find(({ name }) => name === 'studio_room_query');
  if (roomQuery) {
    server.registerResource(
      'studio-room',
      new ResourceTemplate('studio://projects/{projectId}/rooms/{roomVariantId}', { list: undefined }),
      {
        title: 'Studio room or hallway',
        description: 'Current authorized room/hallway head, immutable versions, findings, exact asset pins, and proposal lineage.',
        mimeType: 'application/json',
      },
      async (uri, { projectId, roomVariantId }, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const value = await roomQuery.execute({
            schemaVersion: 1,
            projectId,
            roomVariantId,
            includeVersions: true,
            includeProposals: true,
            limit: 1,
          }, operation.context);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          const value = officialErrorPayload(error);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  const assemblyQuery = catalog.find(({ name }) => name === 'studio_assembly_query');
  if (assemblyQuery) server.registerResource('studio-assembly', new ResourceTemplate('studio://projects/{projectId}/assemblies/{assetId}', { list: undefined }),
    { title: 'Studio Assembly', description: 'Exact saved Assembly, component versions and source lineage.', mimeType: 'application/json' },
    async (uri, { projectId, assetId }, invocationContext) => {
      const operation = operationContext(invocationContext, requestAbortRegistry);
      try {
        const value = await assemblyQuery.execute({ schemaVersion: 1, projectId, assetId, limit: 1 }, operation.context);
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
      } catch (error) {
        if (operation.signal.aborted) throw error;
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(officialErrorPayload(error)) }] };
      } finally { operation.cleanup(); }
    });

  if (animationV1 || reviewV1) {
    for (const entry of [
      { name: 'studio-clip-version', template: 'studio://projects/{projectId}/clips/{assetId}/versions/{assetVersion}', title: 'Exact Animation version', read: (variables, context, signal) => studioGateway.queryClips({ schemaVersion: 1, projectId: variables.projectId, assetId: variables.assetId, assetVersion: Number(variables.assetVersion), limit: 1 }, context, { signal }) },
      { name: 'studio-saved-cut-version', template: 'studio://projects/{projectId}/slices/{sliceId}/versions/{sliceVersion}', title: 'Exact saved cut version', read: (variables, context, signal) => studioGateway.querySavedSlice({ schemaVersion: 1, projectId: variables.projectId, sliceId: variables.sliceId, sliceVersion: Number(variables.sliceVersion) }, context, { signal }) },
    ]) server.registerResource(entry.name, new ResourceTemplate(entry.template, { list: undefined }),
      { title: entry.title, description: 'Immutable saved content and its exact source lineage.', mimeType: 'application/json' },
      async (uri, variables, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const context = await authorizeAgentProject(contextProvider, operation.context, variables.projectId);
          if (variables.projectId !== (reviewV1 ?? animationV1).projectId) throw Object.assign(new Error('The resource is outside the negotiated project.'), { code: 'CONTEXT_PROJECT_MISMATCH' });
          const value = await entry.read(variables, context, operation.signal);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(officialErrorPayload(error)) }] };
        } finally { operation.cleanup(); }
      });
  }

  const reviewQuery = catalog.find(({ name }) => name === 'studio_review_query');
  if (reviewQuery) server.registerResource('studio-review-version', new ResourceTemplate('studio://projects/{projectId}/reviews/{reviewId}/versions/{reviewVersion}', { list: undefined }),
    { title: 'Exact shared Review version', description: 'Immutable related changes, saved feedback and decisions at the requested Review version.', mimeType: 'application/json' },
    async (uri, { projectId, reviewId, reviewVersion }, invocationContext) => {
      const operation = operationContext(invocationContext, requestAbortRegistry);
      try {
        if (!/^[1-9][0-9]*$/.test(reviewVersion)) throw Object.assign(new Error('Choose a positive exact Review version.'), { code: 'VALIDATION_ERROR' });
        const value = await reviewQuery.execute({ schemaVersion: 1, projectId, reviewId, reviewVersion: Number(reviewVersion), limit: 1 }, operation.context);
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
      } catch (error) {
        if (operation.signal.aborted) throw error;
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(officialErrorPayload(error)) }] };
      } finally { operation.cleanup(); }
    });

  const taskRead = catalog.find(({ name }) => name === 'studio_task_read');
  if (taskRead) {
    server.registerResource(
      'studio-task',
      new ResourceTemplate('studio://projects/{projectId}/task', { list: undefined }),
      {
        title: 'Bound Studio task',
        description: 'Current bound task state, branch head, budget, review, and durable progress timeline.',
        mimeType: 'application/json',
      },
      async (uri, { projectId }, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const value = await taskRead.execute({ schemaVersion: 1, projectId }, operation.context);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          const value = officialErrorPayload(error);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  if (authoringV2Surface) {
    server.registerResource(
      'studio-authoring-v2-capabilities',
      new ResourceTemplate(AUTHORING_V2_CAPABILITIES_URI_TEMPLATE, { list: undefined }),
      {
        title: 'Studio Authoring v2 capabilities',
        description: 'Current project-bound Authoring-v2 profile, command feature, and branch revision. Discovery is not authority; every operation is admitted again.',
        mimeType: 'application/json',
      },
      async (uri, { projectId }, invocationContext) => {
        const operation = operationContext(invocationContext, requestAbortRegistry);
        try {
          const value = await authoringV2Surface.readCapabilities(operation.context, projectId);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } catch (error) {
          if (operation.signal.aborted) throw error;
          const value = officialErrorPayload(error);
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] };
        } finally {
          operation.cleanup();
        }
      },
    );
  }

  if (serverContext?.era) {
    process.stderr.write(`[numberdroid-studio] MCP era: ${serverContext.era}\n`);
  }
  return server;
}

export function serveOfficialMcpStdio(options) {
  const requestAbortRegistry = new Map();
  const transport = new CancellationAwareStdioTransport({ requestAbortRegistry });
  return serveStdio(
    (serverContext) => buildOfficialMcpServer({
      ...options, serverContext, requestAbortRegistry,
    }),
    {
      legacy: 'reject',
      transport,
      onerror: () => process.stderr.write('[numberdroid-studio] MCP_TRANSPORT_ERROR: malformed or unsupported protocol input.\n'),
    },
  );
}
