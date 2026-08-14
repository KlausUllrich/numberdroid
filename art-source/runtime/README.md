# Runtime art materialization sources

These text-safe sources reconstruct selected generated PNG assets during `predev` / `prebuild` via `scripts/materialize-art-assets.mjs`.

Current controlled assets:

- `transfer-hall-architecture-16px.b64.00` + `.01` → `public/assets/deck/transfer-hall-architecture.png`
- `directional-pico-gold.b64.00` … `.03` → `public/assets/robots/directional-pico.png`

Do not hand-edit the base64 chunks. The materializer validates PNG signature, exact dimensions, byte count and SHA-256 before writing runtime files.
