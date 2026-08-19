import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeDirectionalActorPngRgba, sanitizeDirectionalActorStrip } from "./art/toolkit/directional-actor-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ACTORS = [
  {
    id: "pico",
    path: join(root, "public/assets/robots/directional-pico.png"),
    frameSize: 96,
  },
];

for (const actor of ACTORS) {
  const decoded = decodeDirectionalActorPngRgba(readFileSync(actor.path));
  const sanitized = sanitizeDirectionalActorStrip({
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    frameSize: actor.frameSize,
  });
  const surviving = sanitized.after.frames.flatMap((frame) => frame.detachedBelow);
  if (surviving.length) throw new Error(`${actor.id}: detached structural fragments survived runtime sanitation.`);

  writeFileSync(actor.path, encodeRgbaPng({ width: decoded.width, height: decoded.height, rgba: sanitized.rgba }));
  const removedPixels = sanitized.removed.reduce((sum, entry) => sum + entry.visiblePixelsRemoved, 0);
  console.log(`${actor.id}: actor runtime sanitation removed ${removedPixels} detached visible pixels across ${sanitized.removed.length} frame(s)`);
}
