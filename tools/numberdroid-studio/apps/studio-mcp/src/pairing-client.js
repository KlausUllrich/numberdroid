import { createConnection } from 'node:net';
import { StudioError } from '../../../packages/domain/src/index.js';

export function pairWithStudio({ endpoint, projectId, label = 'Local MCP host' }) {
  if (!endpoint) throw new StudioError('HOST_PAIRING_ENDPOINT_REQUIRED', 'NUMBERDROID_STUDIO_PAIRING_ENDPOINT is required.');
  return new Promise((resolve, reject) => {
    const tcpEndpoint = endpoint.startsWith('tcp://') ? new URL(endpoint) : null;
    const socket = tcpEndpoint
      ? createConnection({ host: tcpEndpoint.hostname, port: Number(tcpEndpoint.port) })
      : createConnection(endpoint);
    let buffer = '';
    socket.setEncoding('utf8');
    socket.once('connect', () => {
      socket.write(`${JSON.stringify({ schemaVersion: 1, projectId, label })}\n`);
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const newline = buffer.indexOf('\n');
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch {
          reject(new StudioError('HOST_PAIRING_PROTOCOL_ERROR', 'Studio pairing returned invalid JSON.'));
          socket.destroy();
          return;
        }
        if (message.status === 'WAITING_FOR_APPROVAL') {
          process.stderr.write(`[numberdroid-studio] MCP host waiting for approval (${message.pendingHost.verificationCode}).\n`);
        } else if (message.status === 'AUTHORIZED' && message.token) {
          resolve(message.token);
        } else if (message.error || message.status === 'REJECTED') {
          reject(new StudioError(message.error?.code ?? 'HOST_PAIRING_REJECTED', message.error?.message ?? 'MCP host pairing was rejected.'));
        }
      }
    });
    socket.once('error', reject);
    socket.once('close', () => reject(new StudioError('HOST_PAIRING_CLOSED', 'Studio pairing closed before authorization.')));
  });
}
