# Numberdroid — Binding Remote Repository Workflow

This file is a **hard technical rule for OpenAI/ChatGPT agents working on this repository through a connected GitHub session**.

## GitHub transport rule

All remote repository operations must use the **GitHub connector directly**:

- read repository files through GitHub;
- create/update/delete repository files through GitHub;
- create branches through GitHub;
- inspect commits and diffs through GitHub;
- create and merge pull requests through GitHub;
- inspect GitHub Actions through GitHub.

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

### Forbidden fallback

Do **not** use the local/container network as a fallback transport for GitHub. In particular, do not try:

- `git clone` against GitHub;
- `git pull`/`git fetch` against GitHub;
- `curl`/`wget` against GitHub;
- container network diagnostics to decide whether GitHub is available.

A container/sandbox network failure says nothing about the availability of the GitHub connector. **Never infer “GitHub is unavailable” from a failed container-network command.**

If the GitHub connector itself fails, report that connector failure explicitly and stop/retry through the connector. Do not silently switch transport paths.

Local/container tools may still be used for **offline computation or asset generation** when useful. Upload/download of repository state must still go through the GitHub connector in a connected remote-repo session.

## Why this is binding

During the Transfer Hall art passes, this failure occurred in two related forms:

1. the container-network fallback was mistakenly attempted and its DNS/network failure was incorrectly interpreted as missing GitHub access;
2. later, GitHub actions were not currently surfaced in the active tool schema and that absence was again incorrectly interpreted as missing access instead of rediscovering the connected GitHub connector.

Both caused false “I cannot access the repository” messages and unnecessary interruptions even though the GitHub connector remained connected with repository permissions. The discovery/recovery protocol above exists specifically to prevent that recurrence.
