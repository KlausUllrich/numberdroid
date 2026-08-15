import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const picoSourceDir = join(root, "art-source/recipes/transfer-hall/robots/pico/source");
const familyPropsSourceDir = join(root, "art-source/recipes/transfer-hall/family-props/source");

function readTextSafePng({ name, directory, prefix, expectedChunks, expectedBytes, expectedSha256, expectedWidth, expectedHeight }) {
  const files = readdirSync(directory).filter((file) => file.startsWith(prefix)).sort();
  if (files.length !== expectedChunks) throw new Error(`${name}: expected ${expectedChunks} source chunks, found ${files.length}`);

  const bytes = Buffer.from(files.map((file) => readFileSync(join(directory, file), "utf8").trim()).join(""), "base64");
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) throw new Error(`${name}: source is not PNG`);
  if (bytes.length !== expectedBytes) throw new Error(`${name}: expected ${expectedBytes} bytes, decoded ${bytes.length}`);

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expectedSha256) throw new Error(`${name}: source SHA-256 mismatch (${digest})`);

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${name}: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
  }

  return bytes;
}

const pico = readTextSafePng({
  name: "PICO eight-direction Gold Slice strip",
  directory: picoSourceDir,
  prefix: "directional-pico-gold.b64.",
  expectedChunks: 4,
  expectedBytes: 14617,
  expectedSha256: "cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9",
  expectedWidth: 768,
  expectedHeight: 96,
});

const familyTable = readTextSafePng({
  name: "TS-01 Family Table / Waiting Module",
  directory: familyPropsSourceDir,
  prefix: "family-table-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 9460,
  expectedSha256: "1eb0253d60df639678def53c4e25afd5fb52cac9a428d7098225729f41a3bfa3",
  expectedWidth: 192,
  expectedHeight: 128,
});

const robotOutputDir = join(root, "public/assets/robots");
mkdirSync(robotOutputDir, { recursive: true });
writeFileSync(join(robotOutputDir, "directional-pico.png"), pico);
console.log("PICO: materialized validated 768x96 eight-direction strip from recipe-local source");

const deckOutputDir = join(root, "public/assets/deck");
mkdirSync(deckOutputDir, { recursive: true });
writeFileSync(join(deckOutputDir, "family-table-props.png"), familyTable);
console.log("Family Table: materialized validated 192x128 3x2 prop sheet from recipe-local source");
