# M4 Material Inputs

M4 consumes material; it does not generate material by itself.

A compositor material source should ideally be:

- free of object outlines, frames, caps and fixed silhouette cues;
- large enough to avoid obvious repetition at gameplay scale;
- low enough in contrast that later deterministic edge shading remains readable;
- semantically neutral unless a recipe explicitly assigns a semantic material channel;
- free of baked global scene lighting;
- documented by source/revision and approval state.

For Transfer Ship graphite walls, the target is a calm dark mineral/composite surface with broad low-frequency variation and restrained microtexture — **not** an already-framed wall object.

Possible sources include:

- M1-generated material swatch;
- authored raster texture;
- procedural material/noise field;
- M3-edited material texture;
- future seamless/periodic synthesis.

Production material files belong with the asset recipe or a dedicated shared material library once reuse justifies one. Do not put production binaries in this docs directory merely to satisfy the folder structure.