# Capability: Freistellen / alpha extraction

Status: **PLANNED**

No generic production implementation exists yet.

## Intended problem

Convert generated/authored isolated objects into clean transparent runtime assets without damaging the subject or baking unwanted floor/background pixels into the sprite.

Potential reusable stages:

1. foreground/background segmentation or supplied-mask ingestion;
2. deterministic alpha cleanup;
3. edge decontamination / matte-color removal;
4. optional contact-shadow separation into its own controlled layer/envelope;
5. crop/pad to documented footprint;
6. stray-pixel and halo QA;
7. runtime-scale inspection.

## Hard requirements before PROVEN

A future implementation must be tested on actual Numberdroid props/hero objects and must explicitly measure or visually inspect:

- clipped thin features;
- translucent parts;
- dark/light matte halos;
- accidental floor/background retention;
- contact-shadow ownership;
- alpha noise outside intended footprint;
- downscale behavior.

Do not equate "background removed" with production-ready transparency.

## Method relation

Likely reusable by M1 Direct Generative Source, M2 Controlled Art Pass and M3 editor workflows. It is a tool capability, not a separate art method by itself.
