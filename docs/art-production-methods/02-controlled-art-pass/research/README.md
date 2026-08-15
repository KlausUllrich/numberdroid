# M2 Research Index

Use this folder for experiments specific to structure-guided raster/image editing.

Current canonical experiment notes remain at repository level to avoid duplicating history:

- `docs/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md` — IP-Adapter, Qwen-Image-Edit and flat-guide/img2img negative results.
- `ART_PIPELINE_BREAKTHROUGH_2026-08-14.md` — first successful deterministic-guide → generative-material proof.

When adding new Invoke/ControlNet/img2img research, record:

1. exact tool/model/checkpoint/version;
2. structural input;
3. material/reference input;
4. relevant control strengths/timings;
5. resulting image;
6. geometry-retention result;
7. material-quality result;
8. whether mask restoration actually salvages the output;
9. conclusion and whether the experiment should be repeated.

Do not record only a visually selected winner. Negative results are part of the production knowledge base.