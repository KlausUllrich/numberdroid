# Numberdroid — Binding Remote Repository Workflow

This file is a **hard technical rule for OpenAI/ChatGPT agents working on this repository through a connected GitHub session**.

Companion binary transport authority:

- `docs/agents/BINARY_ASSET_TRANSPORT.md`

## GitHub transport rule

For structured/textual remote repository operations, use the **GitHub connector directly**:

- read repository files through GitHub;
- create/update/delete text repository files through GitHub;
- create branches through GitHub;
- inspect commits and diffs through GitHub;
- create and merge pull requests through GitHub;
- inspect GitHub Actions through GitHub.

### Binary assets are a special transport case

Connector-first does **not** mean “serialize arbitrary binary files as Base64 inside a tool payload.”

For PNG/WEBP/JPG/ZIP/audio/other binary assets, follow `BINARY_ASSET_TRANSPORT.md` before constructing any write call.

Hard binary rule:

```text
repository binary write
→ inline Base64 through the model/tool text channel is prohibited
```

There is no byte-size exception. `BINARY_ASSET_TRANSPORT.md` is authoritative and supersedes older size-threshold guidance.

Before any binary publication attempt, run the executable preflight:

```bash
npm run repo:binary-preflight -- <local-or-mounted-file>
```

For any path that would require assistant-constructed inline Base64, assertion mode must reject it:

```bash
npm run repo:binary-preflight -- --require-inline <file>
```

Preferred order:

1. connector action with a real file/path parameter, if explicitly supported;
2. existing authenticated local checkout + focused Git commit/push for the binary transport gap;
3. otherwise stop the binary write as `BINARY_TRANSPORT_BLOCKED`.

Do not replace missing file transport with `create_blob(base64)` payloads, data URIs, SVG wrapping, chunked Base64 calls, CI reconstruction tricks or repeated quantization intended only to squeeze binary data through the agent text channel.

A local Git/`gh` path may be used **only for this concrete binary transport gap when an authenticated checkout already exists**. This is not permission to use local network diagnostics as a substitute for the connector or to infer GitHub availability from container networking.

## Connector discovery / recovery protocol

The GitHub connector may be connected even when GitHub actions are **not currently surfaced in the active tool schema**. Missing visible GitHub functions are therefore **not evidence that GitHub is disconnected**.

Before ever telling the user that GitHub/repository access is unavailable:

1. Rediscover GitHub capabilities through the connector resource discovery mechanism (`api_tool.list_resources`) using `paths=["GitHub"]` and a short capability keyword such as `repo`, `fetch_file`, `branch`, `pull`, `workflow`, or `merge`.
2. Invoke a real connector read, preferably repository metadata (`GitHub.get_repo`) for `KlausUllrich/numberdroid`.
3. Treat a successful connector response as proof that repository access is available, regardless of container/network state or whether GitHub tools were visible before discovery.
4. If the required action schema is not loaded, rediscover that action by keyword and then invoke it. Do not stop merely because the action was not initially exposed.
5. Only report GitHub as unavailable after an **actual GitHub connector call** fails in a way that establishes connection/permission failure. Report that connector error explicitly.

Repeat this discovery step after a tool/context boundary when necessary (for example after image generation, a long turn, a browser/session transition, or whenever previously available GitHub actions no longer appear surfaced).

This protocol is mandatory even if the agent is highly confident that the connector is unavailable.

### Forbidden diagnostic/network fallback

Do **not** use the local/container network as a fallback transport or diagnostic for ordinary GitHub access. In particular, do not try speculative:

- `git clone` against GitHub;
- `git pull`/`git fetch` against GitHub;
- `curl`/`wget` against GitHub;
- container network diagnostics to decide whether GitHub is available.

A container/sandbox network failure says nothing about the availability of the GitHub connector. **Never infer “GitHub is unavailable” from a failed container-network command.**

The only narrow local-Git exception is the already-authenticated **binary publish path** defined in `BINARY_ASSET_TRANSPORT.md`. Its prerequisites must be verified before use; if they are absent, report `BINARY_TRANSPORT_BLOCKED` rather than cloning or forcing a Base64 workaround.

If the GitHub connector itself fails, report that connector failure explicitly and stop/retry through the connector for connector-owned operations. Do not silently switch transport paths.

Local/container tools may still be used for **offline computation or asset generation** when useful. Repository publication must follow either the connector path or the explicit binary transport contract.

## Why this is binding

During the Transfer Hall art passes, several transport failures occurred:

1. the container-network fallback was mistakenly attempted and its DNS/network failure was incorrectly interpreted as missing GitHub access;
2. later, GitHub actions were not currently surfaced in the active tool schema and that absence was again incorrectly interpreted as missing access instead of rediscovering the connected GitHub connector;
3. during Transfer Apparatus production, generated PNG assets were repeatedly serialized into Base64 GitHub tool payloads. A large payload succeeded once, but later even a much smaller shadow payload contributed to a bloated/slow turn that appeared to hang.

The connector discovery protocol prevents false “repository unavailable” conclusions. The binary transport contract prevents the opposite failure mode: forcing opaque file bytes through the language-model text path merely because an API technically accepts Base64.
