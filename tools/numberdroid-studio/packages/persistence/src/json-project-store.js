import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { access, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { ProjectStore, headRevision, projectSummary } from '../../application/src/project-store.js';

function deepClone(value) { return structuredClone(value); }

function projectFileName(projectId) {
  return `${Buffer.from(projectId, 'utf8').toString('base64url')}.json`;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteJson(path, document) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

/**
 * Dependency-free local persistence. Writes are durable temp-file + rename
 * replacements and commands are serialized per project inside this process.
 * The storage port deliberately permits a SQLite adapter to replace this class.
 */
export class JsonProjectStore extends ProjectStore {
  #directory;
  #queues = new Map();

  constructor({ directory }) {
    super();
    invariant(typeof directory === 'string' && directory.length > 0, 'VALIDATION_ERROR', 'directory is required.');
    this.#directory = directory;
  }

  get directory() {
    return this.#directory;
  }

  async #ensureDirectory() {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
  }

  #path(projectId) {
    return join(this.#directory, projectFileName(projectId));
  }

  async #exclusive(projectId, operation) {
    const prior = this.#queues.get(projectId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const queued = prior.then(() => gate);
    this.#queues.set(projectId, queued);
    await prior;
    try {
      return await operation();
    } finally {
      release();
      if (this.#queues.get(projectId) === queued) {
        this.#queues.delete(projectId);
      }
    }
  }

  async createProject(document) {
    await this.#ensureDirectory();
    return this.#exclusive(document.projectId, async () => {
      const path = this.#path(document.projectId);
      invariant(!(await exists(path)), 'PROJECT_EXISTS', 'The project already exists.', {
        projectId: document.projectId,
      });
      await atomicWriteJson(path, document);
      return deepClone(document);
    });
  }

  async loadProject(projectId) {
    await this.#ensureDirectory();
    try {
      const document = JSON.parse(await readFile(this.#path(projectId), 'utf8'));
      invariant(document.projectId === projectId, 'CORRUPT_PROJECT', 'Stored project identity does not match its file.', {
        projectId,
      });
      invariant(Array.isArray(document.revisions), 'CORRUPT_PROJECT', 'Stored project has no revision ledger.', {
        projectId,
      });
      return document;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async appendRevision(projectId, expectedRevision, revision) {
    await this.#ensureDirectory();
    return this.#exclusive(projectId, async () => {
      const current = await this.loadProject(projectId);
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
      const next = { ...current, revisions: [...current.revisions, deepClone(revision)] };
      await atomicWriteJson(this.#path(projectId), next);
      return deepClone(next);
    });
  }

  async listProjects() {
    await this.#ensureDirectory();
    const files = (await readdir(this.#directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const documents = await Promise.all(
      files.map(async (entry) => JSON.parse(await readFile(join(this.#directory, entry.name), 'utf8'))),
    );
    return documents.map(projectSummary).sort((left, right) => left.name.localeCompare(right.name));
  }
}
