import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { pairWithStudio } from '../apps/studio-mcp/src/pairing-client.js';

async function listen(context, server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  return `http://127.0.0.1:${server.address().port}/`;
}

test('private MCP service and gateway redact internal details at both boundaries', async (context) => {
  const sentinel = '/private/numberdroid-secret.sqlite';
  const token = 't'.repeat(43);
  const studioServer = createStudioHttpServer({
    studioService: {
      commandCatalog: [],
      async readProject() { throw new Error(`sqlite failed at ${sentinel}`); },
    },
    hostBindingStore: {
      resolve() {
        return {
          projectId: 'project.redaction',
          grantId: 'grant.secret',
          actor: { id: 'agent.redaction', kind: 'agent' },
          taskId: 'task.redaction',
          branchId: 'branch.redaction',
        };
      },
    },
  });
  const serviceUrl = await listen(context, studioServer);
  const direct = await fetch(new URL('/internal/mcp/read-project', serviceUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 1, projectId: 'project.redaction' }),
  });
  const directBody = await direct.json();
  assert.equal(direct.status, 500);
  assert.deepEqual(directBody.error, {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected Studio error.',
    details: {},
  });
  assert.doesNotMatch(JSON.stringify(directBody), new RegExp(sentinel));

  const gateway = new LocalStudioGateway({ baseUrl: serviceUrl, bindingToken: token });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.redaction' }),
    (error) => error.code === 'INTERNAL_ERROR'
      && error.message === 'Unexpected Studio error.'
      && JSON.stringify(error.details) === '{}'
      && !JSON.stringify(error).includes(sentinel),
  );
});

test('gateway normalizes malformed service responses without echoing bytes', async (context) => {
  const sentinel = 'private-response-fragment';
  const malformed = createServer((_request, response) => {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(`not-json-${sentinel}`);
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, malformed),
    bindingToken: 'm'.repeat(43),
  });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.redaction' }),
    (error) => error.code === 'STUDIO_SERVICE_PROTOCOL_ERROR'
      && !error.message.includes(sentinel)
      && !JSON.stringify(error.details).includes(sentinel),
  );
});

test('pairing connection failures use a stable code without exposing the endpoint', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-pairing-unavailable-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const endpoint = join(directory, 'private-pairing.sock');
  await assert.rejects(
    pairWithStudio({ endpoint, projectId: 'project.redaction' }),
    (error) => error.code === 'HOST_PAIRING_UNAVAILABLE'
      && !error.message.includes(endpoint)
      && !JSON.stringify(error.details).includes(endpoint),
  );
});
