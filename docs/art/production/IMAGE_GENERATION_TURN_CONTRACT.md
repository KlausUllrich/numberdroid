# Numberdroid — Image Generation Turn Contract

Status: **binding ChatGPT execution contract for `image_gen` turns**

This document owns only the technical execution of a ChatGPT image-generation turn. Asset design, approval, QA and production rules remain in `ARTIST_AGENT_WORKFLOW.md`, `PROP_ASSET_WORKFLOW.md`, validation documents and the relevant asset recipe.

The purpose is to prevent image-generation turns from appearing to hang or close incorrectly because the tool call was emitted through the wrong response channel or followed by an extra assistant message.

## 1. Tool schema wins

Before calling `image_gen`, follow the currently exposed tool schema and platform instructions.

When the tool declares a required target channel, invoke it in that channel. In the current ChatGPT environment, `image_gen` is a **commentary-channel tool**.

Therefore:

- call `image_gen` through **commentary**;
- never invoke `image_gen` through `final`;
- if a future tool schema changes the required channel, follow that current schema rather than this historical channel name.

## 2. Generation turn is tool-only

All design explanation, prompt philosophy, user correction and authorization happens **before** the generation turn.

Once the current user message authorizes generation under the active workflow, the generation turn contains:

```text
verify authorization + target internally
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

## 3. No post-tool final message

After `image_gen` returns, **do not send an additional assistant `final` message**, including an empty or placeholder summary intended to close the turn.

The tool return itself closes the generation turn.

Normal dialogue resumes only after the user sends the next message.

## 4. QA remains a separate turn

The next user turn may enter QA according to the applicable workflow.

For Prop work:

- `QA` means inspection only and never calls `image_gen`;
- `generieren` authorizes one new generation only under `PROP_ASSET_WORKFLOW.md`;
- if `QA` and `generieren` occur together, QA wins.

Do not combine generation and QA into one assistant turn.

## 5. Failure handling

If the image tool reports success but the user says the image did not render or the turn appears stuck:

1. do not automatically regenerate;
2. acknowledge the rendering/turn failure separately;
3. verify whether the previous call respected this contract;
4. treat wrong-channel invocation or an added post-tool final response as a process defect;
5. only generate again after the workflow's explicit authorization rule is satisfied.

Do not mask a turn-boundary problem by repeatedly rerolling images.

## 6. Known failure learned during TS-01 Transfer Apparatus work

During Transfer Apparatus iteration, `image_gen` was invoked through the `final` channel even though the tool required `commentary`. The user repeatedly observed that the image-generation turn did not finish cleanly / appeared to hang.

This does not prove that channel misuse was the only platform-level cause, but it is a concrete contract violation and must not recur.

Binding correction:

> **For ChatGPT image generation, use exactly one `image_gen` tool call in its declared tool channel and emit no assistant final response afterward.**
