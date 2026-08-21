import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StudioService } from '../../../packages/application/src/index.js';
import { asStudioError } from '../../../packages/domain/src/index.js';
import { JsonProjectStore } from '../../../packages/persistence/src/index.js';
import { ensureDemoProject, runDemoAction } from './demo-project.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(moduleDirectory, '../public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function errorStatus(error) {
  if (error.code === 'PROJECT_NOT_FOUND') return 404;
  if (['PROJECT_EXISTS', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'COMMAND_ID_CONFLICT', 'ENTITY_EXISTS', 'ENTITY_STATE_CONFLICT'].includes(error.code)) return 409;
  if (error.code.startsWith('GRANT_') || ['FORBIDDEN', 'CONTEXT_PROJECT_MISMATCH'].includes(error.code)) return 403;
  if (['VALIDATION_ERROR', 'UNKNOWN_COMMAND', 'SCHEMA_VERSION_UNSUPPORTED', 'VERSION_INVARIANT_VIOLATION', 'EMBEDDED_ARTIFACT_FORBIDDEN'].includes(error.code)) return 400;
  return 500;
}

async function serveStatic(pathname, response) {
  const [file, mediaType] = staticFiles.get(pathname);
  const body = await readFile(resolve(publicDirectory, file));
  response.writeHead(200, {
    'content-type': mediaType,
    'content-length': body.length,
    'cache-control': 'no-cache',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  response.end(body);
}

function projectRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)(?:\/(activity))?$/.exec(pathname);
  return match ? { projectId: decodeURIComponent(match[1]), resource: match[2] ?? 'snapshot' } : null;
}

export function createStudioHttpServer({ studioService }) {
  if (!studioService) throw new TypeError('studioService is required.');

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        await serveStatic(url.pathname, response);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { schemaVersion: 1, status: 'ok', service: 'numberdroid-studio' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/catalog') {
        sendJson(response, 200, { schemaVersion: 1, commands: studioService.commandCatalog });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/projects') {
        sendJson(response, 200, { schemaVersion: 1, projects: await studioService.listProjectsTrusted() });
        return;
      }
      const project = projectRoute(url.pathname);
      if (request.method === 'GET' && project?.resource === 'snapshot') {
        sendJson(response, 200, await studioService.readProjectTrusted(project.projectId));
        return;
      }
      if (request.method === 'GET' && project?.resource === 'activity') {
        const afterRevision = Number(url.searchParams.get('afterRevision') ?? 0);
        sendJson(response, 200, {
          schemaVersion: 1,
          projectId: project.projectId,
          events: await studioService.listActivityTrusted(project.projectId, { afterRevision }),
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/demo') {
        sendJson(response, 200, await ensureDemoProject(studioService));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/demo/action') {
        sendJson(response, 200, await runDemoAction(studioService, url.searchParams.get('action')));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, ['GET', 'POST'].includes(request.method) ? 404 : 405, {
          schemaVersion: 1,
          error: { code: request.method === 'GET' || request.method === 'POST' ? 'NOT_FOUND' : 'METHOD_NOT_ALLOWED' },
        });
        return;
      }
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found\n');
    } catch (rawError) {
      const error = asStudioError(rawError);
      sendJson(response, errorStatus(error), {
        schemaVersion: 1,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
  });
}

export async function startStudioHttpServer({
  dataDirectory = resolve(process.env.NUMBERDROID_STUDIO_DATA ?? '.numberdroid-studio'),
  host = process.env.NUMBERDROID_STUDIO_HOST ?? '127.0.0.1',
  port = Number(process.env.NUMBERDROID_STUDIO_PORT ?? 4317),
} = {}) {
  const store = new JsonProjectStore({ directory: dataDirectory });
  const studioService = new StudioService({ store });
  const server = createStudioHttpServer({ studioService });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolveListen);
  });
  return { server, studioService, address: server.address(), dataDirectory };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const running = await startStudioHttpServer();
  const address = running.address;
  process.stdout.write(`Numberdroid Studio: http://${address.address}:${address.port}\n`);
  process.stdout.write(`Project data: ${running.dataDirectory}\n`);
}
