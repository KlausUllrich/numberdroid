# Transfer System — FX Sources

This folder stores approved/source-quality movable visual and effect components that belong to the Transfer System family.

## Yellow Core — approved source authority

The Yellow Core is the transferable identity module used by the Transfer System. It is deliberately separate from the static Transfer Apparatus artwork so it can later move between the Apparatus and robot bodies.

Canonical approved original:

```text
yellow-core__approved-original__2026-08-17.png
```

Verified metadata:

```text
component:          yellow-core
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   aa37c4e9-57ab-4df0-b08a-7279e12f3a9a
format:             PNG RGBA
original size:      1254 × 1254 px
raw bytes:          1,418,808
sha256:             83f647900f0d5fba0dcd0c4f15ce9c705dbee90f4d9a12637129feeb9d64110d
git blob sha1:      f5e0a9f0afe3f966afe3a7b0b08fe7438ac1b297
repository verify:  PASS — byte-identical approved upload
```

Design authority:

- compact circular transferable module;
- luminous amber/yellow identity sphere is the primary read;
- white/graphite close-fitting technical frame;
- thin orbital metal bands;
- restrained cyan system accents;
- no long spikes or protruding station-like arms;
- intended to be easy to remove from one body and insert into another.

The original above is immutable after approval. Runtime derivatives are build products and do not replace source authority.

## Yellow Core — accepted runtime

The accepted in-game scale is materialized deterministically by:

```text
scripts/materialize-yellow-core.mjs
→ public/assets/deck/yellow-core.png
```

Verified production contract:

```text
source alpha crop:       x=155, y=116, w=946, h=968
runtime canvas:          96 × 96 px
runtime margin:          4 px
runtime content bounds:  x=5, y=4, w=86, h=88
runtime SHA-256:         b300e7d535aee21de75b6276c81b2c4973391d22dcb2bdcf79b50833f9d421ae
runtime status:          accepted / live QA PASS
```

The Core is emitted as a separate `transfer-fx` sprite centered on the accepted Transfer Apparatus resting platform. It is intentionally **not** a normal Prop and has no independent collision. This is a structural requirement so later Transfer choreography can move the same visual between the Apparatus and robot bodies.

### Final live QA acceptance — 2026-08-17

Klaus reviewed the 96 × 96 runtime Core live on the accepted 4 × 6 Transfer Apparatus and approved the visual scale and placement. The Core remains clearly readable as a separate identity module without overpowering the Apparatus, and its center alignment on the resting platform is accepted.

```text
SOURCE APPROVED
→ USER UPLOAD VERIFIED
→ APPROVED SOURCE ARCHIVED
→ 96×96 RUNTIME MATERIALIZED
→ TRANSFER-FX LAYER VALIDATED
→ LIVE QA PASS
→ RUNTIME ACCEPTED
```

Future changes to the Yellow Core's static source, 96 × 96 resting scale, or center placement should be treated as deliberate revisions. Transfer motion, synchronization effects and robot-body insertion remain separate animation/FX work.
