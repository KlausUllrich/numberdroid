import { useMemo, useState } from "react";
import { STARTING_HP } from "../game/catalog";
import {
  CAMPAIGN_ACTS,
  CAMPAIGN_DECKS,
  campaignDeckPlayable,
  getCampaignDeck,
  type CampaignAct,
  type CampaignDeck,
} from "../game/campaign";
import type { AppSettings } from "../game/appSettings";
import {
  MATH_START_OPTIONS,
  TACTICAL_CHALLENGES,
  type MathStartId,
  type PlayerAudience,
  type PlayerProfile,
} from "../game/playerProfile";
import type { MetaState } from "../game/types";
import "./MenuFlow.css";

export type NewProfileDraft = {
  name: string;
  audience: PlayerAudience;
  mathStartId: MathStartId;
};

type IntroProps = { onContinue: () => void };

export function IntroScreen({ onContinue }: IntroProps) {
  return (
    <main className="nd-menu-screen nd-intro-screen" onClick={onContinue}>
      <div className="nd-intro-glow" />
      <section className="nd-intro-card">
        <div className="nd-logo-mark">ND</div>
        <h1>NUMBERDROID</h1>
        <p>ÜBERNEHMEN · RECHNEN · WEITERKOMMEN</p>
        <button onClick={(event) => { event.stopPropagation(); onContinue(); }}>WEITER</button>
      </section>
    </main>
  );
}

type TitleProps = {
  profiles: PlayerProfile[];
  activeProfile: PlayerProfile;
  onContinue: () => void;
  onCycleProfile: () => void;
  onNewProfile: () => void;
  onSettings: () => void;
};

export function TitleScreen({ profiles, activeProfile, onContinue, onCycleProfile, onNewProfile, onSettings }: TitleProps) {
  const hasProfiles = profiles.length > 0;
  return (
    <main className="nd-menu-screen nd-title-screen">
      <section className="nd-title-brand">
        <div className="nd-title-orbit" aria-hidden="true"><i /><i /><i /></div>
        <small>FAMILIEN-ABENTEUER</small>
        <h1>NUMBER<br />DROID</h1>
        <p>Übernimm Droiden. Knacke den Zahlenkern. Finde heraus, was dieses Schiff verbirgt.</p>
      </section>

      <section className="nd-title-menu" aria-label="Hauptmenü">
        {hasProfiles && (
          <div className="nd-title-continue-row">
            <button className="nd-menu-primary" onClick={onContinue}>
              <small>FORTSETZEN</small>
              <b>{activeProfile.name}</b>
            </button>
            {profiles.length > 1 && (
              <button className="nd-profile-cycle" onClick={onCycleProfile} aria-label="Profil wechseln">
                ⇄<small>PROFIL</small>
              </button>
            )}
          </div>
        )}
        <button className={hasProfiles ? "nd-menu-secondary" : "nd-menu-primary"} onClick={onNewProfile}>
          <small>{hasProfiles ? "WEITERER SPIELER" : "LOS GEHT'S"}</small>
          <b>NEUES PROFIL</b>
        </button>
        <button className="nd-menu-secondary compact" onClick={onSettings}>EINSTELLUNGEN</button>
      </section>
    </main>
  );
}

type ProfileWizardProps = {
  onComplete: (draft: NewProfileDraft) => void;
  onCancel: () => void;
};

