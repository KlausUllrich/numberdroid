import { readFileSync, writeFileSync } from "node:fs";

const path = "src/meta/MetaGame.tsx";
let source = readFileSync(path, "utf8");
let changed = false;

if (!source.includes('import { CharacterGroundingLayer } from "./CharacterGroundingLayer";')) {
  const importNeedle = 'import { DoorLayer } from "./DoorLayer";';
  if (!source.includes(importNeedle)) throw new Error("MetaGame import anchor not found");
  source = source.replace(
    importNeedle,
    'import { CharacterGroundingLayer } from "./CharacterGroundingLayer";\n' + importNeedle,
  );
  changed = true;
}

if (!source.includes("<CharacterGroundingLayer />")) {
  const playerNeedle = '          <div ref={playerRef} className={`zk-player ${meta.currentDeckSize} ${directionClassForFacing(pose.facing)}`} style={initialPlayerStyle}>\n            <span className="zk-player-name">{body.name}</span>';
  if (!source.includes(playerNeedle)) throw new Error("MetaGame player render anchor not found");
  source = source.replace(
    playerNeedle,
    '          <div ref={playerRef} className={`zk-player ${meta.currentDeckSize} ${directionClassForFacing(pose.facing)}`} style={initialPlayerStyle}>\n            <CharacterGroundingLayer />\n            <span className="zk-player-name">{body.name}</span>',
  );
  changed = true;
}

if (changed) {
  writeFileSync(path, source);
  console.log("Applied real CharacterGroundingLayer DOM patch to MetaGame.tsx");
} else {
  console.log("MetaGame.tsx already contains CharacterGroundingLayer DOM patch");
}
