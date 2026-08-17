#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildApprovedSourceUploadHandoff, gitBlobSha1, sha256 } from "./approved-source-upload-handoff.mjs";

const bytes = Buffer.from("hello\n", "utf8");
assert.equal(sha256(bytes), "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03");
assert.equal(gitBlobSha1(bytes), "ce013625030ba8dba906f756967f9e9ca394464a");

const handoff = buildApprovedSourceUploadHandoff({
  bytes,
  file: "/tmp/example__approved-original__2026-08-17.png",
  targetPath: "art-source/approved/area-01-transfer-ship/example/source/example__approved-original__2026-08-17.png",
  branch: "agent/example",
});

assert.equal(handoff.status, "USER_UPLOAD_REQUIRED");
assert.equal(handoff.rawBytes, 6);
assert.equal(handoff.filename, "example__approved-original__2026-08-17.png");
assert.equal(handoff.targetFolder, "art-source/approved/area-01-transfer-ship/example/source");
assert.equal(handoff.gitBlobSha1, "ce013625030ba8dba906f756967f9e9ca394464a");

assert.throws(() => buildApprovedSourceUploadHandoff({
  bytes,
  file: "/tmp/wrong-name.png",
  targetPath: "art-source/approved/area-01-transfer-ship/example/source/right-name.png",
  branch: "agent/example",
}), /filename must exactly match/);

assert.throws(() => buildApprovedSourceUploadHandoff({
  bytes,
  file: "/tmp/example.png",
  targetPath: "public/assets/example.png",
  branch: "agent/example",
}), /art-source\/approved/);

console.log("approved source upload handoff self-test: PASS");
