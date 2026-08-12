import { useMemo, useState } from "react";
import { CAMPAIGN_ACTS, CAMPAIGN_DECKS, campaignDeckPlayable, type CampaignDeck } from "../game/campaign";
import { MATH_START_OPTIONS, TACTICAL_CHALLENGES, type PlayerProfile } from "../game/playerProfile";
import "./CampaignScreen.css";

type Props = {
  profile: PlayerProfile;
  onProfileChange: (profile: PlayerProfile) => void;
  onStartDeck: (deck: CampaignDeck) => void;
};

export function CampaignScreen({ profile, onProfileChange, onStartDeck }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState(CAMPAIGN_DECKS[0].id);
  const selectedDeck = CAMPAIGN_DECKS.find((deck) => deck.id === selectedDeckId) ?? CAMPAIGN_DECKS[0];
  const selectedMath = MATH_START_OPTIONS.find((option) => option.id === profile.mathStartId) ?? MATH_START_OPTIONS[0];
  const selectedTactical = TACTICAL_CHALLENGES.find((option) => option.id === profile.tacticalChallengeId) ?? TACTICAL_CHALLENGES[1];

  const decksByAct = useMemo(() => CAMPAIGN_ACTS.map((act) => ({
    act,
    decks: CAMPAIGN_DECKS.filter((deck) => deck.actId === act.id),
  })), []);

  return (
    <main className="nd-campaign-shell">
      <header className="nd-campaign-header">
        <div>
          <small>NUMBERDROID · KAMPAGNE</small>
          <h1>DAS SCHIFF</h1>
          <p>Ein Schiff. Eine Story. Die Mathematik passt sich deinem Profil an.</p>
        </div>
        <div className="nd-profile-summary">
          <span>{profile.name}</span>
          <b>{selectedMath.example} · {selectedMath.label}</b>
          <small>TAKTIK: {selectedTactical.label}</small>
        </div>
      </header>

      <section className="nd-campaign-layout">
        <div className="nd-ship-panel">
          <div className="nd-ship-title"><span>25 DECKS · PLANUNGSZIEL</span><b>FORTSCHRITT DURCH DAS SCHIFF</b></div>
          <div className="nd-act-list">
            {decksByAct.map(({ act, decks }) => (
              <section key={act.id} className="nd-act-block">
                <div className="nd-act-heading"><b>{act.title}</b><span>{act.subtitle}</span></div>
                <div className="nd-deck-row">
                  {decks.map((deck) => {
                    const playable = campaignDeckPlayable(deck);
                    const selected = selectedDeckId === deck.id;
                    return (
                      <button
                        key={deck.id}
                        className={`nd-deck-node ${selected ? "selected" : ""} ${playable ? "playable" : "future"}`}
                        onClick={() => setSelectedDeckId(deck.id)}
                      >
                        <small>{String(deck.order).padStart(2, "0")}</small>
                        <b>{deck.order === 1 ? "B2" : deck.order === 2 ? "C3" : "—"}</b>
                        <span>{playable ? "BEREIT" : deck.order === 2 ? "NÄCHSTER PROTOTYP" : "GESPERRT"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="nd-campaign-side">
          <section className="nd-campaign-card deck-detail">
            <small>DECK {String(selectedDeck.order).padStart(2, "0")} · {selectedDeck.mathPressure.toUpperCase()}</small>
            <h2>{selectedDeck.title}</h2>
            <h3>{selectedDeck.subtitle}</h3>
            <p>{selectedDeck.intro}</p>
            {selectedDeck.mechanics.length > 0 && (
              <div className="nd-mechanics">
                {selectedDeck.mechanics.map((mechanic) => <span key={mechanic}>{mechanic}</span>)}
              </div>
            )}
            <button
              className="nd-primary"
              disabled={!campaignDeckPlayable(selectedDeck)}
              onClick={() => onStartDeck(selectedDeck)}
            >
              {campaignDeckPlayable(selectedDeck) ? "DECK BETRETEN" : selectedDeck.order === 2 ? "NOCH IN ENTWICKLUNG" : "NOCH NICHT FREIGESCHALTET"}
            </button>
          </section>

          <section className="nd-campaign-card">
            <small>MATHE-STARTPUNKT · JEDERZEIT ÄNDERBAR</small>
            <div className="nd-math-options">
              {MATH_START_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={profile.mathStartId === option.id ? "selected" : ""}
                  onClick={() => onProfileChange({ ...profile, mathStartId: option.id })}
                >
                  <b>{option.example}</b>
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
            <p className="nd-family-note">Unsicher? Einfach mit kleinen Zahlen starten. Schwache Droiden bleiben auch später Teil des Spiels; stärkere Droiden und spätere Decks erweitern die Herausforderung.</p>
          </section>

          <section className="nd-campaign-card compact">
            <small>TAKTISCHE HERAUSFORDERUNG · UNABHÄNGIG VON MATHE</small>
            <div className="nd-tactical-options">
              {TACTICAL_CHALLENGES.map((option) => (
                <button
                  key={option.id}
                  className={profile.tacticalChallengeId === option.id ? "selected" : ""}
                  onClick={() => onProfileChange({ ...profile, tacticalChallengeId: option.id })}
                >
                  <b>{option.label}</b><span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
