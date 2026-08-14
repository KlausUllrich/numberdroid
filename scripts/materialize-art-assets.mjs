import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const assets = [
  {
    name: "Transfer Hall Architecture",
    sourceDir: join(root, "art-source/runtime"),
    prefix: "transfer-hall-architecture.b64.",
    output: join(root, "public/assets/deck/transfer-hall-architecture.png"),
    expectedChunks: 6,
    expectedBytes: 19483,
    expectedSha256: "a9e2c96dd5a17e29f082aa2f9441c5dc0a7a69a7cc787c79ac39b040dea58ce9",
  },
];

for (const asset of assets) {
  const files = readdirSync(asset.sourceDir)
    .filter((file) => file.startsWith(asset.prefix))
    .sort();

  if (files.length !== asset.expectedChunks) {
    throw new Error(`${asset.name}: expected ${asset.expectedChunks} source chunks, found ${files.length}`);
  }

  const encoded = files
    .map((file) => readFileSync(join(asset.sourceDir, file), "utf8").trim())
    .join("");
  const bytes = Buffer.from(encoded, "base64");

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${asset.name}: decoded payload is not a PNG`);
  }
  if (bytes.length !== asset.expectedBytes) {
    throw new Error(`${asset.name}: expected ${asset.expectedBytes} bytes, decoded ${bytes.length}`);
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.expectedSha256) {
    throw new Error(`${asset.name}: SHA-256 mismatch (${digest})`);
  }

  mkdirSync(dirname(asset.output), { recursive: true });
  writeFileSync(asset.output, bytes);
  console.log(`${asset.name}: materialized ${bytes.length} bytes (${digest.slice(0, 12)}…)`);
}
