import { BODIES, robotDriveProfile } from "../game/catalog";
import type { EncounterConfig } from "../game/types";
import "./EncounterPanel.css";

type Props = {
  encounter: EncounterConfig;
  onCancel: () => void;
  onStart: () => void;
};

function behaviorCopy(encounter: EncounterConfig) {
  switch (encounter.behavior?.kind) {
    case "neutral": return "NEUTRAL · MACHT SEINE ARBEIT";
    case "guard": return "WACHE · VERFOLGT NUR IM POSTENBEREICH";
    case "patrol": return "PATROUILLE · BEWEGT SICH";
    case "aggressive": return encounter.behavior.forcedEngagement ? "JÄGER · ERZWINGT KAMPF" : "JÄGER · VERFOLGT DICH";
    default: return "PASSIV · KONTAKTSCAN";
  }
}

function mathRoleCopy(encounter: EncounterConfig) {
  switch (encounter.mathRole) {
    case "comfort": return "KOMFORT · FLÜSSIG";
    case "core": return "KERNÜBUNG";
    case "stretch": return "ANSPRUCHSVOLL";
    case "specialist": return "SPEZIALIST";
    case "boss": return "BOSS-PROTOKOLL";
    default: return encounter.difficulty === "easy" ? "KOMFORT · FLÜSSIG" : encounter.difficulty === "medium" ? "KERNÜBUNG" : "ANSPRUCHSVOLL";
  }
}

export function EncounterPanel({ encounter, onCancel, onStart }: Props) {
  const body = BODIES[encounter.bodyId];
  const deckSize = encounter.deckSize ?? "standard";
  const drive = robotDriveProfile(encounter.bodyId, deckSize);
  const duelLayers = encounter.duelLayers ?? 1;
  const neutral = encounter.behavior?.kind === "neutral";
  const forcedEngagement = Boolean(encounter.behavior?.forcedEngagement);

  return (
    <div className="zk-modal-layer clean-encounter-layer" role="dialog" aria-modal="true" aria-labelledby="encounter-title">
      <section className={`zk-encounter ${encounter.boss ? "boss" : ""} ${neutral ? "neutral" : ""} ${deckSize}`}>
        <div className="zk-encounter-robot">
          <img src={body.sprite} alt={encounter.name} />
          <span>{deckSize === "large" ? "SCHWERKÖRPER" : body.bodyClass}</span>
        </div>
        <div className="zk-encounter-info">
          <small>{encounter.boss ? "KOMMANDO-SIGNATUR · ENDGEGNER" : neutral ? "NEUTRALER DROID · KONTAKTSCAN" : forcedEngagement ? "FEINDLICHER ABFANGSCAN · KAMPF ERZWUNGEN" : "DROID-SCAN · TAKTISCHE ANALYSE"}</small>
          <h2 id="encounter-title">{encounter.name}</h2>
          <div className="zk-encounter-role"><b>{body.roleLabel}</b><span>{body.roleDescription}</span></div>
          {encounter.storyIntro && <p className="zk-encounter-story">{encounter.storyIntro}</p>}

          <div className="zk-encounter-row scan-grid">
            <div className="zk-encounter-chip"><span>RECHENPROTOKOLL</span><b>{encounter.mathLabel}</b></div>
            <div className="zk-encounter-chip"><span>RECHENROLLE</span><b>{mathRoleCopy(encounter)}</b></div>
            <div className="zk-encounter-chip"><span>KI-STÄRKE</span><b>{encounter.difficultyLabel}</b></div>
            <div className="zk-encounter-chip"><span>GRÖSSENKLASSE</span><b>{deckSize === "large" ? "GROSS · SCHWER" : "STANDARD"}</b></div>
            <div className="zk-encounter-chip"><span>FAHRWERK</span><b>{drive.label}</b></div>
            <div className="zk-encounter-chip"><span>VERHALTEN</span><b>{behaviorCopy(encounter)}</b></div>
          </div>

          <div className="zk-encounter-capability">
            <span>KÖRPERFÄHIGKEIT</span>
            <b>{body.abilityLabel}</b>
            <p>{body.abilityDescription}</p>
          </div>

          {neutral && (
            <div className="zk-encounter-neutral-protocol">
              <span>NEUTRALER BETRIEB</span>
              <b>KEINE AGGRESSION</b>
              <p>Dieser Droid jagt dich nicht und arbeitet einfach weiter. Bei einer Kollision öffnet sich wie bei jedem Roboter der Scan; du kannst ihn dann in Ruhe lassen oder freiwillig die Übernahme versuchen.</p>
            </div>
          )}

          {forcedEngagement && (
            <div className="zk-encounter-boss-protocol">
              <span>ABFANGPROTOKOLL</span>
              <b>RÜCKZUG BLOCKIERT</b>
              <p>Dieser Droid hat dich aktiv verfolgt und auf Kampfdistanz gestellt. Das Duell muss jetzt ausgetragen werden.</p>
            </div>
          )}

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
              <b>{duelLayers} FIREWALLS · DANACH KERN</b>
              <p>Jede Firewall nutzt nur 8 Reaktorsegmente. Nach beiden Schutzschichten folgt der freigelegte 12-Segment-Kommandokern. Meta-Energie und Körperjoker reichen über den gesamten Kampf.</p>
            </div>
          )}

          <div className="zk-encounter-actions">
            {!forcedEngagement && <button onClick={onCancel}>{neutral ? "IN RUHE LASSEN" : "WEITERFAHREN"}</button>}
            <button className="attack" onClick={onStart}>{encounter.boss ? "KOMMANDODUELL STARTEN" : forcedEngagement ? "ANGRIFF ABWEHREN" : neutral ? "ÜBERNAHME VERSUCHEN" : "DUELL STARTEN"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}