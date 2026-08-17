# Numberdroid — Image Generation Turn Contract

Status: **binding ChatGPT execution contract for `image_gen` turns**

This document owns only the technical execution of a ChatGPT image-generation turn. Asset design, approval, QA and production rules remain in `ARTIST_AGENT_WORKFLOW.md`, `PROP_ASSET_WORKFLOW.md`, validation documents and the relevant asset recipe.

The purpose is to prevent image-generation turns from appearing to hang or close incorrectly because the tool call was emitted through the wrong response channel, followed by an extra assistant message, or invoked without a valid hard authorization command.

## 1. Hard authorization gate comes first

For Prop / Prop-like Hero image work, read and obey `HARD_GENERATION_COMMAND_GATE.md` before considering any `image_gen` call.

Binding predicate:

```text
generationAuthorized = trim(currentUserMessage).toLowerCase() === "generieren"
```

If that predicate is false, `image_gen` is prohibited for the current turn.

Important consequences:

- the word `generieren` appearing somewhere inside a sentence does **not** authorize generation;
- `Bitte generieren`, `noch einmal generieren`, `wir sollten eine Variante generieren`, questions, proposals and discussion are not generation commands;
- authorization never carries over from a previous turn;
- one successful `image_gen` call consumes the authorization.

This hard predicate overrides any older/broader workflow wording that merely says a message “contains” `generieren`.

## 2. Tool schema wins

After authorization passes, follow the currently exposed tool schema and platform instructions.

When the tool declares a required target channel, invoke it in that channel. In the current ChatGPT environment, `image_gen` is a **commentary-channel tool**.

Therefore:

- call `image_gen` through **commentary**;
- never invoke `image_gen` through `final`;
- if a future tool schema changes the required channel, follow that current schema rather than this historical channel name.

## 3. Generation turn is tool-only

All design explanation, prompt philosophy, user correction and authorization happens **before** the generation turn.

Once the current user message passes the hard authorization gate, the generation turn contains:

```text
verify exact standalone authorization internally
→ exactly one image_gen call in the tool-declared channel
→ END TURN
```

Do not emit in that same generation turn:

- a visible preamble;
- a status/update message;
- an explanation of what will be generated;
- a normal `final` response after the tool call;
- extraction, integration or QA work after the tool call.

The image returned by `image_gen` is the user-visible result and is the terminal output of that assistant turn.

## 4. No post-tool final message

After `image_gen` returns, **do not send an additional assistant `final` message**, including an empty or placeholder summary intended to close the turn.

The tool return itself closes the generation turn.

Normal dialogue resumes only after the user sends the next message.

## 5. QA remains a separate turn

The next user turn may enter QA according to the applicable workflow.

For Prop work:

- `QA` means inspection only and never calls `image_gen`;
- a later standalone message exactly equal to `generieren` may authorize one new generation;
- a QA/commentary message cannot inherit generation permission from the previous turn.

Do not combine generation and QA into one assistant turn.

## 6. Failure handling

If the image tool reports success but the user says the image did not render or the turn appears stuck:

1. do not automatically regenerate;
2. acknowledge the rendering/turn failure separately;
3. verify whether the previous call respected the hard authorization gate and this turn contract;
4. treat invalid authorization, wrong-channel invocation or an added post-tool final response as process defects;
5. only generate again after a new current user message independently passes the standalone `generieren` predicate.

Do not mask a turn-boundary problem by repeatedly rerolling images.

## 7. Known failures learned during TS-01 Transfer Apparatus work

Two distinct process defects were observed during Transfer Apparatus iteration:

1. `image_gen` was invoked through the `final` channel even though the tool required `commentary`;
2. a normal discussion sentence containing the word `generieren` was interpreted as authorization even though the user had not issued the standalone generation command.

The user observed confusing/long generation behavior and unwanted image calls.

These observations do not prove every platform-level cause, but both are concrete contract violations and must not recur.

Binding correction:

> **For Prop image generation, the current user message must be exactly `generieren`; then use exactly one `image_gen` call in its declared tool channel and emit no assistant final response afterward.**
