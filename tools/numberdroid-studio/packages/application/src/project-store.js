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

// Optional internal read optimization. Legacy and task-branch adapters keep
// their existing complete-document contract; never pass a partial document to
// a command or historical reader that expects the immutable ledger.
export async function loadProjectHead(store, projectId) {
  if (typeof store.loadProjectHead === 'function') return store.loadProjectHead(projectId);
  const document = await store.loadProject(projectId);
  return document ? headRevision(document) : null;
}

// A bounded execution context is deliberately not a ProjectDocument. Only the
// owner Move command may opt in; task/legacy adapters retain the complete ledger.
export function supportsOwnerRoomMoveReads(store, command) {
  return command.type === 'room.variant.placements.move'
    && command.actor.kind === 'human'
    && store.isTaskBranchStore !== true
    && typeof store.loadRoomMoveContext === 'function'
    && typeof store.loadRoomMoveAssetVersions === 'function';
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
