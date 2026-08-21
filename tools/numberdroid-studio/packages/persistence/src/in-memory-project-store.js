import { StudioError, invariant } from '../../domain/src/errors.js';
import { ProjectStore, headRevision, projectSummary } from '../../application/src/project-store.js';

function deepClone(value) { return structuredClone(value); }
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export class InMemoryProjectStore extends ProjectStore {
  #documents = new Map();

  async createProject(document) {
    invariant(!this.#documents.has(document.projectId), 'PROJECT_EXISTS', 'The project already exists.', {
      projectId: document.projectId,
    });
    this.#documents.set(document.projectId, deepFreeze(deepClone(document)));
    return deepClone(document);
  }

  async loadProject(projectId) {
    const document = this.#documents.get(projectId);
    return document ? deepClone(document) : null;
  }

  async appendRevision(projectId, expectedRevision, revision) {
    const current = this.#documents.get(projectId);
    if (!current) {
      throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    }

    const actualRevision = headRevision(current)?.number ?? 0;
    invariant(actualRevision === expectedRevision, 'REVISION_CONFLICT', 'The project changed after it was read.', {
      projectId,
      expectedRevision,
      actualRevision,
    });
    invariant(
      revision.number === expectedRevision + 1 && revision.parentRevision === expectedRevision,
      'INVALID_REVISION',
      'The appended revision does not follow the current head.',
    );

    const next = deepFreeze({ ...deepClone(current), revisions: [...current.revisions, deepClone(revision)] });
    this.#documents.set(projectId, next);
    return deepClone(next);
  }

  async listProjects() {
    return [...this.#documents.values()]
      .map(projectSummary)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
