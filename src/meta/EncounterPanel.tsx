import { BODIES } from "../game/catalog";
import type { EncounterConfig } from "../game/types";

type Props = {
  encounter: EncounterConfig;
  onCancel: () => void;
  onStart: () => void;
};

export function EncounterPanel({ encounter, onCancel, onStart }: Props) {
  const body = BODIES[encounter.bodyId];
  return (
    <div className="zk-modal-layer clean-encounter-layer" role="dialog" aria-modal="true" aria-labelledby="encounter-title">
      <section className={`zk-encounter ${encounter.boss ? "boss" : ""}`}>
        <div className="zk-encounter-robot"><img src={body.sprite} alt={encounter.name} /></div>
        <div className="zk-encounter-info">
          <small>{encounter.boss ? "EBENENZIEL · ENDGEGNER" : "FEINDLICHER DROID IDENTIFIZIERT"}</small>
          <h2 id="encounter-title">{encounter.name}</h2>
          {encounter.storyIntro && <p className="zk-encounter-story">{encounter.storyIntro}</p>}
          <div className="zk-encounter-row">
            <div className="zk-encounter-chip"><span>RECHENPROTOKOLL</span><b>{encounter.mathLabel}</b></div>
            <div className="zk-encounter-chip"><span>KI-STÄRKE</span><b>{encounter.difficultyLabel}</b></div>
            <div className="zk-encounter-chip"><span>KÖRPERKLASSE</span><b>{body.bodyClass}</b></div>
          </div>
          <div className="zk-encounter-reward">{encounter.rewardLabel}</div>
          <div className="zk-encounter-actions">
            <button onClick={onCancel}>WEITERFAHREN</button>
            <button className="attack" onClick={onStart}>TRANSFER STARTEN</button>
          </div>
        </div>
      </section>
    </div>
  );
}
