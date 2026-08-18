import { useState } from "react";
import { getFloor } from "../game/floors";
import { createFloorState } from "../game/save";
import type { MetaState } from "../game/types";
import { MetaGame } from "./MetaGame";

const TS01_GROUNDING_FLOOR_ID = "ts01-generated";

function initialGroundingSceneState(): MetaState {
  const floor = getFloor(TS01_GROUNDING_FLOOR_ID);
  return {
    ...createFloorState(floor, 1),
    currentBody: "pico",
    currentDeckSize: "standard",
  };
}

export function CharacterGroundingSceneFixture() {
  const [meta, setMeta] = useState<MetaState>(initialGroundingSceneState);
  return (
    <MetaGame
      meta={meta}
      onMetaChange={setMeta}
      onEncounter={() => undefined}
      paused
    />
  );
}
