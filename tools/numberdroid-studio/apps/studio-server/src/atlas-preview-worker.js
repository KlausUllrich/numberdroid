import { createHash, randomUUID } from 'node:crypto';
import { StudioError, invariant } from '../../../packages/domain/src/errors.js';
import { cropSupportedPng, MAX_ATLAS_OUTPUT_BYTES } from '../../../packages/preview/src/index.js';

const SOURCE_LIMIT_BYTES = 16 * 1024 * 1024;
const LEASE_MS = 30_000;

function operationKey(label, job) {
  const digest = createHash('sha256')
    .update(`${label}:${job.projectId}:${job.jobId}:${job.attempt}`)
    .digest('hex');
  return `jobop.${digest.slice(0, 48)}`;
}

async function readBounded(stream, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    length += chunk.length;
    invariant(length <= maxBytes, 'ARTIFACT_TOO_LARGE', 'Atlas source exceeds the preview worker byte limit.', { maxBytes });
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function errorRecord(error) {
  const trusted = error instanceof StudioError && /^[A-Z][A-Z0-9_]{0,99}$/.test(error.code);
  return {
    code: trusted ? error.code : 'ATLAS_PREVIEW_FAILED',
    message: trusted ? error.message : 'Atlas preview processing failed.',
  };
}

export class AtlasPreviewWorker {
  #jobStore;
  #artifactStore;
  #artifactMetadataStore;
  #workerId;
  #clock;
  #running = null;
  #timer = null;

  constructor({
    jobStore,
    artifactStore,
    artifactMetadataStore,
    workerId = `worker.atlas.${randomUUID()}`,
    clock = () => new Date().toISOString(),
  }) {
    invariant(jobStore?.isLive === true, 'VALIDATION_ERROR', 'AtlasPreviewWorker requires a live durable job store.');
    invariant(artifactStore && artifactMetadataStore, 'VALIDATION_ERROR', 'AtlasPreviewWorker requires CAS bytes and metadata stores.');
    this.#jobStore = jobStore;
    this.#artifactStore = artifactStore;
    this.#artifactMetadataStore = artifactMetadataStore;
    this.#workerId = workerId;
    this.#clock = clock;
  }

  start({ intervalMs = 1000 } = {}) {
    if (this.#timer) return;
    this.kick();
    this.#timer = setInterval(() => this.kick(), intervalMs);
    this.#timer.unref?.();
  }

  async stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    const running = this.#running;
    if (running) await running;
  }

  kick() {
    if (!this.#running) {
      this.#running = this.drain().finally(() => { this.#running = null; });
    }
    return this.#running;
  }

  async drain() {
    let processed = 0;
    while (true) {
      const job = this.#jobStore.claimNext({
        workerId: this.#workerId,
        leaseMs: LEASE_MS,
        now: this.#clock(),
      });
      if (!job) return processed;
      await this.#runClaimed(job);
      processed += 1;
    }
  }

  async #runClaimed(job) {
    try {
      this.#jobStore.assertExecutionAuthority(job.projectId, job.jobId, {
        workerId: this.#workerId,
        now: this.#clock(),
      });
      invariant(job.kind === 'ATLAS_PREVIEW', 'JOB_KIND_UNSUPPORTED', 'The atlas worker claimed an unsupported job kind.', { kind: job.kind });
      invariant(job.input?.processorId && Array.isArray(job.input.rectangles), 'JOB_INPUT_MISMATCH', 'Atlas preview job input is incomplete.');
      const stream = await this.#artifactStore.createReadStream(job.input.sourceDigest);
      const sourceBytes = await readBounded(stream, SOURCE_LIMIT_BYTES);
      const expectedSource = {
        digest: job.input.sourceDigest,
        mediaType: job.input.sourceMediaType,
        width: job.input.sourceWidth,
        height: job.input.sourceHeight,
      };
      const rectangles = job.input.rectangles.filter((rectangle) => rectangle.included);
      const outputs = [];
      for (let index = 0; index < rectangles.length; index += 1) {
        this.#jobStore.assertExecutionAuthority(job.projectId, job.jobId, {
          workerId: this.#workerId,
          now: this.#clock(),
        });
        const current = this.#jobStore.get(job.projectId, job.jobId);
        if (current.cancelRequested) {
          this.#jobStore.cancelAtSafePoint(job.projectId, job.jobId, {
            workerId: this.#workerId,
            safePoint: `before.slice.${index}`,
            operationIdempotencyKey: operationKey(`cancel.${index}`, job),
            now: this.#clock(),
          });
          return;
        }
        const cut = cropSupportedPng(sourceBytes, [rectangles[index]], { expectedSource });
        const candidate = cut.outputs[0];
        const ingested = await this.#artifactStore.ingest(candidate.bytes, {
          mediaType: 'image/png',
          expectedDigest: candidate.expectedDigest,
          limits: { maxBytes: MAX_ATLAS_OUTPUT_BYTES, maxWidth: 4096, maxHeight: 4096 },
        });
        outputs.push({
          rectangleId: candidate.rectangleId,
          digest: ingested.digest,
          mediaType: ingested.mediaType,
          byteSize: ingested.byteSize,
          width: ingested.width,
          height: ingested.height,
        });
        this.#jobStore.publishOutput(job.projectId, job.jobId, {
          workerId: this.#workerId,
          rectangleId: candidate.rectangleId,
          artifact: ingested,
          current: index + 1,
          total: rectangles.length,
          safePoint: `after.slice.${index}`,
          leaseMs: LEASE_MS,
          now: this.#clock(),
        });
      }
      this.#jobStore.assertExecutionAuthority(job.projectId, job.jobId, {
        workerId: this.#workerId,
        now: this.#clock(),
      });
      this.#jobStore.succeed(job.projectId, job.jobId, {
        workerId: this.#workerId,
        outputs,
        result: {
          schemaVersion: 1,
          processorId: job.input.processorId,
          inputFingerprint: job.inputFingerprint,
          outputCount: outputs.length,
        },
        operationIdempotencyKey: operationKey('succeed', job),
        now: this.#clock(),
      });
    } catch (error) {
      const latest = this.#jobStore.get(job.projectId, job.jobId);
      if (latest?.state === 'RUNNING' && latest.lease?.owner === this.#workerId) {
        try {
          if (latest.cancelRequested) {
            this.#jobStore.cancelAtSafePoint(job.projectId, job.jobId, {
              workerId: this.#workerId,
              safePoint: 'worker.error.after.cancel',
              operationIdempotencyKey: operationKey('cancel.error', job),
              now: this.#clock(),
            });
          } else {
            this.#jobStore.fail(job.projectId, job.jobId, {
              workerId: this.#workerId,
              error: errorRecord(error),
              operationIdempotencyKey: operationKey('fail', job),
              now: this.#clock(),
            });
          }
        } catch {}
      }
    }
  }
}
