import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createAgentToolCatalog, findAgentTool } from './index.js';
import { jsonSchemaToZod } from './schema-adapter.js';

function errorPayload(error) {
  return {
    schemaVersion: 1,
    status: 'ERROR',
    error: {
      code: typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Studio request failed.',
      details: error?.details ?? {},
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
  const payload = errorPayload(error);
  return {
    content: [{ type: 'text', text: `${payload.error.code}: ${payload.error.message}` }],
    structuredContent: payload,
    isError: true,
  };
}

export function buildOfficialMcpServer({ studioGateway, contextProvider, serverContext } = {}) {
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
        try {
          return toolResult(await tool.execute(input, invocationContext));
        } catch (error) {
          if (invocationContext?.mcpReq?.signal?.aborted) throw error;
          return toolError(error);
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
      try {
        const value = await projectRead.execute({ schemaVersion: 1, projectId }, invocationContext);
        return {
          contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
        };
      } catch (error) {
        if (invocationContext?.mcpReq?.signal?.aborted) throw error;
        const value = errorPayload(error);
        return {
          contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }],
        };
      }
    },
  );

  if (serverContext?.era) {
    process.stderr.write(`[numberdroid-studio] MCP era: ${serverContext.era}\n`);
  }
  return server;
}

export function serveOfficialMcpStdio(options) {
  return serveStdio(
    (serverContext) => buildOfficialMcpServer({ ...options, serverContext }),
    {
      legacy: 'reject',
      onerror: (error) => process.stderr.write(`[numberdroid-studio] MCP error: ${error.message}\n`),
    },
  );
}
