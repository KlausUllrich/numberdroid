import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { StudioError } from '../../../packages/domain/src/index.js';

const MAX_REQUEST_BYTES = 8192;

function validatePairRequest(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new StudioError('VALIDATION_ERROR', 'MCP pairing request must be an object.');
  }
  const allowed = new Set(['schemaVersion', 'projectId', 'label']);
  if (Object.keys(value).some((key) => !allowed.has(key)) || value.schemaVersion !== 1) {
    throw new StudioError('VALIDATION_ERROR', 'MCP pairing accepts only schemaVersion, projectId, and label.');
  }
  if (typeof value.projectId !== 'string' || value.projectId.length === 0) {
    throw new StudioError('VALIDATION_ERROR', 'MCP pairing projectId is required.');
  }
  if (value.label !== undefined && (typeof value.label !== 'string' || value.label.length > 120)) {
    throw new StudioError('VALIDATION_ERROR', 'MCP pairing label must be at most 120 characters.');
  }
  return { projectId: value.projectId, label: value.label?.trim() || 'Local MCP host' };
}

export function defaultMcpPairingEndpoint(_dataDirectory) {
  return 'tcp://127.0.0.1:0';
}

export class McpPairingBroker {
  #pending = new Map();
  #clock;
  #ttlMs;

  constructor({ clock = () => new Date().toISOString(), ttlMs = 5 * 60 * 1000 } = {}) {
    this.#clock = clock;
    this.#ttlMs = ttlMs;
  }

  #expire() {
    const now = Date.parse(this.#clock());
    for (const [id, pending] of this.#pending) {
      if (Date.parse(pending.expiresAt) <= now) {
        this.#pending.delete(id);
        pending.reject(new StudioError('HOST_PAIRING_EXPIRED', 'The MCP host pairing request expired.'));
      }
    }
  }

  register({ projectId, label, deliver, reject }) {
    this.#expire();
    const createdAt = this.#clock();
    const pending = {
      pendingHostId: `pending-host.${randomUUID()}`,
      projectId,
      label,
      verificationCode: String(randomBytes(3).readUIntBE(0, 3) % 1000000).padStart(6, '0'),
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + this.#ttlMs).toISOString(),
      deliver,
      reject,
    };
    this.#pending.set(pending.pendingHostId, pending);
    return this.project(pending);
  }

  project(pending) {
    return {
      schemaVersion: 1,
      pendingHostId: pending.pendingHostId,
      projectId: pending.projectId,
      label: pending.label,
      verificationCode: pending.verificationCode,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      status: 'WAITING_FOR_APPROVAL',
    };
  }

  list(projectId) {
    this.#expire();
    return [...this.#pending.values()]
      .filter((pending) => pending.projectId === projectId)
      .map((pending) => this.project(pending));
  }

  get(projectId, pendingHostId) {
    this.#expire();
    const pending = this.#pending.get(pendingHostId);
    if (!pending || pending.projectId !== projectId) {
      throw new StudioError('HOST_PAIRING_NOT_FOUND', 'The MCP host pairing request is unavailable or expired.');
    }
    return pending;
  }

  approve(projectId, pendingHostId, payload) {
    const pending = this.get(projectId, pendingHostId);
    this.#pending.delete(pendingHostId);
    pending.deliver(payload);
    return this.project(pending);
  }

  cancel(pendingHostId) {
    this.#pending.delete(pendingHostId);
  }

  close() {
    for (const pending of this.#pending.values()) {
      pending.reject(new StudioError('HOST_PAIRING_CLOSED', 'The Studio service stopped before pairing completed.'));
    }
    this.#pending.clear();
  }
}

export async function startMcpPairingSocket({ broker, endpoint }) {
  if (!(broker instanceof McpPairingBroker)) throw new TypeError('McpPairingBroker is required.');
  const tcpEndpoint = endpoint.startsWith('tcp://') ? new URL(endpoint) : null;
  const socketEndpoint = tcpEndpoint ? null : endpoint;
  if (socketEndpoint && process.platform !== 'win32') {
    await mkdir(dirname(socketEndpoint), { recursive: true, mode: 0o700 });
    await rm(socketEndpoint, { force: true });
  }
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let registered = false;
    let pendingHostId = null;
    let terminal = false;
    socket.setTimeout(6 * 60 * 1000, () => socket.destroy());
    socket.on('data', (chunk) => {
      if (registered) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_REQUEST_BYTES) {
        socket.end(`${JSON.stringify({ schemaVersion: 1, error: { code: 'BODY_TOO_LARGE' } })}\n`);
        return;
      }
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      registered = true;
      try {
        const request = validatePairRequest(JSON.parse(buffer.subarray(0, newline).toString('utf8')));
        const pending = broker.register({
          ...request,
          deliver: ({ token, binding }) => {
            terminal = true;
            socket.end(`${JSON.stringify({ schemaVersion: 1, status: 'AUTHORIZED', token, binding })}\n`);
          },
          reject: (error) => {
            terminal = true;
            socket.end(`${JSON.stringify({ schemaVersion: 1, status: 'REJECTED', error: { code: error.code, message: error.message } })}\n`);
          },
        });
        pendingHostId = pending.pendingHostId;
        socket.write(`${JSON.stringify({ schemaVersion: 1, status: 'WAITING_FOR_APPROVAL', pendingHost: pending })}\n`);
      } catch (error) {
        socket.end(`${JSON.stringify({ schemaVersion: 1, error: { code: error.code ?? 'INVALID_JSON', message: error.message } })}\n`);
      }
    });
    socket.once('close', () => {
      if (pendingHostId && !terminal) broker.cancel(pendingHostId);
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    if (tcpEndpoint) server.listen(Number(tcpEndpoint.port), tcpEndpoint.hostname, resolveListen);
    else server.listen(socketEndpoint, resolveListen);
  });
  if (socketEndpoint && process.platform !== 'win32') await chmod(socketEndpoint, 0o600);
  const actualEndpoint = tcpEndpoint
    ? `tcp://127.0.0.1:${server.address().port}`
    : socketEndpoint;
  server.once('close', () => {
    broker.close();
    if (socketEndpoint && process.platform !== 'win32') rm(socketEndpoint, { force: true }).catch(() => {});
  });
  return { server, endpoint: actualEndpoint };
}