export function ProfileWizardScreen({ onComplete, onCancel }: ProfileWizardProps) {
  const [step, setStep] = useState<"audience" | "name" | "math">("audience");
  const [audience, setAudience] = useState<PlayerAudience>("child");
  const [name, setName] = useState("");
  const [mathStartId, setMathStartId] = useState<MathStartId>("small");
  const supportedMath = MATH_START_OPTIONS.filter((option) => ["small", "to20", "to100"].includes(option.id));

  function finish() {
    const cleanName = name.trim().slice(0, 24);
    if (!cleanName) return;
    onComplete({
      name: cleanName,
      audience,
      mathStartId: audience === "adult" ? "to100" : mathStartId,
    });
  }

  return (
    <main className="nd-menu-screen nd-wizard-screen">
      <section className="nd-wizard-card">
        <header>
          <button className="nd-back-link" onClick={onCancel}>← HAUPTMENÜ</button>
          <div><small>NEUES PROFIL</small><h1>WER SPIELT?</h1></div>
          <span className="nd-step-indicator">{step === "audience" ? "1" : step === "name" ? "2" : "3"}/3</span>
        </header>

        {step === "audience" && (
          <div className="nd-wizard-content">
            <h2>Ist dieses Profil für ein Kind oder einen Erwachsenen?</h2>
            <p>Bei Kindern fragen wir danach kurz nach dem aktuellen Rechenstand. Das ist kein Test.</p>
            <div className="nd-audience-grid">
              <button onClick={() => { setAudience("child"); setStep("name"); }}><b>KIND</b><span>Das Spiel startet passend zum aktuellen Rechenstand.</span></button>
              <button onClick={() => { setAudience("adult"); setStep("name"); }}><b>ERWACHSENER</b><span>Direkter Einstieg mit einem höheren Rechen-Startpunkt.</span></button>
            </div>
          </div>
        )}

        {step === "name" && (
          <div className="nd-wizard-content nd-name-step">
            <h2>Wie heißt du?</h2>
            <p>Der Name erscheint in deinem Hub und gehört zu deinem eigenen Fortschritt.</p>
            <input autoFocus maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="NAME" onKeyDown={(event) => {
              if (event.key !== "Enter" || !name.trim()) return;
              if (audience === "child") setStep("math"); else finish();
            }} />
            <button className="nd-menu-primary" disabled={!name.trim()} onClick={() => audience === "child" ? setStep("math") : finish()}>
              <b>{audience === "child" ? "WEITER" : "PROFIL ERSTELLEN"}</b>
            </button>
          </div>
        )}

        {step === "math" && (
          <div className="nd-wizard-content nd-math-step">
            <h2>Was klappt schon ganz gut?</h2>
            <p>Wähle ungefähr. Einfache Aufgaben bleiben später trotzdem im Spiel, und wir können den Bereich mit der Zeit fein anpassen.</p>
            <div className="nd-wizard-math-grid">
              {supportedMath.map((option) => (
                <button key={option.id} className={mathStartId === option.id ? "selected" : ""} onClick={() => setMathStartId(option.id)}>
                  <strong>{option.example}</strong><b>{option.label}</b><span>{option.description}</span>
                </button>
              ))}
            </div>
            <div className="nd-wizard-actions">
              <button className="nd-menu-secondary" onClick={() => setStep("name")}>ZURÜCK</button>
              <button className="nd-menu-primary" onClick={finish}><b>PROFIL ERSTELLEN</b></button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

type SettingsProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onBack: () => void;
};

export function SettingsScreen({ settings, onChange, onBack }: SettingsProps) {
  return (
    <main className="nd-menu-screen nd-settings-screen">
      <section className="nd-settings-card">
        <button className="nd-back-link" onClick={onBack}>← HAUPTMENÜ</button>
        <small>EINSTELLUNGEN</small>
        <h1>SYSTEM</h1>
        <div className="nd-setting-row">
          <div><b>LAUTSTÄRKE</b><span>Master-Lautstärke</span></div>
          <input type="range" min="0" max="1" step="0.05" value={settings.masterVolume} onChange={(event) => onChange({ ...settings, masterVolume: Number(event.target.value) })} />
          <strong>{Math.round(settings.masterVolume * 100)}%</strong>
        </div>
        <div className="nd-setting-row">
          <div><b>SPRACHE</b><span>Weitere Sprachen werden über dasselbe System ergänzt.</span></div>
          <button className="nd-language-choice">DEUTSCH</button>
          <strong>DE</strong>
        </div>
      </section>
    </main>
  );
}

function currentMission(profile: PlayerProfile) {
  if (profile.currentCampaignDeckId) {
    const running = getCampaignDeck(profile.currentCampaignDeckId);
    if (!profile.completedDeckIds.includes(running.id) && profile.unlockedDeckIds.includes(running.id) && campaignDeckPlayable(running)) return running;
  }
  return CAMPAIGN_DECKS.find((deck) => (
    profile.unlockedDeckIds.includes(deck.id)
    && !profile.completedDeckIds.includes(deck.id)
    && campaignDeckPlayable(deck)
  )) ?? null;
}

function activeActFor(profile: PlayerProfile, mission: CampaignDeck | null): CampaignAct {
  if (mission) return CAMPAIGN_ACTS.find((act) => act.id === mission.actId) ?? CAMPAIGN_ACTS[0];
  const lastCompleted = [...profile.completedDeckIds]
    .map((id) => getCampaignDeck(id))
    .sort((a, b) => b.order - a.order)[0];
  return CAMPAIGN_ACTS.find((act) => act.id === lastCompleted?.actId) ?? CAMPAIGN_ACTS[0];
}

function actDisplayName(act: CampaignAct) {
  const pieces = act.title.split("·");
  return (pieces.length > 1 ? pieces.slice(1).join("·") : act.title).trim();
}

type HubPanel = "none" | "collection" | "achievements" | "story" | "stats";

type HubProps = {
  profile: PlayerProfile;
  meta: MetaState;
  notice?: string;
  onStartMission: (deck: CampaignDeck) => void;
  onMainMenu: () => void;
};

export function HubScreen({ profile, meta, notice, onStartMission, onMainMenu }: HubProps) {
  const [panel, setPanel] = useState<HubPanel>("none");
  const mission = currentMission(profile);
  const act = activeActFor(profile, mission);
  const actDecks = CAMPAIGN_DECKS.filter((deck) => deck.actId === act.id);
  const completedInAct = actDecks.filter((deck) => profile.completedDeckIds.includes(deck.id));
  const math = MATH_START_OPTIONS.find((entry) => entry.id === profile.mathStartId) ?? MATH_START_OPTIONS[0];
  const tactical = TACTICAL_CHALLENGES.find((entry) => entry.id === profile.tacticalChallengeId) ?? TACTICAL_CHALLENGES[1];
  const resume = Boolean(
    mission
    && profile.currentCampaignDeckId === mission.id
    && mission.floorId === meta.floorId
    && meta.damageTaken < STARTING_HP,
  );
  const completedStories = useMemo(() => profile.completedDeckIds.map((id) => getCampaignDeck(id)), [profile.completedDeckIds]);

  return (
    <main className="nd-menu-screen nd-hub-screen">
      <header className="nd-hub-header">
        <div><small>{profile.name} · AKTUELLER BEREICH</small><h1>{actDisplayName(act)}</h1></div>
        <button onClick={onMainMenu}>HAUPTMENÜ</button>
      </header>

      <section className="nd-hub-main">
        <div className="nd-hub-world">
          <div className="nd-space-dust" aria-hidden="true" />
          <div className="nd-ship-silhouette" aria-label="Raumschiff im aktuellen Kampagnenbereich">
            <div className="nd-ship-nose" /><div className="nd-ship-body" /><div className="nd-ship-engine" />
            <div className="nd-act-progress">
              {actDecks.map((deck, index) => {
                const complete = profile.completedDeckIds.includes(deck.id);
                const current = mission?.id === deck.id;
                return <span key={deck.id} className={`${complete ? "complete" : ""} ${current ? "current" : ""}`} style={{ left: `${12 + index * 19}%` }}><i />{deck.floorId && <b>{deck.order === 1 ? "B2" : deck.order === 2 ? "C3" : "•"}</b>}</span>;
              })}
            </div>
          </div>
          <div className="nd-hub-location-copy">
            <small>FORTSCHRITT IN DIESEM BEREICH</small>
            <b>{completedInAct.length} ABSCHNITTE GESICHERT</b>
            <span>{act.subtitle}</span>
          </div>
          {notice && <div className="nd-hub-notice">{notice}</div>}
        </div>

        <aside className="nd-hub-console">
          {panel === "none" ? (
            <>
              <section className="nd-next-mission-card">
                <small>{resume ? "LAUFENDE MISSION" : "NÄCHSTE MISSION"}</small>
                <h2>{mission ? `${mission.title} · ${mission.subtitle}` : "BEREICH GESICHERT"}</h2>
                <p>{mission?.intro ?? "Hier gibt es im aktuellen Prototyp keine weitere spielbare Mission."}</p>
                <button className="nd-menu-primary" disabled={!mission} onClick={() => mission && onStartMission(mission)}>
                  <b>{resume ? "MISSION FORTSETZEN" : mission ? "MISSION STARTEN" : "KEINE MISSION VERFÜGBAR"}</b>
                </button>
              </section>
              <div className="nd-hub-links">
                <button onClick={() => setPanel("collection")}><b>SAMMLUNG</b><span>Funde & Droiden</span></button>
                <button onClick={() => setPanel("achievements")}><b>ERFOLGE</b><span>Meilensteine</span></button>
                <button onClick={() => setPanel("story")}><b>LOGBUCH</b><span>Story nachlesen</span></button>
                <button onClick={() => setPanel("stats")}><b>STATISTIK</b><span>Mathe & Spielprofil</span></button>
              </div>
            </>
          ) : (
            <section className="nd-hub-panel">
              <button className="nd-back-link" onClick={() => setPanel("none")}>← HUB</button>
              {panel === "collection" && <><small>SAMMLUNG</small><h2>DEINE FUNDE</h2><p>Hier werden später besondere Droiden, Gegenstände und seltene Funde aus der Kampagne dauerhaft gesammelt.</p><div className="nd-empty-vault">SAMMLUNG WIRD MIT KAMPAGNENFUNDEN GEFÜLLT</div></>}
              {panel === "achievements" && <><small>ERFOLGE</small><h2>MEILENSTEINE</h2><div className="nd-achievement-list"><span className={profile.completedDeckIds.length >= 1 ? "earned" : ""}>ERSTES DECK GESICHERT</span><span className={profile.completedDeckIds.includes("campaign-c3") ? "earned" : ""}>VERSORGUNGSRING GEÖFFNET</span></div></>}
              {panel === "story" && <><small>LOGBUCH</small><h2>BISHERIGE STORY</h2>{completedStories.length ? completedStories.map((deck) => <div className="nd-story-entry" key={deck.id}><b>{deck.title}</b><span>{deck.outro}</span></div>) : <p>Noch keine Mission abgeschlossen.</p>}</>}
              {panel === "stats" && <><small>STATISTIK</small><h2>{profile.name}</h2><div className="nd-stat-grid"><span><small>PROFIL</small><b>{profile.audience === "child" ? "KIND" : "ERWACHSENER"}</b></span><span><small>MATHE-STARTPUNKT</small><b>{math.example} · {math.label}</b></span><span><small>TAKTIK</small><b>{tactical.label}</b></span><span><small>GESICHERTE MISSIONEN</small><b>{profile.completedDeckIds.length}</b></span></div><p>Die spätere Lernstatistik soll offen zeigen, welche Rechenbereiche sicher sind und warum das Spiel seine konkrete Aufgabenspanne anpasst.</p></>}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
