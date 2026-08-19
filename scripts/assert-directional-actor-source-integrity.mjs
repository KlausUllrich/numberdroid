import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeDirectionalActorStrip,
  decodeDirectionalActorPngRgba,
  nearestDistanceToMainStructural,
  sanitizeDirectionalActorStrip,
} from "./art/toolkit/directional-actor-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "art-source/recipes/transfer-hall/robots/pico/source");
const profilePath = join(root, "src/meta/characterGroundingProfiles.json");
const outDir = join(root, "artifacts/grounding");
const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const EXPECTED_SANITIZED_FOOT_Y = [86, 86, 87, 87, 89, 92, 92, 92];

function sourceBytes() {
  const files = readdirSync(sourceDir).filter((file) => file.startsWith("directional-pico-gold.b64.")).sort();
  if (files.length !== 4) throw new Error(`Expected 4 PICO source chunks, found ${files.length}.`);
  return Buffer.from(files.map((file) => readFileSync(join(sourceDir, file), "utf8").trim()).join(""), "base64");
}

const decoded = decodeDirectionalActorPngRgba(sourceBytes());
if (decoded.width !== 768 || decoded.height !== 96) throw new Error(`Unexpected PICO source size ${decoded.width}x${decoded.height}.`);

const raw = analyzeDirectionalActorStrip({ rgba: decoded.rgba, width: decoded.width, height: decoded.height, frameSize: 96 });
const rawDetached = raw.frames.flatMap((frame) => frame.detachedBelow.map((fragment) => ({ frameIndex: frame.frameIndex, ...fragment })));
if (rawDetached.length !== 1 || rawDetached[0].frameIndex !== 7) {
  throw new Error(`PICO raw source integrity changed: expected exactly one known detached-below fragment in NW, got ${JSON.stringify(rawDetached)}.`);
}

const sanitized = sanitizeDirectionalActorStrip({ rgba: decoded.rgba, width: decoded.width, height: decoded.height, frameSize: 96 });
const survivingDetached = sanitized.after.frames.flatMap((frame) => frame.detachedBelow.map((fragment) => ({ frameIndex: frame.frameIndex, ...fragment })));
if (survivingDetached.length) throw new Error(`Sanitized PICO runtime still has detached structural fragments: ${JSON.stringify(survivingDetached)}.`);
if (!sanitized.removed.length || sanitized.removed[0].frameIndex !== 7 || sanitized.removed[0].visiblePixelsRemoved < 8) {
  throw new Error(`PICO sanitizer did not remove the known NW fragment: ${JSON.stringify(sanitized.removed)}.`);
}

const footY = sanitized.after.frames.map((frame) => frame.footY);
if (JSON.stringify(footY) !== JSON.stringify(EXPECTED_SANITIZED_FOOT_Y)) {
  throw new Error(`Sanitized PICO foot planes changed: expected ${EXPECTED_SANITIZED_FOOT_Y}, got ${footY}.`);
}

const profile = JSON.parse(readFileSync(profilePath, "utf8")).profiles.pico;
if (profile.directions.map((direction) => direction.name).join(",") !== DIRECTIONS.join(",")) throw new Error("PICO grounding direction order does not match the source strip.");
if (JSON.stringify(profile.directions.map((direction) => direction.footY)) !== JSON.stringify(EXPECTED_SANITIZED_FOOT_Y)) {
  throw new Error("PICO grounding footY values must describe sanitized runtime geometry, not detached source fragments.");
}

const contactDistances = [];
for (let frameIndex = 0; frameIndex < profile.directions.length; frameIndex += 1) {
  const direction = profile.directions[frameIndex];
  for (let contactIndex = 0; contactIndex < direction.contacts.length; contactIndex += 1) {
    const contact = direction.contacts[contactIndex];
    const distance = nearestDistanceToMainStructural({
      rgba: sanitized.rgba,
      width: decoded.width,
      frameIndex,
      frameSize: 96,
      x: contact.x,
      y: contact.y,
    });
    contactDistances.push({ direction: direction.name, contactIndex, x: contact.x, y: contact.y, distance: Number(distance.toFixed(3)) });
    if (distance > 2) {
      throw new Error(`${direction.name} contact ${contactIndex} is detached from connected body geometry by ${distance.toFixed(2)} source px.`);
    }
  }
}

const report = {
  sourceSize: `${decoded.width}x${decoded.height}`,
  rawDetachedBelow: rawDetached,
  sanitizedRemoved: sanitized.removed,
  sanitizedFootY: footY,
  suggestedSupports: sanitized.after.frames.map((frame, index) => ({ direction: DIRECTIONS[index], supports: frame.suggestedSupports })),
  contactDistances,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pico-actor-source-integrity.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`directional actor source integrity PASS: removed ${sanitized.removed.reduce((sum, entry) => sum + entry.visiblePixelsRemoved, 0)} detached NW pixels; all grounding contacts attach to connected body geometry`);
