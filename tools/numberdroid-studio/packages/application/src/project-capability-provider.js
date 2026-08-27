import { validateProjectCapabilityManifest } from '../../domain/src/project-capability-manifest.js';
import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger } from '../../domain/src/validation.js';
import { deepFreeze } from './value-utils.js';

export class FixedProjectCapabilityProvider {
  #manifest;

  constructor({ manifest } = {}) {
    invariant(manifest, 'PROJECT_CAPABILITY_PROFILE_REQUIRED', 'A fixed project capability manifest is required.');
    this.#manifest = validateProjectCapabilityManifest(structuredClone(manifest));
  }

  async getProjectCapabilityManifest() {
    return this.#manifest;
  }
}

export function validateProjectCapabilityProvider(provider) {
  invariant(
    provider === null || provider === undefined || typeof provider.getProjectCapabilityManifest === 'function',
    'PROJECT_CAPABILITY_PROVIDER_INVALID',
    'A project capability provider must expose getProjectCapabilityManifest(selection).',
  );
  return provider ?? null;
}

export function projectCapabilitySelection({ projectId, revision } = {}) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: requireId(projectId, 'projectId'),
    revision: requireInteger(revision, 'revision', { min: 1 }),
  });
}
