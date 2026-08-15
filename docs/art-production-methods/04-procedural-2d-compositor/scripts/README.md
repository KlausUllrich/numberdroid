# M4 Scripts

Canonical runnable code lives under `scripts/art/` so it can be executed from the repository root; this method folder documents and indexes it.

Current prototype:

```text
scripts/art/compositor2d.mjs
scripts/art/render-compositor-demo.mjs
```

Run:

```text
npm run art:compositor-demo
```

Local outputs are written to `tmp/art-compositor-demo/` and are ignored by git.

## Current proof scope

The first prototype proves:

- exact 64×64 geometry masks;
- explicit connector segments;
- exposed-boundary detection that excludes connectors;
- deterministic edge-darkening / restrained inner highlight;
- connector canonicalization after compositing;
- exact PNG export without new dependencies;
- deterministic material/demo generation;
- a three-tile H_TOP assembly preview.

The demo material is deliberately procedural and temporary. It proves the compositor mechanics; it is **not** the final Transfer Ship material source.

## Next extension

After art-direction QA of the H_TOP proof:

1. load an approved external material swatch rather than the demo noise field;
2. add `CORNER_NW` semantic geometry;
3. add `T_TOP_DOWN` and divider geometry;
4. generalize named connector groups from the TS-01 recipe;
5. pack the complete 13-piece atlas only after the small assemblies pass.

Asset-specific semantic data belongs with the asset recipe, for example:

```text
art-source/recipes/transfer-hall/walls/
```

Do not bury material-generation/model calls inside the compositor. The compositor consumes already-approved material inputs.