# Numberdroid — Manual Approved Source Upload Handoff

Status: **binding user-handoff contract when an approved binary source cannot be published automatically**

This document defines the exact interaction between the Artist agent and Klaus when an approved high-resolution source must be uploaded to GitHub manually.

It supplements `APPROVED_SOURCE_ARCHIVE.md` and `docs/agents/BINARY_ASSET_TRANSPORT.md`. It does not weaken the rule that repository binaries must never be pushed through the model/tool text channel as inline Base64.

---

## 1. When this handoff is required

Use this handoff when all of the following are true:

1. a visual source has been explicitly approved;
2. the approved original must be preserved under `art-source/approved/...`;
3. no safe real-file connector upload exists;
4. no already-authenticated local repository checkout is available for normal Git binary transport.

The workflow state becomes:

```text
SOURCE_APPROVED
→ ARCHIVE_PENDING
→ USER_UPLOAD_REQUIRED
```

Do **not** proceed to destructive Crop/Fit/downscale production while this gate is open unless Klaus explicitly changes the preservation policy.

---

## 2. Agent responsibilities before asking Klaus to upload

The Agent prepares the upload completely. Klaus should not need to decide naming, Campaign Area, Asset Family, target path or branch.

Before presenting the handoff, the Agent must:

1. determine the canonical Campaign Area;
2. determine/create the Asset Family;
3. determine the exact archive filename;
4. ensure the family manifest and target folder exist on a focused working branch;
5. preserve a local/mounted copy of the approved original **byte-identically** under the exact archive filename;
6. calculate:
   - raw byte size;
   - SHA-256;
   - Git blob SHA-1 (`sha1("blob " + size + "\\0" + bytes)`);
   - dimensions/format when applicable;
7. provide Klaus a direct downloadable conversation/sandbox file when the runtime allows it;
8. provide the exact GitHub branch and target folder.

Do not re-encode, resize, crop or recompress the file merely to prepare the handoff.

---

## 3. Mandatory user-facing handoff block

Whenever `USER_UPLOAD_REQUIRED` is entered, the Agent must present a compact block containing **all** of the following:

```text
MANUAL APPROVED-SOURCE UPLOAD REQUIRED

Download file:  <clickable download/file link>
Filename:       <exact filename>
GitHub branch:  <exact branch>
Target folder:  <exact repository folder>
Target path:    <exact full repository path>
Size:           <raw bytes + friendly size>
SHA-256:        <sha256>
Git blob SHA-1: <git blob sha1>

GitHub steps:
1. Open the repository and switch to the branch above.
2. Open the target folder.
3. Add file → Upload files; select the downloaded file without renaming/editing it.
4. Commit the upload to that branch.

Then reply only: `hochgeladen`
```

The Agent may add one short note if a platform-specific GitHub UI label differs, but must not turn the handoff into a long tutorial.

If a clickable downloadable file cannot be exposed, state that explicitly and provide the exact local/conversation file reference available to the user. Do not pretend the handoff is complete if the user cannot obtain the file.

---

## 4. `hochgeladen` — verification trigger

When Klaus replies `hochgeladen` in the active archive handoff, the Agent must verify the upload before continuing.

Verification should avoid downloading/re-serializing the binary through the model.

Preferred verification:

1. list/fetch GitHub metadata for the exact target path or parent directory;
2. confirm exact filename;
3. confirm raw byte size;
4. confirm GitHub blob SHA equals the expected **Git blob SHA-1** calculated before the upload.

Matching byte size + Git blob SHA proves the uploaded Git object is byte-identical to the prepared original without moving the binary through the agent text channel.

If the hash/size does not match:

```text
USER_UPLOAD_VERIFICATION_FAILED
```

Report the mismatch and do not mark the source archived.

If verification passes:

```text
USER_UPLOAD_VERIFIED
→ APPROVED_SOURCE_ARCHIVED
→ PRODUCTION EXTRACTION / NORMALIZATION
```

Update the Asset Family manifest from `ARCHIVE_PENDING` to the verified archive state before continuing.

---

## 5. Branch rule

The Agent chooses and communicates the upload branch.

Default behavior:

- if a focused current asset/production branch already exists, use it;
- otherwise create a focused archive/asset branch before asking Klaus to upload;
- do not ask Klaus to invent a branch name;
- do not default to a direct `main` upload when a focused branch is practical.

If Klaus uploads to a different branch/path accidentally, locate and verify the file first, then repair/normalize repository state through the normal GitHub workflow rather than asking for unnecessary repeated uploads.

---

## 6. Asset Family rule

One manual upload may preserve one component inside a larger Asset Family.

Example:

```text
area-01-transfer-ship/
└─ transfer-system/
   ├─ source/
   │  └─ transfer-apparatus__approved-original__2026-08-17.png
   ├─ fx/
   │  └─ yellow-core__approved-original__<date>.png
   └─ animation/
```

The Transfer Apparatus and yellow Core belong to the same `transfer-system` Asset Family even though they may be approved/uploaded at different times.

Each approved original gets its own upload handoff and verification record.

---

## 7. State discipline

Keep these states distinct:

```text
SOURCE_APPROVED
ARCHIVE_PENDING
USER_UPLOAD_REQUIRED
USER_UPLOAD_VERIFIED
APPROVED_SOURCE_ARCHIVED
PRODUCTION_BUILT
RUNTIME_INTEGRATED
```

A download link provided to Klaus is not archive completion.
A user statement `hochgeladen` is not archive completion until verification passes.
Only the verified repository binary closes the archive gate.
