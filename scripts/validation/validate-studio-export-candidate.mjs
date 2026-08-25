#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildNumberdroidCandidate,
} from '../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
async function compilerFingerprint() {
  const levelgenFiles = (await readdir(join(ROOT, 'src/levelgen'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map((entry) => `src/levelgen/${entry.name}`);
  const authorityFiles = [...levelgenFiles, 'src/game/types.ts'].sort();
  const hash = createHash('sha256');
  for (const relative of authorityFiles) {
    hash.update(`${relative}\0`);
    hash.update(await readFile(join(ROOT, relative)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function buildCandidateWithCanonicalCompiler(snapshot) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const [{ compileLevelSpec }, { validatePlacementOverrides }, { compileWorkbenchPlan }, { NUMBERDROID_PROP_REGISTRY }, { NUMBERDROID_PROP_ART_REGISTRY }] = await Promise.all([
      vite.ssrLoadModule('/src/levelgen/compiler.ts'),
      vite.ssrLoadModule('/src/levelgen/overrides.ts'),
      vite.ssrLoadModule('/src/levelgen/workbench.ts'),
      vite.ssrLoadModule('/src/levelgen/propRegistry.ts'),
      vite.ssrLoadModule('/src/levelgen/propArtRegistry.ts'),
    ]);
    return buildNumberdroidCandidate(snapshot, {
      compilerVersion: `numberdroid-level-compiler.sha256:${await compilerFingerprint()}`,
      compileLevelSpec,
      compileWorkbenchPlan,
      validatePlacementOverrides,
      propRegistry: NUMBERDROID_PROP_REGISTRY,
      propArtRegistry: NUMBERDROID_PROP_ART_REGISTRY,
    });
  } finally {
    await vite.close();
  }
}
