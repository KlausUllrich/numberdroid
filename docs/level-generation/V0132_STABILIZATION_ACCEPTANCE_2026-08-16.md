# Numberdroid — v0.13.2 Gold Slice Stabilization Acceptance

Date: **2026-08-16**

Status: **LIVE QA ACCEPTED**

Branch/implementation merged before this acceptance: PR #79 / `agent/stabilization-v0132`.

This record exists so future sessions do not reopen the v0.13.2 stabilization block merely because older documents still describe v0.13.1 as the current QA target.

## Acceptance

Klaus explicitly confirmed the deployed/generated **v0.13.2 stabilization pass as PASS** on 2026-08-16.

The accepted stabilization contract is the one defined in `GOLD_SLICE_REGRESSION_GATES.md` and implemented by the current `src/levelgen/` / Gold Slice runtime code.

This means the project may proceed from spatial/presentation stabilization to **Generated TS-01 feature/art parity and new production assets**.

## What v0.13.2 stabilized

The regression class introduced after v0.13.1 is now considered accepted for the current TS-01 baseline:

- true-space Prop fitting against the accepted 30 px visible wall fascia and 10 px collision core;
- precise Prop geometry may translate beyond its own coarse integer tile anchor when necessary, while remaining valid against room surfaces, other true-space Prop envelopes, foreign use-space/Hero reservations and Door Clearance;
- Family Table uses multipart physical collision instead of one filled 3×2 rectangle;
- Hologram pedestal uses the reviewed 0.70 × 0.70 tile physical collider;
- fallback blockout presentation is kept inside the visible room interior;
- generated PRIMUS single-room patrol avoids perimeter cells when a safe connected interior exists;
- hand-authored and generated Gold Slice Floors share the accepted Door presentation/timing contract;
- accepted Door values remain 5 px leaf, 520 ms open, 650 ms soft close, aperture clipping and wall-pocket retraction.

Automated regression coverage remains mandatory even though this pass is accepted.

## Important authority clarification

`footprintTiles` is a **coarse deterministic solver anchor/reservation**, not a mandatory final world-space containment box.

Source-local `visualBoundsTiles`, collision parts and placement envelopes are authored inside the 0° source canvas. After cardinal rotation, Exact Fit may apply the smallest necessary sub-tile translation so the true object respects its selected room/wall surfaces.

Therefore any older statement that final precise geometry must remain inside the coarse solved tile rectangle is superseded by the v0.13.2 true-space contract.

PNG alpha, transparent canvas dimensions and DOM measurement remain non-authoritative for collision or placement.

## Art status is separate

This PASS does **not** automatically promote visual candidates to accepted art.

Current distinction remains:

- Family Table + shadow — `LIVE_ACCEPTED`;
- Family Memory Console + shadow — `LIVE_ACCEPTED`;
- Coffee Machine + shadow — `LIVE_CANDIDATE`;
- Planter Trough + shadow — `LIVE_CANDIDATE`;
- Round Plant + shadow — `LIVE_CANDIDATE`;
- Hologram Pedestal + shadow — `LIVE_CANDIDATE`.

The stabilization pass proves that these assets can participate safely in the generated spatial/runtime system. Final visual promotion still requires explicit Art-Director acceptance.

## Known deferred issue

There is still a **smaller issue with the player's own in-game model/presentation**.

It is deliberately deferred for a separate discussion and is **not a blocker for the v0.13.2 stabilization acceptance or for beginning the next Art Asset block**.

Do not silently reinterpret this note as approval to regenerate or alter the accepted PICO source. First identify the concrete runtime/model issue with Klaus, then route it through the relevant Character/Engineering contract.

## Next canonical work

The next active production block is:

1. complete Generated TS-01 feature/art parity;
2. produce the missing Transfer/Flow hero assets;
3. produce the missing PRIMUS hero/system assets;
4. replace useful remaining blockouts with deliberate production assets;
5. add restrained FloorFX/grounding/use-wear where it improves cohesion;
6. compare Generated TS-01 against the Gold Slice target on desktop and phone;
7. only after explicit final visual/gameplay acceptance consider replacing the hand-authored reference.

Accepted Walls, Doors and already accepted Family assets remain frozen unless a concrete defect is found.
