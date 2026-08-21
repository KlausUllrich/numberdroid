import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonSchemaToZod } from '../packages/mcp-server/src/schema-adapter.js';

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
