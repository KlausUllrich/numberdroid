import { campaignDeckPlayable, type CampaignDeck } from "../game/campaign";
import "./CampaignScreen.css";

type Props = {
  deck: CampaignDeck;
  nextDeck: CampaignDeck | null;
  onShip: () => void;
  onNext: (deck: CampaignDeck) => void;
};

export function CampaignSuccessScreen({ deck, nextDeck, onShip, onNext }: Props) {
  return (
    <main className="nd-campaign-shell nd-success-shell">
      <section className="nd-success-card">
        <small>DECK GESICHERT · KAMPAGNENFORTSCHRITT</small>
        <div className="nd-success-mark">✓</div>
        <h1>{deck.title} ÜBERNOMMEN</h1>
        <h2>{deck.subtitle}</h2>
        <p>{deck.outro}</p>

        {nextDeck && (
          <div className="nd-next-deck">
            <small>NÄCHSTER BEREICH FREIGESCHALTET</small>
            <b>{nextDeck.title} · {nextDeck.subtitle}</b>
            <span>{nextDeck.intro}</span>
          </div>
        )}

        <div className="nd-success-actions">
          <button onClick={onShip}>ZUM SCHIFF</button>
          {nextDeck && campaignDeckPlayable(nextDeck) && (
            <button className="nd-primary" onClick={() => onNext(nextDeck)}>NÄCHSTES DECK</button>
          )}
        </div>
      </section>
    </main>
  );
}
