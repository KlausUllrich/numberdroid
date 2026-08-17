#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildApprovedSourceUploadHandoff({ bytes, file, targetPath, branch }) {
  if (!targetPath.startsWith("art-source/approved/")) {
    throw new Error("Approved source target must live under art-source/approved/");
  }
  if (basename(file) !== basename(targetPath)) {
    throw new Error("Local prepared filename must exactly match the target archive filename");
  }
  if (!branch?.trim()) {
    throw new Error("A focused GitHub branch is required for the manual upload handoff");
  }

  return {
    ok: true,
    status: "USER_UPLOAD_REQUIRED",
    file: resolve(file),
    filename: basename(file),
    branch,
    targetFolder: dirname(targetPath),
    targetPath,
    rawBytes: bytes.length,
    sha256: sha256(bytes),
    gitBlobSha1: gitBlobSha1(bytes),
  };
}

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    values.set(arg, value);
    i += 1;
  }
  return {
    file: values.get("--file"),
    targetPath: values.get("--target"),
    branch: values.get("--branch"),
  };
}

async function main() {
  try {
    const { file, targetPath, branch } = parseArgs(process.argv.slice(2));
    if (!file || !targetPath || !branch) {
      console.error("Usage: node scripts/repo/approved-source-upload-handoff.mjs --file <local-file> --target <art-source/approved/.../filename> --branch <branch>");
      process.exit(64);
    }
    const bytes = await readFile(resolve(file));
    const result = buildApprovedSourceUploadHandoff({ bytes, file, targetPath, branch });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: "APPROVED_SOURCE_UPLOAD_HANDOFF_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exit(65);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
