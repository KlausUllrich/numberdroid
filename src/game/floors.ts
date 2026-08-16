import type { EnergyStationDefinition, FloorDefinition } from "./types";
import { publicAsset } from "./assets";
import { floorFromTiledMap } from "./tiled";
import { DECK_C3_MAP } from "./maps/deckC3";
import { DECK_VS2_MAP } from "./maps/deckVs2";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PREVIEW_ALIAS } from "../levelgen/generatedTs01Preview";
import {
  BIOARK_PASSBY_GENERATED_FLOOR,
  BIOARK_PASSBY_PREVIEW_ALIAS,
} from "../levelgen/generatedBioArkPassbyPreview";

const DECK_A7_STATIONS: EnergyStationDefinition[] = [
  {
    id: "a7-energy-1",
    x: 800,
    y: 585,
    energy: 1,
    label: "ENERGIE ⚡ +1",
  },
];

export const DECK_A7: FloorDefinition = {
  id: "deck-a7",
  name: "DECK A7",
  subtitle: "FREIE ERKUNDUNG · VERTICAL SLICE",
  width: 1600,
  height: 1000,
  visual: {
    kind: "image",
    asset: publicAsset("assets/deck/deck-a7.webp"),
  },
  start: {
    x: 800,
    y: 850,
    facing: 0,
    bodyId: "pico",
    metaEnergy: 0,
  },
  objectives: {
    default: "ERKUNDE DAS DECK · FINDE ENERGIE · WÄHLE EINEN DROIDEN",
    afterEnergy: "ENERGIE GESICHERT · WÄHLE EINEN DROIDEN",
  },
  walkable: [
    { x: 630, y: 650, w: 340, h: 300 },
    { x: 430, y: 390, w: 740, h: 330 },
    { x: 120, y: 470, w: 420, h: 170 },
    { x: 1060, y: 470, w: 420, h: 170 },
    { x: 690, y: 110, w: 220, h: 340 },
  ],
  obstacles: [
    { x: 455, y: 565, w: 140, h: 150 },
    { x: 885, y: 575, w: 150, h: 135 },
    { x: 1020, y: 570, w: 125, h: 130 },
  ],
  rooms: [],
  doors: [],
  pickups: [],
  actions: [],
  energyStations: DECK_A7_STATIONS,
  encounters: [
    {
      encounterId: "a7-sentry-west",
      enemyId: "sentry",
      name: "SENTRY-4",
      x: 270,
      y: 555,
      mode: "add-easy",
      mathLabel: "+ ZIEL 6",
      mathRole: "comfort",
      difficulty: "easy",
      difficultyLabel: "LEICHT",
      bodyId: "sentry",
      rewardLabel: "SIEG → SENTRY-4 ÜBERNEHMEN",
      retreat: { x: 650, y: 520 },
    },
    {
      encounterId: "a7-magnetar-east",
      enemyId: "magnetar",
      name: "MAGNETAR 742",
      x: 1330,
      y: 555,
      mode: "add-normal",
      mathLabel: "+ ZIEL 8",
      mathRole: "core",
      difficulty: "medium",
      difficultyLabel: "MITTEL",
      bodyId: "magnetar",
      rewardLabel: "SIEG → MAGNETAR 742 + REIHENSCHUB →",
      retreat: { x: 950, y: 520 },
    },
    {
      encounterId: "a7-kronos-north",
      enemyId: "kronos",
      name: "KRONOS-9",
      x: 800,
      y: 210,
      mode: "add-hard",
      mathLabel: "+ ZIEL 10",
      mathRole: "boss",
      difficulty: "hard",
      difficultyLabel: "STARK",
      bodyId: "kronos",
      rewardLabel: "SIEG → KRONOS-9 ÜBERNEHMEN",
      retreat: { x: 800, y: 455 },
    },
  ],
};

export const DECK_VS2 = floorFromTiledMap(DECK_VS2_MAP, { resolveAsset: publicAsset });
export const DECK_C3 = floorFromTiledMap(DECK_C3_MAP, { resolveAsset: publicAsset });
export const TRANSFER_HALL = floorFromTiledMap(TRANSFER_HALL_MAP, { resolveAsset: publicAsset });

export const FLOORS: Record<string, FloorDefinition> = {
  [DECK_A7.id]: DECK_A7,
  [DECK_VS2.id]: DECK_VS2,
  [DECK_C3.id]: DECK_C3,
  [TRANSFER_HALL.id]: TRANSFER_HALL,
  [TS01_GENERATED_FLOOR.id]: TS01_GENERATED_FLOOR,
  [TS01_GENERATED_PREVIEW_ALIAS]: TS01_GENERATED_FLOOR,
  [BIOARK_PASSBY_GENERATED_FLOOR.id]: BIOARK_PASSBY_GENERATED_FLOOR,
  [BIOARK_PASSBY_PREVIEW_ALIAS]: BIOARK_PASSBY_GENERATED_FLOOR,
};

export const DEFAULT_FLOOR_ID = DECK_A7.id;
export const CURRENT_FLOOR = DECK_A7;

export function getFloor(floorId: string): FloorDefinition {
  return FLOORS[floorId] ?? DECK_A7;
}

export function getPreviewFloorId(): string | null {
  if (typeof window === "undefined") return null;
  const floorId = new URLSearchParams(window.location.search).get("floor");
  return floorId && FLOORS[floorId] ? floorId : null;
}
