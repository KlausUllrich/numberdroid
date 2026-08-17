#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { resolve } from "node:path";

// Kept as a report/compatibility field. Repository binary Base64 is now
// categorically prohibited, so the effective byte ceiling is zero and the
// authorization predicate below never permits the inline path.
export const INLINE_BASE64_LIMIT_BYTES = 0;

export function base64EncodedSize(rawBytes) {
  return 4 * Math.ceil(rawBytes / 3);
}

export function classifyBinaryTransport(rawBytes) {
  const encodedBytes = base64EncodedSize(rawBytes);
  const inlineBase64Allowed = false;

  return {
    rawBytes,
    base64Bytes: encodedBytes,
    base64ExpansionBytes: encodedBytes - rawBytes,
    inlineBase64LimitBytes: INLINE_BASE64_LIMIT_BYTES,
    inlineBase64Allowed,
    recommendedTransport: "real-file-transport-required-or-BINARY_TRANSPORT_BLOCKED",
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
    policy: "INLINE_REPOSITORY_BINARY_BASE64_PROHIBITED",
    ...classification,
  };

  console.log(JSON.stringify(result, null, 2));

  // Assertion mode exists specifically to make accidental Base64 construction
  // fail before the caller reads/encodes the binary. Under the current policy
  // it therefore always rejects repository-binary inline transport.
  if (requireInline) {
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
