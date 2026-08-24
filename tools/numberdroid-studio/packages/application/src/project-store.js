import { StudioError } from '../../domain/src/errors.js';

/**
 * Storage port used by the application core. Adapters must implement atomic
 * compare-and-swap semantics for appendRevision.
 */
export class ProjectStore {
  async createProject(_document) {
    throw new StudioError('NOT_IMPLEMENTED', 'ProjectStore.createProject is not implemented.');
  }

  async loadProject(_projectId) {
    throw new StudioError('NOT_IMPLEMENTED', 'ProjectStore.loadProject is not implemented.');
  }

  async appendRevision(_projectId, _expectedRevision, _revision) {
    throw new StudioError('NOT_IMPLEMENTED', 'ProjectStore.appendRevision is not implemented.');
  }

  async listProjects() {
    throw new StudioError('NOT_IMPLEMENTED', 'ProjectStore.listProjects is not implemented.');
  }
}

export function headRevision(document) {
  return document.revisions.at(-1) ?? null;
}

export function projectSummary(document) {
  const head = headRevision(document);
  return {
    projectId: document.projectId,
    revision: head?.number ?? 0,
    name: head?.snapshot.project.name ?? document.projectId,
    status: head?.snapshot.project.status ?? 'unknown',
    updatedAt: head?.committedAt ?? document.createdAt,
    sourceCount: head?.snapshot.sources.length ?? 0,
    assetCount: head?.snapshot.assets.length ?? 0,
  };
}
