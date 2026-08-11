import type { TileLayerDefinition, TileMapVisualDefinition, TilesetDefinition } from "./types";

type TiledTileLayer = {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[] | string;
  opacity?: number;
  visible?: boolean;
};

type TiledOtherLayer = {
  id: number;
  name: string;
  type: string;
};

type TiledTileset = {
  firstgid: number;
  source?: string;
  image?: string;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
};

export type TiledMapJson = {
  orientation: string;
  infinite?: boolean;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<TiledTileLayer | TiledOtherLayer>;
  tilesets: TiledTileset[];
};

type TiledVisualOptions = {
  resolveAsset?: (path: string) => string;
};

function isTileLayer(layer: TiledTileLayer | TiledOtherLayer): layer is TiledTileLayer {
  return layer.type === "tilelayer";
}

export function visualFromTiledMap(map: TiledMapJson, options: TiledVisualOptions = {}): TileMapVisualDefinition {
  if (map.orientation !== "orthogonal") {
    throw new Error(`Numberdroid supports orthogonal Tiled maps only; got ${map.orientation}.`);
  }
  if (map.infinite) {
    throw new Error("Numberdroid VS2 currently expects a finite Tiled map export.");
  }

  const resolveAsset = options.resolveAsset ?? ((path: string) => path);
  const tilesets: TilesetDefinition[] = map.tilesets.map((tileset) => {
    if (tileset.source) {
      throw new Error(`External Tiled tileset ${tileset.source} must be embedded before export.`);
    }
    if (!tileset.image || !tileset.tilewidth || !tileset.tileheight || !tileset.columns || !tileset.tilecount) {
      throw new Error("Tiled tilesets must include image, tile dimensions, columns and tilecount.");
    }
    return {
      firstGid: tileset.firstgid,
      asset: resolveAsset(tileset.image),
      tileWidth: tileset.tilewidth,
      tileHeight: tileset.tileheight,
      columns: tileset.columns,
      tileCount: tileset.tilecount,
      margin: tileset.margin ?? 0,
      spacing: tileset.spacing ?? 0,
    };
  });

  const layers: TileLayerDefinition[] = map.layers.filter(isTileLayer).map((layer) => {
    if (!Array.isArray(layer.data)) {
      throw new Error(`Tile layer ${layer.name} must use an uncompressed JSON array.`);
    }
    if (layer.data.length !== layer.width * layer.height) {
      throw new Error(`Tile layer ${layer.name} has ${layer.data.length} cells; expected ${layer.width * layer.height}.`);
    }
    return {
      id: String(layer.id),
      name: layer.name,
      width: layer.width,
      height: layer.height,
      data: layer.data,
      opacity: layer.opacity ?? 1,
      visible: layer.visible ?? true,
    };
  });

  return {
    kind: "tilemap",
    columns: map.width,
    rows: map.height,
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    tilesets,
    layers,
  };
}
