export type FamilyHygieneFloorTileRole = "base" | "fine";

export type FamilyHygieneFloorTileMetadata = {
  id: "hygiene-base-a" | "hygiene-base-b" | "hygiene-fine-a" | "hygiene-fine-b";
  index: number;
  asset: string;
  role: FamilyHygieneFloorTileRole;
  spanTiles: { w: 1; h: 1 };
  continuityProfile: "family-hygiene-calm-v1";
  runtimeEligible: boolean;
  wallSafe: boolean;
  rotationPolicy: "invariant";
  connectors: readonly [];
  selectionPriority: number;
  note?: string;
};

const tile = (
  entry: FamilyHygieneFloorTileMetadata,
): FamilyHygieneFloorTileMetadata => entry;

/** Explicit source-cell authority for the approved 2x2 Hygiene board. */
export const FAMILY_HYGIENE_FLOOR_TILE_METADATA: readonly FamilyHygieneFloorTileMetadata[] = [
  tile({
    id: "hygiene-base-a",
    index: 0,
    asset: "family-hygiene-floor-00.png",
    role: "base",
    spanTiles: { w: 1, h: 1 },
    continuityProfile: "family-hygiene-calm-v1",
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "invariant",
    connectors: [],
    selectionPriority: 100,
    note: "Dominant calm non-slip base; owns at least four of the six TS-01 Hygiene cells.",
  }),
  tile({
    id: "hygiene-base-b",
    index: 1,
    asset: "family-hygiene-floor-01.png",
    role: "base",
    spanTiles: { w: 1, h: 1 },
    continuityProfile: "family-hygiene-calm-v1",
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "invariant",
    connectors: [],
    selectionPriority: 80,
  }),
  tile({
    id: "hygiene-fine-a",
    index: 2,
    asset: "family-hygiene-floor-02.png",
    role: "fine",
    spanTiles: { w: 1, h: 1 },
    continuityProfile: "family-hygiene-calm-v1",
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "invariant",
    connectors: [],
    selectionPriority: 60,
  }),
  tile({
    id: "hygiene-fine-b",
    index: 3,
    asset: "family-hygiene-floor-03.png",
    role: "fine",
    spanTiles: { w: 1, h: 1 },
    continuityProfile: "family-hygiene-calm-v1",
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "invariant",
    connectors: [],
    selectionPriority: 40,
    note: "Approved and materialized, but reserved from the tiny v1 room layout to keep it calm.",
  }),
] as const;

export const FAMILY_HYGIENE_FLOOR_TILE_BY_ID = new Map(
  FAMILY_HYGIENE_FLOOR_TILE_METADATA.map((entry) => [entry.id, entry]),
);
