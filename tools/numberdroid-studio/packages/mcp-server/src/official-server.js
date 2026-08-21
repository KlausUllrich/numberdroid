import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createAgentToolCatalog, findAgentTool } from './index.js';
import { jsonSchemaToZod } from './schema-adapter.js';

function redactTerminalDetails(value) {
  if (Array.isArray(value)) return value.map(redactTerminalDetails);
  if (!value || typeof value !== 'object') return value;
  const sensitiveKeys = new Set([
    'authorization', 'bindingId', 'bindingToken', 'cause', 'directory', 'endpoint',
    'filename', 'grantId', 'path', 'socket', 'token',
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeys.has(key))
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
  studioGateway, contextProvider, serverContext, requestAbortRegistry = new Map(),
} = {}) {
  if (!studioGateway) throw new TypeError('studioGateway is required.');
  const catalog = createAgentToolCatalog(studioGateway, { contextProvider });
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
