import { BODIES, robotDriveProfile } from "../game/catalog";
import type { EncounterConfig } from "../game/types";
import "./EncounterPanel.css";

type Props = {
  encounter: EncounterConfig;
  onCancel: () => void;
  onStart: () => void;
};

export function EncounterPanel({ encounter, onCancel, onStart }: Props) {
  const body = BODIES[encounter.bodyId];
  const deckSize = encounter.deckSize ?? "standard";
  const drive = robotDriveProfile(encounter.bodyId, deckSize);
  const duelLayers = encounter.duelLayers ?? 1;

  return (
    <div className="zk-modal-layer clean-encounter-layer" role="dialog" aria-modal="true" aria-labelledby="encounter-title">
      <section className={`zk-encounter ${encounter.boss ? "boss" : ""} ${deckSize}`}>
        <div className="zk-encounter-robot">
          <img src={body.sprite} alt={encounter.name} />
          <span>{deckSize === "large" ? "SCHWERKÖRPER" : body.bodyClass}</span>
        </div>
        <div className="zk-encounter-info">
          <small>{encounter.boss ? "KOMMANDO-SIGNATUR · ENDGEGNER" : "DROID-SCAN · TAKTISCHE ANALYSE"}</small>
          <h2 id="encounter-title">{encounter.name}</h2>
          <div className="zk-encounter-role"><b>{body.roleLabel}</b><span>{body.roleDescription}</span></div>
          {encounter.storyIntro && <p className="zk-encounter-story">{encounter.storyIntro}</p>}

          <div className="zk-encounter-row scan-grid">
            <div className="zk-encounter-chip"><span>RECHENPROTOKOLL</span><b>{encounter.mathLabel}</b></div>
            <div className="zk-encounter-chip"><span>KI-STÄRKE</span><b>{encounter.difficultyLabel}</b></div>
            <div className="zk-encounter-chip"><span>GRÖSSENKLASSE</span><b>{deckSize === "large" ? "GROSS · SCHWER" : "STANDARD"}</b></div>
            <div className="zk-encounter-chip"><span>FAHRWERK</span><b>{drive.label}</b></div>
          </div>

          <div className="zk-encounter-capability">
            <span>KÖRPERFÄHIGKEIT</span>
            <b>{body.abilityLabel}</b>
            <p>{body.abilityDescription}</p>
          </div>

          {encounter.accessKey && (
            <div className="zk-encounter-access">
              <div className="zk-encounter-keycard" aria-hidden="true">
                <i className="chip" />
                <b>SEC</b>
                <span>ACCESS</span>
              </div>
              <div>
                <span>SECURITY-FREIGABE IM DROIDENKERN</span>
                <b>{encounter.accessKey.label}</b>
                <p>Wird nach erfolgreichem Transfer automatisch übernommen.</p>
              </div>
            </div>
          )}

          {duelLayers > 1 && (
            <div className="zk-encounter-boss-protocol">
              <span>KOMMANDOKERN-SCHUTZ</span>
              <b>{duelLayers} REAKTOR-FIREWALLS</b>
              <p>Alle Schutzschichten sind zu Beginn aktiv. Eine 5er-Kette durchbricht nur die aktuelle Firewall; Meta-Energie und Körperjoker reichen über den gesamten Kampf.</p>
            </div>
          )}

          <div className="zk-encounter-actions">
            <button onClick={onCancel}>WEITERFAHREN</button>
            <button className="attack" onClick={onStart}>{encounter.boss ? "KOMMANDODUELL STARTEN" : "DUELL STARTEN"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
