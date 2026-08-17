import assert from "node:assert/strict";
import {
  INLINE_BASE64_LIMIT_BYTES,
  base64EncodedSize,
  classifyBinaryTransport,
} from "./binary-transport-preflight.mjs";

assert.equal(INLINE_BASE64_LIMIT_BYTES, 16 * 1024);
assert.equal(base64EncodedSize(0), 0);
assert.equal(base64EncodedSize(1), 4);
assert.equal(base64EncodedSize(3), 4);
assert.equal(base64EncodedSize(4), 8);

const atLimit = classifyBinaryTransport(INLINE_BASE64_LIMIT_BYTES);
assert.equal(atLimit.inlineBase64Allowed, true);
assert.equal(
  atLimit.recommendedTransport,
  "prefer-file-transport; connector-inline-base64-allowed-as-last-resort",
);

const overLimit = classifyBinaryTransport(INLINE_BASE64_LIMIT_BYTES + 1);
assert.equal(overLimit.inlineBase64Allowed, false);
assert.equal(
  overLimit.recommendedTransport,
  "real-file-transport-required-or-BINARY_TRANSPORT_BLOCKED",
);

const apparatus = classifyBinaryTransport(102_990);
assert.equal(apparatus.inlineBase64Allowed, false);
assert.equal(apparatus.base64Bytes, 137_320);
assert.equal(apparatus.base64ExpansionBytes, 34_330);

console.log("binary transport preflight self-test: PASS");
