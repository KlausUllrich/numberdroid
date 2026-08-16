import type { FloorDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";

export const COMPILER_PREVIEW_FASCIA_PX = 30;
const GRID_PX = 64;

const SPACE_FILLS = {
  domestic: "#777d73",
  corridor: "#667470",
  ritual: "#68755f",
  system: "#5f6c73",
  neutral: "#69736f",
} as const;

const PROP_STYLE = {
  hero: { fill: "#d4bc48", stroke: "#675713", glyph: "◎" },
  support: { fill: "#65b7cf", stroke: "#245b6c", glyph: "+" },
  furniture: { fill: "#c8814b", stroke: "#6a3d20", glyph: "□" },
  dressing: { fill: "#6eab72", stroke: "#2d6033", glyph: "♧" },
} as const;

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function spaceFill(plan: RuntimeEmissionPlan, spaceId: string, kind: "room" | "corridor") {
  if (kind === "corridor") return SPACE_FILLS.corridor;
  const semantic = plan.events.actors.props.navigation.geometry.semantic.spaces.find((entry) => entry.id === spaceId);
  if (semantic?.kind === "room" && semantic.rationality === "domestic") return SPACE_FILLS.domestic;
  if (semantic?.kind === "room" && semantic.rationality === "ritual") return SPACE_FILLS.ritual;
  if (semantic?.kind === "room" && semantic.rationality === "system") return SPACE_FILLS.system;
  return SPACE_FILLS.neutral;
}

/**
 * Builds one static world-space SVG for playable compiler QA.
 *
 * This deliberately does not mirror collision as hundreds of React tile nodes.
 * Runtime collision remains the v0.6 FloorDefinition. The SVG only presents the
 * same generated geometry with the accepted 30 px visible wall-fascia language.
 */
export function compilerPlayablePreviewSvg(plan: RuntimeEmissionPlan) {
  const navigation = plan.events.actors.props.navigation;
  const geometry = navigation.geometry;
  const bounds = navigation.bounds;
  const tileSize = plan.tileSize;
  const width = bounds.w * tileSize;
  const height = bounds.h * tileSize;
  const pxX = (x: number) => (x - bounds.x) * tileSize;
  const pxY = (y: number) => (y - bounds.y) * tileSize;

  const spaces = geometry.spaces.map((space) => {
    const x = pxX(space.rect.x);
    const y = pxY(space.rect.y);
    const w = space.rect.w * tileSize;
    const h = space.rect.h * tileSize;
    return `<g data-space-id="${xml(space.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${spaceFill(plan, space.id, space.kind)}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#grid)" opacity=".55"/></g>`;
  }).join("");

  const walls = geometry.walls.map((wall) => {
    const x1 = pxX(wall.x);
    const y1 = pxY(wall.y);
    const x2 = wall.orientation === "horizontal" ? x1 + wall.length * tileSize : x1;
    const y2 = wall.orientation === "vertical" ? y1 + wall.length * tileSize : y1;
    return `<g data-wall-id="${xml(wall.id)}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#202827" stroke-width="${COMPILER_PREVIEW_FASCIA_PX}" stroke-linecap="square"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#59635f" stroke-width="3" opacity=".72"/></g>`;
  }).join("");

  const props = plan.events.actors.props.placements.map((placement) => {
    const style = PROP_STYLE[placement.role];
    const inset = Math.min(10, tileSize * 0.14);
    const x = pxX(placement.rect.x) + inset;
    const y = pxY(placement.rect.y) + inset;
    const w = Math.max(8, placement.rect.w * tileSize - inset * 2);
    const h = Math.max(8, placement.rect.h * tileSize - inset * 2);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const fontSize = Math.max(18, Math.min(34, Math.min(w, h) * 0.42));
    return `<g data-prop-id="${xml(placement.id)}" transform="rotate(${placement.rotation} ${cx} ${cy})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(12, w * .12, h * .12)}" fill="${style.fill}" fill-opacity=".86" stroke="${style.stroke}" stroke-width="3"/><text x="${cx}" y="${cy + fontSize * .34}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="800" fill="${style.stroke}" opacity=".9">${style.glyph}</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="grid" width="${GRID_PX}" height="${GRID_PX}" patternUnits="userSpaceOnUse"><path d="M${GRID_PX} 0H0V${GRID_PX}" fill="none" stroke="#d8e1dc" stroke-opacity=".20" stroke-width="1"/><path d="M8 32H56" fill="none" stroke="#d8e1dc" stroke-opacity=".08" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#091011"/>${spaces}${walls}${props}</svg>`;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Adds a presentation-only compiler blockout to an emitted runtime Floor.
 * Collision, doors, encounters and pickups remain exactly those produced by
 * v0.6. The whole static level illustration is one image so camera movement
 * stays compositor-cheap even when the compiler emits many wall segments.
 */
export function createPlayableCompilerPreview(plan: RuntimeEmissionPlan): FloorDefinition {
  const floor = plan.runtimeFloor;
  return {
    ...floor,
    visual: {
      kind: "image",
      asset: svgDataUrl(compilerPlayablePreviewSvg(plan)),
    },
  };
}
