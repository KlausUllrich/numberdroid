import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FixedProjectCapabilityProvider,
  StudioService,
  projectCapabilitySelection,
} from '../packages/application/src/index.js';
import {
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import {
  AGENT_CONTEXT,
  OWNER_CONTEXT,
  PROJECT_ID,
  createProject,
  issueGrant,
} from './test-helpers.js';

function createStudio(capabilityProvider = null) {
  const store = new InMemoryProjectStore();
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 7, 27, 8, 0, tick++)).toISOString();
  return new StudioService({ store, clock, capabilityProvider });
}

async function projectWithProvider(capabilityProvider) {
  const studio = createStudio(capabilityProvider);
  await createProject(studio);
  return studio;
}

const QUERY = Object.freeze({ schemaVersion: 1, projectId: PROJECT_ID });

test('fixed capability provider defensively normalizes and the owner receives the canonical frozen profile', async () => {
  const input = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  const provider = new FixedProjectCapabilityProvider({ manifest: input });
  input.adapter.version = 'mutated-after-construction';
  const studio = await projectWithProvider(provider);
  const result = await studio.queryProjectCapabilities(QUERY, OWNER_CONTEXT);

  assert.deepEqual(result, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    revision: 1,
    manifestFingerprint: NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
    manifest: NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.manifest));
  assert.ok(Object.isFrozen(result.manifest.operations));
});

test('a granted agent receives the same profile and the provider sees only a frozen project selection', async () => {
  const selections = [];
  const provider = {
    async getProjectCapabilityManifest(selection) {
      selections.push(selection);
      return NUMBERDROID_PROJECT_CAPABILITY_MANIFEST;
    },
  };
  const studio = await projectWithProvider(provider);
  await issueGrant(studio, { scopes: ['project.read'] });
  const result = await studio.queryProjectCapabilities(QUERY, AGENT_CONTEXT);

  assert.equal(result.revision, 2);
  assert.equal(result.manifestFingerprint, NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
  assert.deepEqual(result.manifest, NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  assert.deepEqual(selections, [{ schemaVersion: 1, projectId: PROJECT_ID, revision: 2 }]);
  assert.ok(Object.isFrozen(selections[0]));
});

test('capability query rejects untrusted authority, unknown fields, unsupported schemas, and unauthorized agents before provider access', async () => {
  let calls = 0;
  const provider = {
    async getProjectCapabilityManifest() {
      calls += 1;
      return NUMBERDROID_PROJECT_CAPABILITY_MANIFEST;
    },
  };
  const studio = await projectWithProvider(provider);

  await assert.rejects(
    studio.queryProjectCapabilities({ ...QUERY, actor: OWNER_CONTEXT.actor }, OWNER_CONTEXT),
    (error) => error.code === 'UNTRUSTED_AUTHORITY_FIELD' && error.details.field === 'actor',
  );
  await assert.rejects(
    studio.queryProjectCapabilities({ ...QUERY, unexpected: true }, OWNER_CONTEXT),
    (error) => error.code === 'VALIDATION_ERROR' && error.details.field === 'unexpected',
  );
  await assert.rejects(
    studio.queryProjectCapabilities({ ...QUERY, schemaVersion: 2 }, OWNER_CONTEXT),
    (error) => error.code === 'SCHEMA_VERSION_UNSUPPORTED',
  );
  await assert.rejects(
    studio.queryProjectCapabilities(QUERY, AGENT_CONTEXT),
    (error) => error.code === 'GRANT_NOT_FOUND',
  );
  assert.equal(calls, 0);
});

test('capability provider failures stay explicit and fail closed', async () => {
  const disabled = await projectWithProvider(null);
  await assert.rejects(
    disabled.queryProjectCapabilities(QUERY, OWNER_CONTEXT),
    (error) => error.code === 'PROJECT_CAPABILITY_PROVIDER_DISABLED',
  );

  const missing = await projectWithProvider({
    async getProjectCapabilityManifest() { return null; },
  });
  await assert.rejects(
    missing.queryProjectCapabilities(QUERY, OWNER_CONTEXT),
    (error) => error.code === 'PROJECT_CAPABILITY_PROFILE_NOT_FOUND',
  );

  const invalid = await projectWithProvider({
    async getProjectCapabilityManifest() {
      return { ...NUMBERDROID_PROJECT_CAPABILITY_MANIFEST, schemaVersion: 2 };
    },
  });
  await assert.rejects(
    invalid.queryProjectCapabilities(QUERY, OWNER_CONTEXT),
    (error) => error.code === 'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED',
  );

  assert.throws(
    () => createStudio({}),
    (error) => error.code === 'PROJECT_CAPABILITY_PROVIDER_INVALID',
  );
  assert.throws(
    () => new FixedProjectCapabilityProvider({ manifest: null }),
    (error) => error.code === 'PROJECT_CAPABILITY_PROFILE_REQUIRED',
  );
  assert.throws(
    () => new FixedProjectCapabilityProvider(),
    (error) => error.code === 'PROJECT_CAPABILITY_PROFILE_REQUIRED',
  );
});

test('provider selections validate their project and revision boundary', () => {
  const selection = projectCapabilitySelection({ projectId: PROJECT_ID, revision: 4 });
  assert.deepEqual(selection, { schemaVersion: 1, projectId: PROJECT_ID, revision: 4 });
  assert.ok(Object.isFrozen(selection));
  assert.throws(
    () => projectCapabilitySelection({ projectId: 'invalid project id', revision: 4 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => projectCapabilitySelection({ projectId: PROJECT_ID, revision: 0 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => projectCapabilitySelection(),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});
