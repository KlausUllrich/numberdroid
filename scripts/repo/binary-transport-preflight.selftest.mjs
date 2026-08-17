import assert from "node:assert/strict";
import {
  INLINE_BASE64_LIMIT_BYTES,
  base64EncodedSize,
  classifyBinaryTransport,
} from "./binary-transport-preflight.mjs";

assert.equal(INLINE_BASE64_LIMIT_BYTES, 0);
assert.equal(base64EncodedSize(0), 0);
assert.equal(base64EncodedSize(1), 4);
assert.equal(base64EncodedSize(3), 4);
assert.equal(base64EncodedSize(4), 8);

for (const rawBytes of [0, 1, 8_298, 16_384, 25_174, 102_990]) {
  const classification = classifyBinaryTransport(rawBytes);
  assert.equal(classification.inlineBase64Allowed, false);
  assert.equal(
    classification.recommendedTransport,
    "real-file-transport-required-or-BINARY_TRANSPORT_BLOCKED",
  );
}

const shadow = classifyBinaryTransport(8_298);
assert.equal(shadow.base64Bytes, 11_064);
assert.equal(shadow.base64ExpansionBytes, 2_766);

const apparatus = classifyBinaryTransport(102_990);
assert.equal(apparatus.base64Bytes, 137_320);
assert.equal(apparatus.base64ExpansionBytes, 34_330);

console.log("binary transport preflight self-test: PASS — inline repository Base64 always prohibited");
