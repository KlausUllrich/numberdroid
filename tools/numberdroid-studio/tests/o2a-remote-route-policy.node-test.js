import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRemoteRoute } from '../apps/studio-remote/src/remote-route-policy.js';

const DIGEST = 'a'.repeat(64);

test('O2a remote policy allows only the exact static UI and read-only human routes', { timeout: 5_000 }, () => {
  const staticTargets = [
    '/',
    '/app.js',
    '/a1-7-state.js',
    '/o1b-backups-state.js',
    '/remote-ui-mode.js',
    '/styles.css',
    '/favicon.svg',
  ];
  for (const target of staticTargets) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.equal(result.allowed, true, target);
    assert.equal(result.kind, 'static', target);
    assert.equal(result.pathname, target.split('?', 1)[0], target);
    assert.equal(result.search, target.includes('?') ? target.slice(target.indexOf('?')) : '', target);
    assert.equal(Object.isFrozen(result), true, target);
    assert.equal('reason' in result, false, target);
  }

  const readTargets = [
    '/api/projects',
    '/api/projects/project.1',
    '/api/projects/project.1/activity?afterRevision=7',
    '/api/projects/project.1/tasks',
    '/api/projects/project.1/tasks/task.1',
    '/api/projects/project.1/source-intakes',
    '/api/projects/project.1/assets?kinds=prop',
    '/api/projects/project.1/assets/asset.1',
    '/api/projects/project.1/rooms?includeVersions=true',
    '/api/projects/project.1/rooms/room.1',
    '/api/projects/project.1/jobs/job.1',
    `/api/projects/project.1/artifacts/sha256/${DIGEST}`,
    '/api/projects/project.1/tasks/task.1/processing-result-adoptions',
    '/api/projects/project.1/tasks/task.1/processing-result-adoptions/2/selected-output',
  ];
  for (const target of readTargets) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.equal(result.allowed, true, target);
    assert.equal(result.kind, 'read', target);
    assert.equal(Object.isFrozen(result), true, target);
  }
});

test('O2a remote policy hard-denies backups, MCP, demo, pairing, and authority routes', { timeout: 5_000 }, () => {
  const cases = new Map([
    ['/api/backups', 'BACKUPS_ROUTE_FORBIDDEN'],
    ['/api/backups/operations/op.1', 'BACKUPS_ROUTE_FORBIDDEN'],
    ['/internal/mcp/read-project', 'MCP_ROUTE_FORBIDDEN'],
    ['/internal/mcp/authoring-v2/capabilities', 'MCP_ROUTE_FORBIDDEN'],
    ['/api/demo', 'DEMO_ROUTE_FORBIDDEN'],
    ['/api/demo/action', 'DEMO_ROUTE_FORBIDDEN'],
    ['/api/projects/project.1/agent-access', 'AUTHORITY_ROUTE_FORBIDDEN'],
    ['/api/projects/project.1/agent-access/bindings', 'AUTHORITY_ROUTE_FORBIDDEN'],
    ['/api/projects/project.1/pairing', 'AUTHORITY_ROUTE_FORBIDDEN'],
    ['/api/pairing', 'AUTHORITY_ROUTE_FORBIDDEN'],
    ['/internal/bindings', 'AUTHORITY_ROUTE_FORBIDDEN'],
  ]);

  for (const [target, reason] of cases) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.deepEqual(result, Object.freeze({
      allowed: false,
      kind: null,
      pathname: target,
      search: '',
      reason,
    }), target);
    assert.equal(Object.isFrozen(result), true, target);
  }
});

