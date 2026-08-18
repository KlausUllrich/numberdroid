import { useState } from "react";
import { getFloor } from "../game/floors";
import { createFloorState } from "../game/save";
import { MetaGame } from "./MetaGame";

const TS01_GROUNDING_FLOOR_ID = "ts01-generated";

function initialGroundingSceneState() {
  const floor = getFloor(TS01_GROUNDING_FLOOR_ID);
  return {
    ...createFloorState(floor, 1),
    currentBody: "pico" as const,
    currentDeckSize: "standard" as const,
  };
}

export function CharacterGroundingSceneFixture() {
  const [meta, setMeta] = useState(initialGroundingSceneState);
  return (
    <MetaGame
      meta={meta}
      onMetaChange={setMeta}
      onEncounter={() => undefined}
      paused
    />
  );
}
