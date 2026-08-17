#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export const INLINE_BASE64_LIMIT_BYTES = 16 * 1024;

export function base64EncodedSize(rawBytes) {
  return 4 * Math.ceil(rawBytes / 3);
}

export function classifyBinaryTransport(rawBytes) {
  const encodedBytes = base64EncodedSize(rawBytes);
  const inlineBase64Allowed = rawBytes <= INLINE_BASE64_LIMIT_BYTES;

  return {
    rawBytes,
    base64Bytes: encodedBytes,
    base64ExpansionBytes: encodedBytes - rawBytes,
    inlineBase64LimitBytes: INLINE_BASE64_LIMIT_BYTES,
    inlineBase64Allowed,
    recommendedTransport: inlineBase64Allowed
      ? "prefer-file-transport; connector-inline-base64-allowed-as-last-resort"
      : "real-file-transport-required-or-BINARY_TRANSPORT_BLOCKED",
  };
}

async function main() {
  const args = process.argv.slice(2);
  const requireInlineIndex = args.indexOf("--require-inline");
  const requireInline = requireInlineIndex !== -1;
  if (requireInline) args.splice(requireInlineIndex, 1);

  if (args.length !== 1) {
    console.error("Usage: node scripts/repo/binary-transport-preflight.mjs [--require-inline] <file>");
    process.exit(64);
  }

  const file = resolve(args[0]);
  let fileStat;
  try {
    fileStat = await stat(file);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: "BINARY_PREFLIGHT_FILE_ERROR",
      file,
      message: error instanceof Error ? error.message : String(error),
    }));
    process.exit(66);
  }

  if (!fileStat.isFile()) {
    console.error(JSON.stringify({
      ok: false,
      code: "BINARY_PREFLIGHT_NOT_A_FILE",
      file,
    }));
    process.exit(66);
  }

  const classification = classifyBinaryTransport(fileStat.size);
  const result = {
    ok: true,
    file,
    ...classification,
  };

  console.log(JSON.stringify(result, null, 2));

  if (requireInline && !classification.inlineBase64Allowed) {
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
