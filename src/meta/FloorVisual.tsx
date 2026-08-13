import { memo, type CSSProperties } from "react";
import type { FloorDefinition, TileMapVisualDefinition, TilesetDefinition } from "../game/types";
import "./FloorVisual.css";

const FLIP_HORIZONTAL = 0x80000000;
const FLIP_VERTICAL = 0x40000000;
const FLIP_DIAGONAL = 0x20000000;
const GID_MASK = ~(FLIP_HORIZONTAL | FLIP_VERTICAL | FLIP_DIAGONAL) >>> 0;

type Props = { floor: FloorDefinition };
type TileTransform = CSSProperties & { transform?: string };

function resolveTileset(visual: TileMapVisualDefinition, rawGid: number): TilesetDefinition | null {
  const gid = rawGid & GID_MASK;
  let best: TilesetDefinition | null = null;
  for (const tileset of visual.tilesets) {
    if (gid < tileset.firstGid) continue;
    if (gid >= tileset.firstGid + tileset.tileCount) continue;
    if (!best || tileset.firstGid > best.firstGid) best = tileset;
  }
  return best;
}

function tileTransform(rawGid: number): string | undefined {
  const horizontal = Boolean(rawGid & FLIP_HORIZONTAL);
  const vertical = Boolean(rawGid & FLIP_VERTICAL);
  const diagonal = Boolean(rawGid & FLIP_DIAGONAL);
  if (!horizontal && !vertical && !diagonal) return undefined;

  const transforms: string[] = [];
  if (diagonal) transforms.push("rotate(90deg)");
  if (horizontal) transforms.push("scaleX(-1)");
  if (vertical) transforms.push("scaleY(-1)");
  return transforms.join(" ");
}

function TileMap({ visual }: { visual: TileMapVisualDefinition }) {
  return (
    <div
      className="zk-tilemap"
      aria-hidden="true"
      style={{ width: visual.columns * visual.tileWidth, height: visual.rows * visual.tileHeight }}
    >
      {visual.layers.filter((layer) => layer.visible !== false).map((layer) => (
        <div key={layer.id} className="zk-tilemap-layer" style={{ opacity: layer.opacity ?? 1 }}>
          {layer.data.map((rawGid, index) => {
            if (!rawGid) return null;
            const gid = rawGid & GID_MASK;
            const tileset = resolveTileset(visual, rawGid);
            if (!tileset) return null;
            const localId = gid - tileset.firstGid;
            const sourceCol = localId % tileset.columns;
            const sourceRow = Math.floor(localId / tileset.columns);
            const col = index % layer.width;
            const row = Math.floor(index / layer.width);
            const sourceX = tileset.margin + sourceCol * (tileset.tileWidth + tileset.spacing);
            const sourceY = tileset.margin + sourceRow * (tileset.tileHeight + tileset.spacing);
            const transform = tileTransform(rawGid);
            const style: TileTransform = {
              left: col * visual.tileWidth,
              top: row * visual.tileHeight,
              width: tileset.tileWidth,
              height: tileset.tileHeight,
              backgroundImage: `url(${tileset.asset})`,
              backgroundPosition: `-${sourceX}px -${sourceY}px`,
              transform,
            };
            return (
              <i
                key={`${layer.id}-${index}`}
                className="zk-map-tile"
                data-tile-id={localId + 1}
                data-layer-id={layer.id}
                style={style}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const FloorVisual = memo(function FloorVisual({ floor }: Props) {
  if (floor.visual.kind === "image") {
    return (
      <img
        className="zk-deck-art"
        alt=""
        src={floor.visual.asset}
        style={{ width: floor.width, height: floor.height }}
      />
    );
  }

  return <TileMap visual={floor.visual} />;
});
