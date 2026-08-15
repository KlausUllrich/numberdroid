import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMask, encodeRgbaPng, renderMaskedMaterial } from "./art/toolkit/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "public/assets/deck");
mkdirSync(outputDir, { recursive: true });

function graphiteSampler(base, x, y) {
  const micro = ((x * 17 + y * 31 + (x ^ y) * 7) % 9) - 4;
  const broad = Math.round(Math.sin((x + y) * 0.19) * 2 + Math.sin(y * 0.11) * 2);
  const value = Math.max(0, Math.min(255, base + micro + broad));
  return [Math.round(value * 0.94), value, Math.min(255, value + 3)];
}

const LEAF_WIDTH = 5;
const LEAF_HEIGHT = 64;
const leafMask = createMask(LEAF_WIDTH, LEAF_HEIGHT, () => true);
const leaf = renderMaskedMaterial({
  width: LEAF_WIDTH,
  height: LEAF_HEIGHT,
  mask: leafMask,
  connectors: [
    { side: "T", start: 0, end: LEAF_WIDTH },
    { side: "B", start: 0, end: LEAF_WIDTH },
  ],
  materialSampler: (x, y) => graphiteSampler(48, x, y),
  outerDarkPx: 2,
  outerDarkStrength: 0.30,
  innerHighlightCenterPx: 2,
  innerHighlightWidthPx: 0.75,
  innerHighlightStrength: 0.025,
});
writeFileSync(
  join(outputDir, "transfer-hall-door-leaf.png"),
  encodeRgbaPng({ width: LEAF_WIDTH, height: LEAF_HEIGHT, rgba: leaf.rgba }),
);

const POCKET_WIDTH = 18;
const POCKET_HEIGHT = 10;
const pocketMask = createMask(POCKET_WIDTH, POCKET_HEIGHT, (x, y) => {
  const chamferedCorner = (x === 0 || x === POCKET_WIDTH - 1) && (y === 0 || y === POCKET_HEIGHT - 1);
  return !chamferedCorner;
});
const pocket = renderMaskedMaterial({
  width: POCKET_WIDTH,
  height: POCKET_HEIGHT,
  mask: pocketMask,
  materialSampler: (x, y) => graphiteSampler(62, x + 11, y + 23),
  outerDarkPx: 3,
  outerDarkStrength: 0.26,
  innerHighlightCenterPx: 2,
  innerHighlightWidthPx: 0.9,
  innerHighlightStrength: 0.018,
});
writeFileSync(
  join(outputDir, "transfer-hall-door-pocket.png"),
  encodeRgbaPng({ width: POCKET_WIDTH, height: POCKET_HEIGHT, rgba: pocket.rgba }),
);

console.log(`Transfer Hall Door M4: darker leaf=${LEAF_WIDTH}x${LEAF_HEIGHT}, pocket=${POCKET_WIDTH}x${POCKET_HEIGHT}, clean-aperture runtime skin`);
