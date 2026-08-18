import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "art-source/recipes/transfer-hall/robots/pico/source");
const profilePath = join(root, "src/meta/characterGroundingProfiles.json");
const outDir = join(root, "artifacts/grounding");
const FRAME = 96;
const RUNTIME = 52;
const VIEW_SCALE = 3;
const VIEW = RUNTIME * VIEW_SCALE;
const PANEL_W = 350;
const PANEL_H = 235;

function canonicalSourceBytes() {
  const files = readdirSync(sourceDir)
    .filter((file) => file.startsWith("directional-pico-gold.b64."))
    .sort();
  if (files.length !== 4) throw new Error(`Expected 4 PICO source chunks, found ${files.length}.`);
  return Buffer.from(files.map((file) => readFileSync(join(sourceDir, file), "utf8").trim()).join(""), "base64");
}

function runtime(value) {
  return value / FRAME * RUNTIME;
}

function checker(parts, x0, y0) {
  const cell = 13;
  parts.push(`<rect x="${x0}" y="${y0}" width="${VIEW}" height="${VIEW}" fill="#b8b7ad"/>`);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if ((x + y) % 2 === 0) parts.push(`<rect x="${x0 + x * cell * 3}" y="${y0 + y * cell * 3}" width="${cell * 3}" height="${cell * 3}" fill="#c8c6bb"/>`);
    }
  }
}

function drawGrounding(parts, direction, profile, x0, y0) {
  const contacts = direction.contacts;
  const meanY = contacts.reduce((sum, contact) => sum + contact.y, 0) / contacts.length;
  const presentationOffsetY = runtime(direction.presentationOffsetY ?? 0) * VIEW_SCALE;
  const ambientY = runtime(meanY + profile.ambient.offsetYFromContactMean) * VIEW_SCALE;
  const ambientRx = runtime(profile.ambient.width / 2) * VIEW_SCALE;
  const ambientRy = runtime(profile.ambient.height / 2) * VIEW_SCALE;
  parts.push(`<ellipse cx="${x0 + VIEW / 2}" cy="${y0 + ambientY + presentationOffsetY}" rx="${ambientRx}" ry="${ambientRy}" fill="#030809" opacity="${profile.ambient.coreOpacity}"/>`);

  for (const contact of contacts) {
    const rx = runtime(contact.radiusX ?? profile.contactDefaults.radiusX) * VIEW_SCALE;
    const ry = runtime(contact.radiusY ?? profile.contactDefaults.radiusY) * VIEW_SCALE;
    parts.push(`<ellipse cx="${x0 + runtime(contact.x) * VIEW_SCALE}" cy="${y0 + runtime(contact.y) * VIEW_SCALE + presentationOffsetY}" rx="${rx}" ry="${ry}" fill="#000304" opacity="${contact.opacity ?? profile.contactDefaults.opacity}"/>`);
  }
}

function drawSprite(parts, href, frameIndex, x0, y0) {
  parts.push(`<svg x="${x0}" y="${y0}" width="${VIEW}" height="${VIEW}" viewBox="${frameIndex * FRAME} 0 ${FRAME} ${FRAME}" preserveAspectRatio="none"><image href="${href}" x="0" y="0" width="768" height="96"/></svg>`);
}

function drawDebug(parts, direction, profile, x0, y0) {
  const footY = y0 + runtime(direction.footY) * VIEW_SCALE;
  parts.push(`<line x1="${x0}" x2="${x0 + VIEW}" y1="${footY}" y2="${footY}" stroke="#ffd45a" stroke-width="2"/>`);
  for (const contact of direction.contacts) {
    const cx = x0 + runtime(contact.x) * VIEW_SCALE;
    const cy = y0 + runtime(contact.y) * VIEW_SCALE;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="#ff3fd1" stroke-width="2"/>`);
  }
  parts.push(`<rect x="${x0}" y="${y0}" width="${VIEW}" height="${VIEW}" fill="none" stroke="#42dff5" stroke-width="1"/>`);
}

const sourceBytes = canonicalSourceBytes();
const href = `data:image/png;base64,${sourceBytes.toString("base64")}`;
const data = JSON.parse(readFileSync(profilePath, "utf8"));
const profile = data.profiles.pico;
if (!profile || profile.sourceFrameSize !== 96 || profile.directions.length !== 8) throw new Error("PICO grounding profile is incomplete.");

const width = PANEL_W * 4;
const height = PANEL_H * 2;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<rect width="100%" height="100%" fill="#202526"/>`,
  `<style>text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;fill:#e8efed}.title{font-size:15px;font-weight:700}.small{font-size:10px}.label{font-size:9px;fill:#aeb9b5}</style>`,
];

profile.directions.forEach((direction, index) => {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const ox = col * PANEL_W;
  const oy = row * PANEL_H;
  const normalX = ox + 12;
  const debugX = ox + 182;
  const viewY = oy + 28;

  parts.push(`<text class="title" x="${ox + 12}" y="${oy + 18}">${index} · ${direction.name}</text>`);
  parts.push(`<text class="label" x="${normalX}" y="${viewY - 5}">NORMAL RUNTIME ×3</text>`);
  parts.push(`<text class="label" x="${debugX}" y="${viewY - 5}">DEBUG RUNTIME ×3</text>`);

  checker(parts, normalX, viewY);
  drawGrounding(parts, direction, profile, normalX, viewY);
  drawSprite(parts, href, index, normalX, viewY);

  checker(parts, debugX, viewY);
  drawGrounding(parts, direction, profile, debugX, viewY);
  drawSprite(parts, href, index, debugX, viewY);
  drawDebug(parts, direction, profile, debugX, viewY);

  const runtimeFoot = runtime(direction.footY).toFixed(2);
  const contactText = direction.contacts.map((contact) => `(${contact.x},${contact.y})`).join(" ");
  const presentationOffset = direction.presentationOffsetY ?? 0;
  parts.push(`<text class="small" x="${ox + 12}" y="${viewY + VIEW + 16}">source footY ${direction.footY}/96 → runtime ${runtimeFoot}/52 · renderY ${presentationOffset}</text>`);
  parts.push(`<text class="small" x="${ox + 12}" y="${viewY + VIEW + 31}">contacts ${contactText}</text>`);
});

parts.push(`</svg>`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pico-grounding-runtime-preview.svg"), `${parts.join("\n")}\n`);
console.log("PICO grounding runtime preview: wrote 8-direction 52px normal/debug comparison");
