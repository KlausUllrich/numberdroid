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

const familyTableShadow = readTextSafePng({
  name: "TS-01 Family Table grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "family-table-shadow-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 3699,
  expectedSha256: "c4cce1f8daebba9d3f96b5f0e064513c7eac874ffedc6ffe00cdba4941398d81",
  expectedWidth: 192,
  expectedHeight: 128,
});

const familyMemoryConsole = readTextSafePng({
  name: "TS-01 Family Memory Console",
  directory: familyPropsSourceDir,
  prefix: "family-memory-console-runtime.b64.",
  expectedChunks: 4,
  expectedBytes: 3892,
  expectedSha256: "7b3546264f6007884f395383b6db4cd25cdf1c67db45c325cf9026d298eefd5c",
  expectedWidth: 128,
  expectedHeight: 64,
});

const familyMemoryConsoleShadow = readTextSafePng({
  name: "TS-01 Family Memory Console grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "family-memory-console-shadow-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 915,
  expectedSha256: "78c73c3e5e582a190aaa048a812c620963102a676d926e44ed864da757c86a06",
  expectedWidth: 128,
  expectedHeight: 64,
});

const familyCoffeeMachine = readTextSafePng({
  name: "TS-01 Family Coffee Machine",
  directory: familyPropsSourceDir,
  prefix: "coffee-machine-runtime.b64.",
  expectedChunks: 4,
  expectedBytes: 6901,
  expectedSha256: "3d1d960b3aaa4a3549a43fb0dc9363a0d148f3f11ef90c5318593313cce7be4d",
  expectedWidth: 64,
  expectedHeight: 128,
});

const familyCoffeeMachineShadow = readTextSafePng({
  name: "TS-01 Family Coffee Machine grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "coffee-machine-shadow-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 1964,
  expectedSha256: "d37a914b2ba711eaaf46127d9cc73364b436931f3a63475668c7624935df5aaf",
  expectedWidth: 64,
  expectedHeight: 128,
});

const familyPlanterTrough = readTextSafePng({
  name: "TS-01 Family Planter Trough",
  directory: familyPropsSourceDir,
  prefix: "planter-trough-runtime.b64.",
  expectedChunks: 6,
  expectedBytes: 10825,
  expectedSha256: "0aacbd2921e0a02426be9bc7c90686f20a7911468e58b57fd6475176043a8c1e",
  expectedWidth: 64,
  expectedHeight: 128,
});

const familyPlanterTroughShadow = readTextSafePng({
  name: "TS-01 Family Planter Trough grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "planter-trough-shadow-runtime.b64.",
  expectedChunks: 2,
  expectedBytes: 2218,
  expectedSha256: "2daf5d771d3034d86b102c63e07c79adb13881ab4fc620c3b1e8b4f991755634",
  expectedWidth: 64,
  expectedHeight: 128,
});

const familyRoundPlant = readTextSafePng({
  name: "TS-01 Family Round Plant",
  directory: familyPropsSourceDir,
  prefix: "round-plant-runtime.b64.",
  expectedChunks: 4,
  expectedBytes: 7200,
  expectedSha256: "aeba57e8df23e23f55409a661098e929d4f0b89ee8ecaf0dbac8cbf484cc3f7a",
  expectedWidth: 64,
  expectedHeight: 64,
});

const familyRoundPlantShadow = readTextSafePng({
  name: "TS-01 Family Round Plant grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "round-plant-shadow-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 1617,
  expectedSha256: "a53f9db3d94ad34ed58b03b1652dadf16335ee2cd192e6cfaee0c2df37e1db15",
  expectedWidth: 64,
  expectedHeight: 64,
});

const familyHologramPedestal = readTextSafePng({
  name: "TS-01 Family Hologram Pedestal",
  directory: familyPropsSourceDir,
  prefix: "hologram-pedestal-runtime.b64.",
  expectedChunks: 7,
  expectedBytes: 7873,
  expectedSha256: "c31af1083ddeb469f0ff138189fb6d33f1378967e2e2635c7d047c02d5df5387",
  expectedWidth: 64,
  expectedHeight: 64,
});

const familyHologramPedestalShadow = readTextSafePng({
  name: "TS-01 Family Hologram Pedestal grounding shadow",
  directory: familyPropsSourceDir,
  prefix: "hologram-pedestal-shadow-runtime.b64.",
  expectedChunks: 1,
  expectedBytes: 1574,
  expectedSha256: "7e4b80e5ba332cffb8fa24c9f7e0092dd7dc2fc2c9d448b4d00bc4c8e4b52ec3",
  expectedWidth: 64,
  expectedHeight: 64,
});

const robotOutputDir = join(root, "public/assets/robots");
mkdirSync(robotOutputDir, { recursive: true });
writeFileSync(join(robotOutputDir, "directional-pico.png"), pico);
console.log("PICO: materialized validated 768x96 eight-direction strip from recipe-local source");

const deckOutputDir = join(root, "public/assets/deck");
mkdirSync(deckOutputDir, { recursive: true });
writeFileSync(join(deckOutputDir, "family-table-props.png"), familyTable);
console.log("Family Table: materialized validated 192x128 3x2 prop sheet from recipe-local source");
writeFileSync(join(deckOutputDir, "family-table-shadow.png"), familyTableShadow);
console.log("Family Table shadow: materialized validated 192x128 3x2 FloorFX sheet from recipe-local source");
writeFileSync(join(deckOutputDir, "family-memory-console.png"), familyMemoryConsole);
console.log("Family Memory Console: materialized validated 128x64 2x1 WallProps sheet from recipe-local source");
writeFileSync(join(deckOutputDir, "family-memory-console-shadow.png"), familyMemoryConsoleShadow);
console.log("Family Memory Console shadow: materialized validated 128x64 2x1 FloorFX sheet from recipe-local source");
writeFileSync(join(deckOutputDir, "family-coffee-machine.png"), familyCoffeeMachine);
writeFileSync(join(deckOutputDir, "family-coffee-machine-shadow.png"), familyCoffeeMachineShadow);
writeFileSync(join(deckOutputDir, "family-planter-trough.png"), familyPlanterTrough);
writeFileSync(join(deckOutputDir, "family-planter-trough-shadow.png"), familyPlanterTroughShadow);
writeFileSync(join(deckOutputDir, "family-round-plant.png"), familyRoundPlant);
writeFileSync(join(deckOutputDir, "family-round-plant-shadow.png"), familyRoundPlantShadow);
writeFileSync(join(deckOutputDir, "family-hologram-pedestal.png"), familyHologramPedestal);
writeFileSync(join(deckOutputDir, "family-hologram-pedestal-shadow.png"), familyHologramPedestalShadow);
console.log("Family Props Batch 2: materialized validated Coffee Machine, Planter Trough, Round Plant, Hologram Pedestal and four FloorFX shadows");
