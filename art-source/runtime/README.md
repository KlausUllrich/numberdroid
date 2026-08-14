# Runtime art materialization sources

These text-safe sources reconstruct selected generated PNG assets during `predev` / `prebuild` via `scripts/materialize-art-assets.mjs`.

Current controlled assets:

- `transfer-hall-architecture-16px.b64.00` + `.01` — validated accepted wall **material source**. The materializer deterministically expands this source into the current 24 px visible fascia, restores exact semantic masks, canonicalizes named connector classes, and writes `public/assets/deck/transfer-hall-architecture.png`.
- `directional-pico-gold.b64.00` … `.03` → `public/assets/robots/directional-pico.png`.

Do not hand-edit the base64 chunks. The wall source remains intentionally independent of the current runtime fascia geometry: material may be reused while deterministic post-processing owns the final 64 px production geometry.

Production build also runs `scripts/validate-wall-seams.mjs`, which compares same-type connector edges against a negative control of different semantic connector types. A seam score without that control is not considered meaningful QA.
