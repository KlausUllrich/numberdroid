# Checkpoint 5 — deterministic Numberdroid export candidate

Status: **candidate-only foundation authorized for source integration; not user-accepted**

This checkpoint may be developed and source-integrated while Checkpoint 4.5
awaits the designer walkthrough. For the solo-developer workflow, the user
authorized keeping the latest CP4.5 plus CP5 source on `main`. That source merge
does not accept either checkpoint and does not authorize the candidate to
materialize files, create a Git commit, deploy, or publish production output.

## 1. Bounded outcome

The first Checkpoint 5 slice freezes one exact `FINAL` Studio room or hallway
and its referenced asset/source closure, translates that immutable snapshot to
a deterministic Numberdroid candidate, invokes the canonical Level Spec
compiler contract, and produces a content-addressed review manifest.

The candidate is evidence. It is not repository state.

## 2. Authority stages

The stages are intentionally distinct:

1. `snapshot` freezes exact Studio revisions, room/archetype versions, asset and
   metadata versions, committed slice bindings, source artifacts, adapter
   bindings, and export profile.
2. `candidate` deterministically maps the frozen data to logical Numberdroid
   files and artifact-copy descriptors and validates the result.
3. `materialize` may later copy the already verified manifest closure to an
   approved destination. It is not implemented or authorized by this slice.
4. `commit` may later create a repository commit from an unchanged verified
   manifest. It is not implemented or authorized by this slice.
5. `publish` remains a separate, short-lived human capability. It is not
   implemented or authorized by this slice.

Candidate creation therefore cannot partially publish: it performs no writes
to Numberdroid runtime/source trees and no Git or GitHub mutations.

## 3. Immutable snapshot

`createNumberdroidExportSnapshot` accepts only a trusted project document,
exact adapter input, and a bounded verification closure produced after the CAS
bytes were re-read and checked by the persistence integrity port. The verifier
version and exact digest/byte-size/media-type/decoded-dimension records participate in the
snapshot hash. It fails closed unless:

- the exact requested room version exists and is `FINAL`;
- its exact archetype version exists;
- every placement resolves to the pinned asset and metadata version in project
  history;
- every referenced asset version is `FINAL` and explicitly runtime-eligible;
- every referenced slice and approved source has a canonical Studio CAS digest;
- every referenced slice and approved-source digest has one matching byte-level
  and decoded-dimension integrity verification and the verification closure
  contains no unrelated artifact;
- one exact-version adapter binding exists for every referenced asset; and
- every target path is normalized, collision-free, and confined to either
  `public/` for runtime bytes or `art-source/approved/` for source/provenance.

No clock value participates in the snapshot. Identical trusted input, adapter
version, and export profile therefore produce the same snapshot ID.

The trusted factory brands the exact frozen object in process. The brand is not
serializable. Candidate building rejects caller-constructed, cloned, parsed, or
self-rehashed snapshot JSON even if its public fields and hash appear valid.

## 4. Adapter mapping

Only `packages/numberdroid-adapter` knows these Numberdroid-specific rules:

- stable Level Spec IDs and deterministic seed/profile values;
- exact locked room geometry and exact locked prop placement overrides;
- `surface` assets as floor-material bindings and `prop`/`item` assets as
  canonical Prop Registry bindings;
- runtime paths below `public/` and approved source paths below
  `art-source/approved/`;
- presentation art paths checked against the canonical Prop Art Registry;
- Studio tile spans checked against canonical Prop Registry footprints and
  allowed rotations; and
- canonical Level Spec and placement-override validation.

The first slice deliberately blocks candidate approval while structural surface
art is not referenced by a canonical Level Spec floor-material/tileset registry.
It also blocks Props whose canonical shadow, accepted-art, placement, collision,
attachment, or exact-fit contract is not yet fingerprint-pinned by the adapter.
A compiler pass alone is not adapter fidelity.

Studio domain/application packages remain generic and do not learn repository
paths, Level Spec fields, Prop IDs, registry layout, or compiler invocation.

## 5. Shape and connector fidelity

The current Level Spec can lock a rectangular semantic space but has no
authoritative `VOID`/`BLOCKED` cell-mask representation. The candidate retains
the complete Studio room document and connector list for review, but any
non-empty room-shape mask produces the blocking finding
`numberdroid.adapter.room_shape_unsupported`. The adapter must not silently
flatten an irregular room into a rectangle.

A single-room candidate also must not invent external spaces merely to turn
Studio entrance descriptors into Level Spec connections. Entrances remain in
the exact Studio room document until a reviewed level-graph mapping exists.

## 6. Candidate manifest

The review result contains:

- canonical `level-spec.json`, exact `studio-room.json`, and provenance JSON;
- logical runtime/source artifact-copy descriptors with SHA-256 digests;
- adapter and canonical compiler findings with remediation text;
- a deterministic hash for every logical file and the complete manifest; and
- explicit stage posture: candidate `VERIFIED` or `BLOCKED`, with
  materialize/commit/publish all `NOT_AUTHORIZED`.

Compiler or adapter errors leave a complete, inspectable `BLOCKED` candidate;
they never leave a partially written repository tree.

## 7. Verification gate

The slice is technically ready for a designer walkthrough only when tests show:

- two identical exports have byte-identical logical files and hashes;
- stale or missing exact pins and unsafe/colliding paths fail closed;
- irregular masks remain visible and block approval;
- prop mappings preserve exact placement, footprint, rotation, runtime art, and
  source provenance;
- an intentional canonical compiler error appears with remediation and can be
  fixed without changing unrelated hashes; and
- no candidate API exposes materialize, commit, publish, GitHub, or arbitrary
  destination-path authority.

Production materialization and publication workflow selection remains the
Checkpoint 5 exit decision and requires separate user approval.
