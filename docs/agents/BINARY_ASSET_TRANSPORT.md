# Numberdroid — Binary Asset Transport Contract

Status: **binding repository transport rule for binary files**

This document owns the safe transport of binary repository assets such as PNG, WEBP, JPG, ZIP, audio and other non-text files.

It is the highest-authority repository rule for binary transport and **supersedes older size-threshold wording** in parent/router documents. If another current document still says that inline Base64 is allowed below some byte ceiling, this contract wins.

The purpose is to prevent binary data from being serialized through ChatGPT/model/tool text payloads. That path consumes model output/context, expands data, creates large JSON arguments and can make a turn appear to hang even when the underlying file is small by normal asset standards.

## 1. Core rule — no inline Base64 through the agent

For repository binary writes:

> **Inline Base64 in model-visible reasoning, assistant output, or tool arguments is prohibited regardless of file size.**

Do not construct a Base64 representation merely because a connector exposes a string-based `create_blob(..., encoding="base64")` action.

The existence of such an API means the remote API can accept Base64. It does **not** mean serializing the whole binary through the language-model/tool channel is an acceptable agent workflow.

This prohibition includes:

- `create_blob(content=<base64>)` constructed by the assistant;
- UTF-8 text wrappers containing Base64;
- data URIs;
- raster bytes embedded into SVG/HTML/JS;
- chunked Base64 across several calls;
- temporary Base64 repository files reconstructed by CI;
- repeated retries with a smaller/quantized binary solely to fit the model payload.

## 2. Mandatory executable preflight

Before any binary repository publication attempt, run:

```bash
npm run repo:binary-preflight -- <local-or-mounted-file>
```

The command reports the raw size and estimated Base64 expansion for diagnostics, but its authorization result is categorical:

```text
inlineBase64Allowed = false
recommendedTransport = real-file-transport-required-or-BINARY_TRANSPORT_BLOCKED
```

For any operation that would require the assistant to construct inline Base64, run the assertion mode:

```bash
npm run repo:binary-preflight -- --require-inline <file>
```

Exit code `2` means the inline path is prohibited. Under the current contract this assertion **always rejects repository binary Base64**, regardless of raw byte size.

CI runs `npm run repo:binary-preflight-test` so the guard cannot silently drift back to a size-based exception.

The preflight must happen before reading/encoding the binary into an assistant/tool argument.

## 3. Why there is no size exception

The Transfer Apparatus incident showed that a numeric threshold is the wrong model.

Observed files/payloads during the same production pass:

```text
production candidate PNG
raw      102,990 bytes
Base64   137,320 characters

quantized candidate PNG
raw       25,174 bytes
Base64    33,568 characters

grounding-shadow PNG
raw        8,298 bytes
Base64    11,064 characters
```

The ~103 KiB PNG was successfully transported once through Base64, proving there is no simple low hard-limit such as 16 KiB or 100 KiB.

However, the later shadow phase still spent an abnormally long time in Base64/commit preparation even though the raw shadow was only ~8 KiB. This demonstrates that **turn reliability depends on accumulated context, serialization work, tool framing and repeated binary-text handling — not only raw file size**.

Base64 also expands binary by roughly one third before JSON/tool framing. More importantly, the encoded characters become model/tool text and therefore consume generation/context budget that should never be spent on opaque binary bytes.

The durable fix is categorical: **binary bytes do not travel through the model text path.**

## 4. Preferred transport hierarchy

### A. Connector action with a real file/path parameter

If a connector action explicitly accepts a mounted/local file path, connector file reference or equivalent binary/file parameter, use it directly.

Do not read the file into Base64 yourself.

### B. Existing authenticated local checkout + normal Git transport

If the execution environment already provides an authenticated local checkout of this repository:

1. verify the checkout and current branch;
2. verify authentication as required by the repository workflow;
3. create/copy the binary at its intended repository path;
4. stage only the intended binary path(s);
5. commit normally;
6. push the focused branch;
7. return to the GitHub connector for PR metadata, review and CI inspection.

This path transports the file through Git/GitHub as binary data rather than through the model's textual tool arguments.

Do **not** create/clone a local checkout merely as a speculative network fallback when repository workflow forbids that. The checkout must already be available/authenticated or explicitly provided by the environment/workflow.

### C. No real file transport available

If neither A nor B is available, stop that binary publication step immediately and report:

```text
BINARY_TRANSPORT_BLOCKED
```

Continue any independent text/code/metadata work that remains truthful, but do not claim the binary is committed, pushed, registered or deployed.

Failing fast is the intended behavior. A visible transport blocker is preferable to a multi-minute stuck agent turn.

## 5. Mandatory binary preflight record

Before constructing any repository write for a binary file, record internally:

```text
LOCAL/MOUNTED PATH
RAW BYTE SIZE
ESTIMATED BASE64 BYTE SIZE
TARGET REPOSITORY PATH
DIRECT FILE-AWARE CONNECTOR ACTION AVAILABLE? yes/no
AUTHENTICATED LOCAL CHECKOUT AVAILABLE? yes/no
SAFE TRANSPORT SELECTED
INLINE BASE64 AUTHORIZED? no
```

`INLINE BASE64 AUTHORIZED` is always `no` for repository binaries.

## 6. State discipline

Keep these states distinct:

```text
LOCAL_BINARY_READY
BINARY_TRANSPORT_BLOCKED
BINARY_COMMITTED
BINARY_PUSHED
RUNTIME_REGISTERED
CI_GREEN
LIVE_ACCEPTED
```

A locally generated PNG is not committed merely because its recipe/code exists.

A remote blob SHA is not sufficient unless a reachable branch/commit references the blob at the intended repository path.

Do not update art status to `RUNTIME_REGISTERED` until the actual binary file is reachable on the working branch and the runtime registry points to it.

## 7. Current ChatGPT/GitHub environment behavior

The GitHub connector remains preferred for structured/textual repository reads/writes, PRs and CI metadata.

For binary publication, inspect its actual exposed schema. If it offers only string/Base64 content and no real file parameter, that is **not a safe binary transport capability for this agent workflow**.

Likewise, local Git/`gh` is a valid binary path only when an authenticated local checkout actually exists. Do not infer repository availability from local network state and do not perform speculative clone/network diagnostics merely because the connector exists.

If neither safe path exists, use `BINARY_TRANSPORT_BLOCKED` rather than Base64.

## 8. Transfer Apparatus failure analysis — 2026-08-17

During Transfer Apparatus production the agent repeatedly converted PNG files to Base64 in preparation for GitHub `create_blob` calls.

What actually happened:

1. the approved/generated raster existed correctly as a local binary file;
2. the agent converted it into a large opaque text string solely to satisfy a string-based connector action;
3. one ~137k-character Base64 payload succeeded, which made the workflow appear viable;
4. additional quantization/encoding passes created more binary-derived text and more tool/context work;
5. later, while preparing the much smaller ~11k-character shadow Base64, the agent spent an abnormally long time in the Base64/commit phase and appeared stuck;
6. therefore the failure was **not a reliable file-size limit** but an unsuitable transport architecture.

Root cause:

> **Opaque binary bytes were routed through the language-model text channel instead of a file-aware transport.**

Binding correction:

> **Never inline Base64 for repository binary writes. Use real file transport when available; otherwise stop immediately with `BINARY_TRANSPORT_BLOCKED`.**
