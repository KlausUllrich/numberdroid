# M4 Scripts

Reusable procedural compositor code belongs here **only when it is method-generic**.

Asset-specific semantic data belongs with the asset recipe, for example:

```text
art-source/recipes/transfer-hall/walls/
```

The first prototype script should remain deliberately small and prove:

- loading one material texture;
- applying it through exact geometry masks;
- distinguishing exposed versus connector edges;
- deterministic AO/outline/highlight treatment;
- exporting exact 64×64 tiles and a compact atlas;
- producing a repeated assembly preview;
- deterministic output for fixed inputs/settings.

Do not bury material-generation/model calls inside the compositor. The compositor consumes already-approved material inputs.