import { StudioError, invariant } from '../../../packages/domain/src/errors.js';
import { validateBackupOperationRequest } from '../../../packages/domain/src/backup-operation.js';
import {
  LOCAL_WORKSPACE_OPERATOR_KIND,
  LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  WORKSPACE_BACKUP_CAPABILITY,
} from '../../../packages/application/src/backup-operation-service.js';
import {
  WorkspaceOperatorSession,
  backupOperatorCookieToken,
  backupOperatorSetCookie,
} from './workspace-operator-session.js';

const CANDIDATE_STATUS = 'implemented candidate — not user accepted';
const BACKUP_LIST_LIMIT = 100;
const OPERATOR_CONTEXT = Object.freeze({
  schemaVersion: 1,
  kind: LOCAL_WORKSPACE_OPERATOR_KIND,
  subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  capabilities: Object.freeze([WORKSPACE_BACKUP_CAPABILITY]),
});

function backupProjection(backup, destinationLabels) {
  return Object.freeze({
    schemaVersion: 1,
    backupId: backup.backupId,
    destinationId: backup.destinationId,
    destinationLabel: destinationLabels.get(backup.destinationId) ?? backup.destinationId,
    provenance: backup.provenance,
    health: backup.health,
    manifestIdentity: backup.manifestSha256,
    itemCount: backup.artifactCount,
    byteCount: backup.byteCount,
    createdAt: backup.createdAt,
    registeredAt: backup.registeredAt,
    lastVerifiedAt: backup.lastVerifiedAt,
    lastRecoveryTestedAt: backup.lastRecoveryTestedAt,
  });
}

class BackupWorkerPump {
  #runtime;
  #abortController = new AbortController();
  #running = null;
  #wakeRequested = false;
  #closing = false;
  #failure = null;

  constructor(runtime) {
    this.#runtime = runtime;
  }

  get available() {
    return !this.#closing && this.#failure === null;
  }

  wake() {
    if (this.#closing || this.#failure !== null) return;
    this.#wakeRequested = true;
    if (this.#running !== null) return;
    const drain = this.#drain();
    this.#running = drain;
    drain.catch(() => {}).finally(() => {
      if (this.#running !== drain) return;
      this.#running = null;
      if (this.#wakeRequested && !this.#closing && this.#failure === null) this.wake();
    });
  }

  async #drain() {
    try {
      do {
        this.#wakeRequested = false;
        while (!this.#closing) {
          const operation = await this.#runtime.runNext({ signal: this.#abortController.signal });
          if (operation === null) break;
        }
      } while (!this.#closing && this.#wakeRequested);
    } catch (error) {
      if (!this.#closing) this.#failure = error;
      throw error;
    }
  }

  async close() {
    if (this.#closing) return this.#running;
    this.#closing = true;
    this.#abortController.abort();
    try {
      await this.#running;
    } catch {}
  }
}

export class BackupOperationsController {
  #runtime;
  #session;
  #pump;
  #closed = false;

  constructor({ runtime, bootstrapSecret, clock = Date.now, randomSource } = {}) {
    invariant(runtime
      && typeof runtime.requestOperation === 'function'
      && typeof runtime.readOperation === 'function'
      && typeof runtime.listRecentOperations === 'function'
      && typeof runtime.listBackups === 'function'
      && typeof runtime.listDestinations === 'function'
      && typeof runtime.runNext === 'function'
      && typeof runtime.close === 'function',
    'OPERATIONS_UNAVAILABLE', 'The backup operations runtime is unavailable.');
    this.#runtime = runtime;
    this.#session = new WorkspaceOperatorSession({
      bootstrapSecret,
      clock,
      ...(randomSource ? { randomSource } : {}),
    });
    this.#pump = new BackupWorkerPump(runtime);
  }

  #token(cookieHeader) {
    return backupOperatorCookieToken(cookieHeader);
  }

  #authenticate(cookieHeader) {
    this.#session.authenticate(this.#token(cookieHeader));
    if (this.#closed || !this.#pump.available) {
      throw new StudioError('OPERATIONS_UNAVAILABLE', 'Backup operations are unavailable.');
    }
  }

  start() {
    invariant(!this.#closed, 'OPERATIONS_UNAVAILABLE', 'Backup operations are unavailable.');
    this.#pump.wake();
  }

  status(cookieHeader) {
    if (this.#closed || !this.#pump.available) return Object.freeze({
      schemaVersion: 1,
      state: 'OPERATIONS_UNAVAILABLE',
      candidateStatus: CANDIDATE_STATUS,
    });
    return Object.freeze({
      schemaVersion: 1,
      state: this.#session.status(this.#token(cookieHeader)),
      candidateStatus: CANDIDATE_STATUS,
    });
  }

  unlock(secret) {
    invariant(!this.#closed && this.#pump.available,
      'OPERATIONS_UNAVAILABLE', 'Backup operations are unavailable.');
    const token = this.#session.exchange(secret);
    return Object.freeze({
      cookie: backupOperatorSetCookie(token),
      projection: Object.freeze({
        schemaVersion: 1,
        state: 'READY',
        candidateStatus: CANDIDATE_STATUS,
      }),
    });
  }

  async overview(cookieHeader) {
    this.#authenticate(cookieHeader);
    const backupDestinations = this.#runtime.listDestinations('CREATE', OPERATOR_CONTEXT);
    const restoreDestinations = this.#runtime.listDestinations('RESTORE_AS_COPY', OPERATOR_CONTEXT);
    const destinationLabels = new Map(backupDestinations.map((entry) => [entry.destinationId, entry.label]));
    const operations = await this.#runtime.listRecentOperations(OPERATOR_CONTEXT);
    const backupRecords = this.#runtime.listBackups(OPERATOR_CONTEXT, {
      limit: BACKUP_LIST_LIMIT + 1,
    });
    const backupsTruncated = backupRecords.length > BACKUP_LIST_LIMIT;
    const backups = backupRecords.slice(0, BACKUP_LIST_LIMIT)
      .map((backup) => backupProjection(backup, destinationLabels));
    return Object.freeze({
      schemaVersion: 1,
      state: backups.length === 0 ? 'NO_BACKUPS' : 'READY',
      candidateStatus: CANDIDATE_STATUS,
      backupDestinations,
      restoreDestinations,
      operations,
      backupWindow: Object.freeze({ limit: BACKUP_LIST_LIMIT, truncated: backupsTruncated }),
      backups: Object.freeze(backups),
    });
  }

  async readOperation(operationId, cookieHeader) {
    this.#authenticate(cookieHeader);
    const operation = await this.#runtime.readOperation(Object.freeze({
      schemaVersion: 1,
      operationId,
    }), OPERATOR_CONTEXT);
    return Object.freeze({
      schemaVersion: 1,
      candidateStatus: CANDIDATE_STATUS,
      operation,
    });
  }

  async request(request, cookieHeader) {
    this.#authenticate(cookieHeader);
    const validated = validateBackupOperationRequest(request);
    const operation = await this.#runtime.requestOperation(validated, OPERATOR_CONTEXT);
    this.#pump.wake();
    return Object.freeze({
      schemaVersion: 1,
      candidateStatus: CANDIDATE_STATUS,
      operation,
    });
  }

  async close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#session.close();
    await this.#pump.close();
    await this.#runtime.close();
  }
}
