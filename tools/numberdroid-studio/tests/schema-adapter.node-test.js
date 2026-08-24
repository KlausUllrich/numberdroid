import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonSchemaToZod } from '../packages/mcp-server/src/schema-adapter.js';
import { officialErrorPayload } from '../packages/mcp-server/src/official-server.js';

test('JSON Schema enums preserve numeric and string literal types', () => {
  const schema = jsonSchemaToZod({
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'mode'],
    properties: {
      schemaVersion: { type: 'integer', enum: [1] },
      mode: { type: 'string', enum: ['read', 'write'] },
    },
  });

  assert.deepEqual(schema.parse({ schemaVersion: 1, mode: 'read' }), {
    schemaVersion: 1,
    mode: 'read',
  });
  assert.throws(() => schema.parse({ schemaVersion: '1', mode: 'read' }));
  assert.throws(() => schema.parse({ schemaVersion: 1, mode: 'publish' }));
});

test('open JSON Schema objects preserve semantic metadata instead of stripping it', () => {
  const schema = jsonSchemaToZod({
    type: 'object',
    additionalProperties: false,
    required: ['properties'],
    properties: { properties: { type: 'object' } },
  });
  const input = { properties: { role: 'floor', collision: 'none', nested: { family: 'hygiene' } } };
  assert.deepEqual(schema.parse(input), input);
});

test('official MCP terminal adapter redacts untrusted internal errors and sensitive details', () => {
  const sentinel = '/private/numberdroid-secret.sqlite';
  assert.deepEqual(officialErrorPayload(new Error(`failed at ${sentinel}`)), {
    schemaVersion: 1,
    status: 'ERROR',
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected Studio error.', details: {} },
  });
  const conflict = officialErrorPayload({
    code: 'REVISION_CONFLICT',
    message: 'The project changed.',
    details: { expectedRevision: 2, actualRevision: 3, cause: sentinel, grantId: 'grant.secret' },
  });
  assert.deepEqual(conflict.error.details, { expectedRevision: 2, actualRevision: 3 });
  assert.doesNotMatch(JSON.stringify(conflict), /private|grant\.secret/);
});
