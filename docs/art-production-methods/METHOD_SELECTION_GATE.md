# Art Production Method Selection Gate

Status: **binding pre-production gate**

Before any new Numberdroid production image is generated or edited, the Artist must select the production method in the asset recipe.

## Required questions

1. Is exact geometry required?
2. Are there modular connectors?
3. Do any isolated silhouette edges become hidden continuations when assembled?
4. Does one material need to remain coherent across many pieces?
5. Is the texture itself required to be seamless/periodic?
6. Is the asset primarily a unique expressive form?
7. Is non-destructive local retouch likely to be required?

## Required output in recipe

```text
Primary production method:
Material/source method:
Optional finishing method:
Geometry authority:
Topology/edge authority:
Material authority:
Why this split fits the asset:
```

## Default choices

- expressive character / unique prop source → M1;
- deterministic shape with simple exposed silhouette → M2;
- modular architecture with semantic connector edges → M4;
- supervised non-destructive paint-over/local correction → M3;
- seamless texture requirement → first read `capabilities/seamless-materials.md`, then choose an implementation that can prove periodicity.

## Failure rule

If production reveals that the chosen method is being asked to infer information it cannot observe — for example neighbor topology absent from the generation input — stop and reassign that responsibility to a deterministic or layered method. Do not keep escalating prompt complexity to compensate for missing information.
