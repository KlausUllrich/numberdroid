# Local Art Pipeline Experiments — 2026-08-14

Status: **historical negative-result note; not a binding production dependency**

A separate local ComfyUI/RTX 4090 experiment independently tested the same problem addressed by Numberdroid's Controlled Art Pass. Its generative pipeline was retired because the current Numberdroid material source and deterministic process produced the stronger result.

These failures are recorded so later agents do not repeat them without a materially different implementation/checkpoint.

## IP-Adapter style transfer

Goal: propagate the approved Numberdroid wall material onto new deterministic geometry.

Result: **failed for geometry-critical modular art**.

Material transferred, but source **layout also transferred** and broke the structural lock. Three weight/timing configurations were tested. Structural mask restoration did not rescue the result because the desired material was often generated outside the target mask.

Do not assume IP-Adapter separates style/material from layout strongly enough for precision tiles.

## Qwen-Image-Edit local edit pass

Result with the locally available checkpoint: **failed**.

The edit target was effectively ignored and a new result was generated instead of respecting the supplied structure. Canonical/alternative weights were not tested, so this is checkpoint-specific evidence rather than a permanent ban.

The existing Numberdroid rule still applies: if an edit target is ignored, disposition is `FAIL — edit target not respected`.

## Flat guide used as both structure source and img2img source

Result: **failed**.

Using the flat deterministic guide simultaneously as the structural control and the image-to-image starting image consistently produced flat, under-materialized output.

If a future ControlNet/local workflow is attempted, keep deterministic geometry control conceptually separate from the rich material source instead of asking the same flat guide to provide both.

## What remained useful from the local experiment

Two pure post-processing ideas were adopted into the main Numberdroid process:

1. semantic connector canonicalization using median edge strips and inward blending;
2. automated seam measurement that always includes a negative control.

See `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`.
