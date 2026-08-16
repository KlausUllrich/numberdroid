import { publicAsset } from "../game/assets";
import type {
  CompositeFloorVisualDefinition,
  FloorDefinition,
  FloorVisualSpriteDefinition,
} from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { propArtRegistration } from "./propArtRegistry";
import { computePropExactFit } from "./propExactFit";
import { floorWithCompiledScript } from "./runtimeScriptContract";

/** Accepted default generated-wall fascia; individual runtime plans may override it. */
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

type Placement = RuntimeEmissionPlan["events"]["actors"]["props"]["placements"][number];

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

function previewMetrics(plan: RuntimeEmissionPlan) {
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  return {
    bounds,
    tileSize,
    width: bounds.w * tileSize,
    height: bounds.h * tileSize,
    pxX: (x: number) => (x - bounds.x) * tileSize,
    pxY: (y: number) => (y - bounds.y) * tileSize,
  };
}

function svgRoot(width: number, height: number, content: string, background = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background ? `<rect width="100%" height="100%" fill="#091011"/>` : ""}${content}</svg>`;
}

function groundSvg(plan: RuntimeEmissionPlan) {
  const { bounds, tileSize, width, height, pxX, pxY } = previewMetrics(plan);
  const spaces = plan.events.actors.props.navigation.geometry.spaces.map((space) => {
    const x = pxX(space.rect.x);
    const y = pxY(space.rect.y);
    const w = space.rect.w * tileSize;
    const h = space.rect.h * tileSize;
    return `<g data-space-id="${xml(space.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${spaceFill(plan, space.id, space.kind)}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#grid)" opacity=".55"/></g>`;
  }).join("");
  const defs = `<defs><pattern id="grid" width="${GRID_PX}" height="${GRID_PX}" patternUnits="userSpaceOnUse"><path d="M${GRID_PX} 0H0V${GRID_PX}" fill="none" stroke="#d8e1dc" stroke-opacity=".20" stroke-width="1"/><path d="M8 32H56" fill="none" stroke="#d8e1dc" stroke-opacity=".08" stroke-width="1"/></pattern></defs>`;
  void bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}<rect width="100%" height="100%" fill="#091011"/>${spaces}</svg>`;
}

function architectureSvg(plan: RuntimeEmissionPlan) {
  const { tileSize, width, height, pxX, pxY } = previewMetrics(plan);
  const walls = plan.events.actors.props.navigation.geometry.walls.map((wall) => {
    const x1 = pxX(wall.x);
    const y1 = pxY(wall.y);
    const x2 = wall.orientation === "horizontal" ? x1 + wall.length * tileSize : x1;
    const y2 = wall.orientation === "vertical" ? y1 + wall.length * tileSize : y1;
    return `<g data-wall-id="${xml(wall.id)}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#202827" stroke-width="${plan.wallVisualPx}" stroke-linecap="square"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#59635f" stroke-width="3" opacity=".72"/></g>`;
  }).join("");
  return svgRoot(width, height, walls);
}

/**
 * Fallback blockouts are presentation only, but they still must not visually
 * contradict the accepted wall fascia. Intersect their solved tile rectangle
 * with the containing room's visible interior before drawing the stub.
 */
function fallbackPropsSvg(plan: RuntimeEmissionPlan, placements: Placement[]) {
  const { tileSize, width, height, pxX, pxY } = previewMetrics(plan);
  const spaces = new Map(plan.events.actors.props.navigation.geometry.spaces.map((space) => [space.id, space]));
  const content = placements.map((placement) => {
    const style = PROP_STYLE[placement.role];
    const space = spaces.get(placement.spaceId);
    if (!space) throw new Error(`Fallback Prop ${placement.id} cannot resolve Space ${placement.spaceId}.`);

    const propLeft = pxX(placement.rect.x);
    const propTop = pxY(placement.rect.y);
    const propRight = propLeft + placement.rect.w * tileSize;
    const propBottom = propTop + placement.rect.h * tileSize;
    const fascia = plan.wallVisualPx / 2;
    const innerLeft = pxX(space.rect.x) + fascia;
    const innerTop = pxY(space.rect.y) + fascia;
    const innerRight = pxX(space.rect.x + space.rect.w) - fascia;
    const innerBottom = pxY(space.rect.y + space.rect.h) - fascia;

    const safeLeft = Math.max(propLeft, innerLeft);
    const safeTop = Math.max(propTop, innerTop);
    const safeRight = Math.min(propRight, innerRight);
    const safeBottom = Math.min(propBottom, innerBottom);
    const availableW = Math.max(8, safeRight - safeLeft);
    const availableH = Math.max(8, safeBottom - safeTop);
    const inset = Math.min(8, availableW * 0.12, availableH * 0.12);
    const x = safeLeft + inset;
    const y = safeTop + inset;
    const w = Math.max(8, availableW - inset * 2);
    const h = Math.max(8, availableH - inset * 2);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const fontSize = Math.max(18, Math.min(34, Math.min(w, h) * 0.42));
    return `<g data-prop-id="${xml(placement.id)}" data-fallback="true" data-wall-safe="true"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(12, w * .12, h * .12)}" fill="${style.fill}" fill-opacity=".86" stroke="${style.stroke}" stroke-width="3"/><text x="${cx}" y="${cy + fontSize * .34}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="800" fill="${style.stroke}" opacity=".9">${style.glyph}</text></g>`;
  }).join("");
  return svgRoot(width, height, content);
}

