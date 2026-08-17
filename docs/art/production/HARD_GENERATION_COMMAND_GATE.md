# Numberdroid — Hard Image Generation Command Gate

Status: **binding ChatGPT execution gate for Prop / Prop-like Hero image generation**

This document formalizes one intentionally strict rule: **discussion about generating an image is not authorization to call `image_gen`.**

## Authorization predicate

For Prop / Prop-like Hero work, image generation is authorized only when the complete current user message, after trimming leading/trailing whitespace and case-normalization, is exactly:

```text
generieren
```

Equivalent pseudocode:

```text
generationAuthorized = trim(currentUserMessage).toLowerCase() === "generieren"
```

If `generationAuthorized` is false, `image_gen` is prohibited for that turn.

## Examples that authorize

```text
generieren
```

Only that standalone command authorizes one image-generation call.

## Examples that do NOT authorize

```text
Bitte generieren.
Noch einmal generieren.
Ich würde vorschlagen, dass wir eine neue Variante generieren.
Wir sollten später generieren.
Kannst du das generieren?
Ja, weiter.
Mach das.
Verbessern.
Nächste Variante.
```

Even though some examples contain the word `generieren`, they are ordinary discussion/instructions and do not pass the command gate.

## No carry-over

Authorization is derived from the **current user message only**.

- A previous `generieren` command never authorizes a later turn.
- After one `image_gen` call, authorization is consumed.
- A comment on a generated image starts with generation disabled by default.
- A QA/discussion turn cannot inherit generation permission from the previous generation turn.

## Tool execution after authorization

When and only when the standalone command passes the predicate:

1. call `image_gen` exactly once;
2. use the tool-declared channel (`commentary` in the current environment);
3. generate exactly one proposal;
4. emit no visible preamble in that generation turn;
5. emit no assistant `final` response after the tool returns;
6. wait for the next user turn.

The separate `IMAGE_GENERATION_TURN_CONTRACT.md` owns channel/turn-closure details.

## QA precedence

`QA` remains inspection-only under the Prop workflow. In practice the strict standalone `generieren` predicate means any message containing QA commentary cannot simultaneously authorize generation.

## Why this rule exists

During TS-01 Transfer Apparatus iteration, a user sentence discussing a future generation contained the word `generieren`. The earlier rule treated mere word occurrence as authorization and triggered `image_gen` even though the user intended discussion only.

The corrected contract therefore distinguishes **mentioning the action** from issuing the **standalone command**.
