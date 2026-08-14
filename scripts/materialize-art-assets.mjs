import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const assets = [
  {
    name: "Transfer Hall Architecture 16px fascia",
    sourceDir: join(root, "art-source/runtime"),
    prefix: "transfer-hall-architecture-16px.b64.",
    output: join(root, "public/assets/deck/transfer-hall-architecture.png"),
    expectedChunks: 2,
    expectedBytes: 3660,
    expectedWidth: 256,
    expectedHeight: 256,
    expectedSha256: "b44c324cd2b5820e76ab9765c7735ff0f227a86f5eaf2329a655e0cbc9004df9",
  },
  {
    name: "PICO eight-direction Gold Slice strip",
    sourceDir: join(root, "art-source/runtime"),
    prefix: "directional-pico-gold.b64.",
    output: join(root, "public/assets/robots/directional-pico.png"),
    expectedChunks: 4,
    expectedBytes: 14617,
    expectedWidth: 768,
    expectedHeight: 96,
    expectedSha256: "cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9",
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
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${asset.name}: decoded payload is not a PNG`);
  }
  if (bytes.length !== asset.expectedBytes) {
    throw new Error(`${asset.name}: expected ${asset.expectedBytes} bytes, decoded ${bytes.length}`);
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== asset.expectedWidth || height !== asset.expectedHeight) {
    throw new Error(`${asset.name}: expected ${asset.expectedWidth}x${asset.expectedHeight}, got ${width}x${height}`);
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.expectedSha256) {
    throw new Error(`${asset.name}: SHA-256 mismatch (${digest})`);
  }

  mkdirSync(dirname(asset.output), { recursive: true });
  writeFileSync(asset.output, bytes);
  console.log(`${asset.name}: materialized ${width}x${height}, ${bytes.length} bytes (${digest.slice(0, 12)}…)`);
}
