import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const barriers = new Map();

function rootKey(rootDirectory) {
  const absoluteRoot = resolve(rootDirectory);
  let existingAncestor = absoluteRoot;
  let canonicalRoot;
  while (canonicalRoot === undefined) {
    try {
      canonicalRoot = resolve(
        realpathSync.native(existingAncestor),
        relative(existingAncestor, absoluteRoot),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      existingAncestor = parent;
    }
  }
  return process.platform === 'win32' ? canonicalRoot.toLowerCase() : canonicalRoot;
}

class FairSharedExclusiveBarrier {
  #activeShared = 0;
  #activeExclusive = false;
  #queue = [];

  async withShared(operation) {
    const release = await this.#acquire('shared');
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async withExclusive(operation) {
    const release = await this.#acquire('exclusive');
    try {
      return await operation();
    } finally {
      release();
    }
  }

  #acquire(mode) {
    return new Promise((resolvePermit) => {
      this.#queue.push({ mode, resolvePermit });
      this.#drain();
    });
  }

  #drain() {
    if (this.#activeExclusive || this.#queue.length === 0) return;
    if (this.#queue[0].mode === 'exclusive') {
      if (this.#activeShared !== 0) return;
      const waiter = this.#queue.shift();
      this.#activeExclusive = true;
      waiter.resolvePermit(this.#releasePermit('exclusive'));
      return;
    }
    while (!this.#activeExclusive && this.#queue[0]?.mode === 'shared') {
      const waiter = this.#queue.shift();
      this.#activeShared += 1;
      waiter.resolvePermit(this.#releasePermit('shared'));
    }
  }

  #releasePermit(mode) {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (mode === 'exclusive') this.#activeExclusive = false;
      else this.#activeShared -= 1;
      this.#drain();
    };
  }
}

export function maintenanceBarrierForRoot(rootDirectory) {
  const key = rootKey(rootDirectory);
  let barrier = barriers.get(key);
  if (!barrier) {
    barrier = new FairSharedExclusiveBarrier();
    barriers.set(key, barrier);
  }
  return barrier;
}
