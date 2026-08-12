import type { CampaignDeck } from "../game/campaign";
import "./CampaignScreen.css";

type Props = {
  deck: CampaignDeck;
  onHub: () => void;
};

export function CampaignSuccessScreen({ deck, onHub }: Props) {
  return (
    <main className="nd-campaign-shell nd-success-shell">
      <section className="nd-success-card">
        <small>MISSION ERFOLGREICH · STORY</small>
        <div className="nd-success-mark">✓</div>
        <h1>{deck.title} GESICHERT</h1>
        <h2>{deck.subtitle}</h2>
        <p>{deck.outro}</p>
        <div className="nd-success-actions">
          <button className="nd-primary" onClick={onHub}>WEITER ZUM HUB</button>
        </div>
      </section>
    </main>
  );
}
