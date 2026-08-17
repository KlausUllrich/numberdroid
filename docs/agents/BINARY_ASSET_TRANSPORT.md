# Numberdroid — Binary Asset Transport Contract

Status: **binding repository transport rule for binary files**

This document owns the safe transport of binary repository assets such as PNG, WEBP, JPG, ZIP, audio and other non-text files.

Its purpose is to prevent large Base64 payloads from being serialized through ChatGPT/tool arguments, which can consume large context, make turns appear to hang, and destabilize long-running agent workflows.

## 1. Core rule

**Do not use large inline Base64 payloads as a substitute for real file transport.**

Before any binary write, determine the raw file size.

```text
raw binary <= 16 KiB
→ connector Base64 may be used only if no direct file parameter exists and the operation is otherwise appropriate

raw binary > 16 KiB
→ inline Base64 in a ChatGPT/tool payload is PROHIBITED

raw size unknown
→ treat as >16 KiB until measured
```

The 16 KiB ceiling is a safety ceiling, not a target. Prefer real file transport even below it when available.

Base64 expands binary data by roughly one third before JSON/tool framing, and the encoded text also consumes model/tool context. A file that is ordinary as a PNG can therefore become an unnecessarily large conversational payload.

## 2. Preferred transport hierarchy

Use this order:

### A. Connector action with a real file/path parameter

If a connector action explicitly accepts a mounted/local file path or connector file reference, use that. Do not manually Base64-encode the file.

### B. Authenticated local checkout + Git push

For larger binary assets, use an existing authenticated local repository checkout when the environment provides one:

1. verify the checkout/repository/branch;
2. verify Git/`gh` authentication when needed;
3. copy/create the binary at its intended repository path;
4. `git add` the explicit binary path;
5. commit;
6. push the focused branch;
7. return to the GitHub connector for PR metadata/review/CI work.

This is a **binary transport path**, not a fallback diagnostic for determining whether the GitHub connector is connected.

### C. No safe transport available

If neither a direct connector file action nor an authenticated local checkout is available, stop the binary write and report:

```text
BINARY_TRANSPORT_BLOCKED
```

Continue any independent text/code/metadata work that does not falsely imply the binary was committed.

Do not work around the block by:

- pasting a large Base64 string into `create_blob` or another tool argument;
- embedding the binary as a data URI;
- wrapping raster data inside SVG/HTML/JS source;
- splitting a large Base64 payload across several tool calls;
- repeatedly retrying an oversized payload.

## 3. Mandatory preflight

Before a binary repository write, record internally:

```text
LOCAL/MOUNTED PATH
RAW BYTE SIZE
TARGET REPOSITORY PATH
AVAILABLE TRANSPORT
INLINE BASE64 AUTHORIZED? yes/no
```

If raw size is greater than 16,384 bytes, `INLINE BASE64 AUTHORIZED` must be `no`.

Do this before constructing a tool payload. Never discover the payload is too large only after serializing it.

## 4. State discipline

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

A Git blob SHA is not sufficient unless a reachable branch/commit references the blob at the intended repository path.

Do not update art status to `RUNTIME_REGISTERED` until the actual binary file is reachable on the working branch and the runtime registry points to it.

## 5. Current ChatGPT/GitHub environment rule

The GitHub connector is preferred for structured repository reads/writes, PRs and CI metadata.

However, connector-first does **not** mean “serialize any binary through JSON/Base64.” If the exposed connector lacks a direct binary-file parameter, apply this contract.

Local Git/`gh` may be used for the specific large-binary transport gap only when an authenticated local checkout actually exists. Do not infer repository availability from local network state and do not perform speculative clone/network diagnostics merely because the connector exists.

## 6. Failure learned during TS-01 Transfer Apparatus production

During Transfer Apparatus production, a grounding-shadow PNG was encoded into a very large Base64 `create_blob` payload. The call massively expanded the assistant/tool turn and appeared to hang.

Root causes:

1. binary transport was treated like an ordinary structured connector write;
2. raw file size / encoded payload size was not gated before constructing the tool call;
3. the repository workflow previously forced all remote writes through the connector without defining a binary exception;
4. the environment did not have an authenticated local `gh`/checkout path, but this prerequisite was checked only after the oversized payload attempt.

Binding correction:

> **Measure first. Never inline Base64 above 16 KiB. Use real file transport when available; otherwise stop with `BINARY_TRANSPORT_BLOCKED`.**
