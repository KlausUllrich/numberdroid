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

During the Transfer Hall art passes, the container-network fallback was mistakenly attempted multiple times and was incorrectly interpreted as missing GitHub access. This caused unnecessary handoff prompts and interrupted implementation. That failure mode must not be repeated.
