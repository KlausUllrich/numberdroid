# External-agent / local art-pipeline findings — 2026-08-14

Status: **research evidence; not a runtime dependency**

This note preserves the useful conclusions from the external Claude/local ComfyUI evaluation that was discussed during the Transfer Hall wall work. The underlying local RTX 4090 generative pipeline was not adopted as the production path; the deterministic Numberdroid process produced the stronger result.

Historical detailed experiment record: `../../history/experiments/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md`.

## Findings retained in the toolkit

### Separate geometry control from material source

Using one flat guide as both structural control and visual img2img source produced flat, under-materialized results. The reusable design principle is therefore:

```text
geometry/topology = deterministic authority
material source    = independent visual input
compositor/tools   = deterministic assembly and post-processing
```

### Semantic connector canonicalization is valuable pure post-processing

The external evaluation independently highlighted canonical connector strips as a useful post-process. Numberdroid adopted per-pixel median connector strips with inward blending, driven by named semantic connector classes.

This became a production-proven part of the TS-01 wall pipeline and is now extracted as `scripts/art/toolkit/connectors.mjs`.

### Seam metrics require a negative control

A same-type seam number alone can be misleading. Production QA should compare required matching edges against a deliberately different/reference class so the scale is interpretable.

### Local style-transfer/edit experiments were not reliable enough for precision geometry

Recorded failures included:

- IP-Adapter material/style transfer also transferring layout, breaking structural lock;
- the tested local Qwen-Image-Edit checkpoint ignoring the supplied edit target;
- mask restore being unable to recover material that was generated in the wrong spatial location.

These are implementation-specific negative results, not permanent bans. Re-test only when a materially different model/control implementation is available.

## Toolkit implication

External/model-driven steps should feed reusable deterministic tools rather than become hidden geometry authorities. The toolkit should grow around operations we can specify, test and reproduce: masks, alpha, compositing, seams, periodicity, packing, resampling and validation.