test('O2a remote policy rejects every mutation method and every unknown or future route', { timeout: 5_000 }, () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'get']) {
    const result = classifyRemoteRoute({ method, target: '/api/projects' });
    assert.equal(result.allowed, false, method);
    assert.equal(result.reason, 'METHOD_NOT_ALLOWED', method);
  }

  const unknownTargets = [
    '/health',
    '/api/catalog',
    '/api/ui-session',
    '/api/projects/project.1/jobs',
    '/api/projects/project.1/artifacts',
    `/api/projects/project.1/artifacts/sha256/${DIGEST.toUpperCase()}`,
    '/api/projects/project.1/tasks/task.1/pause',
    '/api/projects/project.1/rooms/room.1/finalize',
    '/api/projects/project.1/tasks/task.1/processing-result-adoptions/1/selected-output',
    '/api/projects/project.1/future-read-surface',
  ];
  for (const target of unknownTargets) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.equal(result.allowed, false, target);
    assert.equal(result.reason, 'ROUTE_NOT_ALLOWED', target);
  }

  const invalidQueries = [
    '/app.js?asset=1',
    '/api/projects?future=true',
    '/api/projects/project.1/activity?afterRevision=-1',
    '/api/projects/project.1/activity?afterRevision=1&afterRevision=2',
    '/api/projects/project.1/assets?grantId=forged',
    '/api/projects/project.1/assets?includeProposals=yes',
    '/api/projects/project.1/assets?%6Binds=prop',
    '/api/projects/project.1/assets?text=two+words',
    '/api/projects/project.1/assets?kinds',
    '/api/projects/project.1/rooms?includeVersions=true&includeVersions=false',
    '/api/projects/project.1/tasks?limit=1',
  ];
  for (const target of invalidQueries) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.equal(result.allowed, false, target);
    assert.equal(result.reason, 'QUERY_NOT_ALLOWED', target);
  }
});

test('O2a remote policy classifies the raw target without parser normalization', { timeout: 5_000 }, () => {
  const cases = new Map([
    ['http://studio.example/api/projects', 'TARGET_ABSOLUTE_FORM'],
    ['http://user@studio.example/api/projects', 'TARGET_USERINFO_FORBIDDEN'],
    ['//studio.example/api/projects', 'TARGET_ABSOLUTE_FORM'],
    ['//user@studio.example/api/projects', 'TARGET_USERINFO_FORBIDDEN'],
    ['api/projects', 'TARGET_NOT_ORIGIN_FORM'],
    ['/api//projects', 'TARGET_DOUBLE_SLASH'],
    ['/api/projects/./project.1', 'TARGET_DOT_SEGMENT'],
    ['/api/projects/%2E/project.1', 'TARGET_DOT_SEGMENT'],
    ['/api/projects/project.1/%2E%2E/activity', 'TARGET_DOT_SEGMENT'],
    ['/api/projects/project.1%2Fother', 'TARGET_ENCODED_SEPARATOR'],
    ['/api/projects/project.1%2fother', 'TARGET_ENCODED_SEPARATOR'],
    ['/api/projects/project.1%5Cother', 'TARGET_ENCODED_SEPARATOR'],
    ['/api/projects/project.1%5cother', 'TARGET_ENCODED_SEPARATOR'],
    ['/api/projects/project.1\\other', 'TARGET_BACKSLASH_FORBIDDEN'],
    ['/api/projects/%', 'TARGET_MALFORMED_PERCENT_ENCODING'],
    ['/api/projects/%2', 'TARGET_MALFORMED_PERCENT_ENCODING'],
    ['/api/projects/%GG', 'TARGET_MALFORMED_PERCENT_ENCODING'],
    ['/api/projects/%C3%28', 'TARGET_MALFORMED_PERCENT_ENCODING'],
    ['/api/%70rojects', 'TARGET_NON_CANONICAL_ENCODING'],
    ['/api/projects/project%3a1', 'TARGET_NON_CANONICAL_ENCODING'],
    ['/api/projects#fragment', 'TARGET_FRAGMENT_FORBIDDEN'],
    ['/api/projects project.1', 'TARGET_INVALID_RAW_CHARACTER'],
    [`/api/projects?text=${'a'.repeat(9_000)}`, 'TARGET_TOO_LARGE'],
  ]);

  for (const [target, reason] of cases) {
    const result = classifyRemoteRoute({ method: 'GET', target });
    assert.equal(result.allowed, false, target);
    assert.equal(result.kind, null, target);
    assert.equal(result.reason, reason, target);
    assert.equal(Object.isFrozen(result), true, target);
  }
});

test('O2a remote policy throws only for invalid internal call shapes', { timeout: 5_000 }, () => {
  assert.throws(() => classifyRemoteRoute(), TypeError);
  assert.throws(() => classifyRemoteRoute(null), TypeError);
  assert.throws(() => classifyRemoteRoute({ method: 1, target: '/api/projects' }), TypeError);
  assert.throws(() => classifyRemoteRoute({ method: 'GET', target: null }), TypeError);
});