export function artSpriteForPlacement(
  plan: RuntimeEmissionPlan,
  placement: Placement,
  asset: string,
  id = placement.id,
): FloorVisualSpriteDefinition {
  const { bounds, tileSize } = previewMetrics(plan);
  const geometry = plan.events.actors.props.navigation.geometry;
  const request = geometry.semantic.props.find((entry) => entry.id === placement.requestId);
  if (!request) throw new Error(`Prop art emission cannot resolve request ${placement.requestId}.`);
  const space = geometry.spaces.find((entry) => entry.id === placement.spaceId);
  if (!space) throw new Error(`Prop art emission cannot resolve Space ${placement.spaceId}.`);
  const fit = computePropExactFit(
    placement,
    request.metadata,
    space.rect,
    tileSize,
    plan.wallCollisionPx,
    plan.wallVisualPx,
  );
  const originX = bounds.x * tileSize;
  const originY = bounds.y * tileSize;
  return {
    id,
    asset: publicAsset(asset),
    x: fit.spriteRectPx.x - originX,
    y: fit.spriteRectPx.y - originY,
    width: fit.spriteRectPx.w,
    height: fit.spriteRectPx.h,
    rotation: placement.rotation,
  };
}

function propVisualLayers(plan: RuntimeEmissionPlan) {
  const placements = plan.events.actors.props.placements;
  const semanticProps = new Map(plan.events.actors.props.navigation.geometry.semantic.props.map((entry) => [entry.id, entry]));
  const shadows: FloorVisualSpriteDefinition[] = [];
  const wallSprites: FloorVisualSpriteDefinition[] = [];
  const floorSprites: FloorVisualSpriteDefinition[] = [];
  const fallbackWall: Placement[] = [];
  const fallbackFloor: Placement[] = [];

  for (const placement of placements) {
    const request = semanticProps.get(placement.requestId);
    if (!request) throw new Error(`Prop art emission cannot resolve ${placement.requestId}.`);
    const art = propArtRegistration(request.propId);
    // `wallSide` on floor Props only records a touched/preferred wall. The
    // visual layer contract follows authored attachment semantics instead.
    const isWall = request.metadata.attachment === "wall";
    if (!art) {
      (isWall ? fallbackWall : fallbackFloor).push(placement);
      continue;
    }

    const sprite = artSpriteForPlacement(plan, placement, art.asset);
    (isWall ? wallSprites : floorSprites).push(sprite);
    if (art.shadowAsset) shadows.push(artSpriteForPlacement(plan, placement, art.shadowAsset, `shadow:${placement.id}`));
  }

  return { shadows, wallSprites, floorSprites, fallbackWall, fallbackFloor };
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function compilerCompositePreviewVisual(plan: RuntimeEmissionPlan): CompositeFloorVisualDefinition {
  const mapped = propVisualLayers(plan);
  const layers: CompositeFloorVisualDefinition["layers"] = [
    { id: "ground", kind: "image", asset: svgDataUrl(groundSvg(plan)) },
  ];
  if (mapped.shadows.length) layers.push({ id: "floor-fx", kind: "sprites", sprites: mapped.shadows });
  layers.push({ id: "architecture", kind: "image", asset: svgDataUrl(architectureSvg(plan)) });
  if (mapped.fallbackWall.length) layers.push({ id: "wall-prop-blockouts", kind: "image", asset: svgDataUrl(fallbackPropsSvg(plan, mapped.fallbackWall)) });
  if (mapped.wallSprites.length) layers.push({ id: "wall-props", kind: "sprites", sprites: mapped.wallSprites });
  if (mapped.fallbackFloor.length) layers.push({ id: "floor-prop-blockouts", kind: "image", asset: svgDataUrl(fallbackPropsSvg(plan, mapped.fallbackFloor)) });
  if (mapped.floorSprites.length) layers.push({ id: "floor-props", kind: "sprites", sprites: mapped.floorSprites });
  return { kind: "composite", layers };
}

export function compilerPlayablePreviewSvg(plan: RuntimeEmissionPlan) {
  const metrics = previewMetrics(plan);
  const allFallback = plan.events.actors.props.placements;
  const ground = groundSvg(plan)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  const architecture = architectureSvg(plan)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  const props = fallbackPropsSvg(plan, allFallback)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  return svgRoot(metrics.width, metrics.height, `${ground}${architecture}${props}`);
}

export function createPlayableCompilerPreview(plan: RuntimeEmissionPlan): FloorDefinition {
  const floor = floorWithCompiledScript(plan);
  return {
    ...floor,
    visual: compilerCompositePreviewVisual(plan),
  };
}
