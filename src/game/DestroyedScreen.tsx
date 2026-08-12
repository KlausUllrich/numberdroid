import { STARTING_HP } from "./catalog";
import type { RobotBody } from "./types";
import "./DestroyedScreen.css";

type Props = {
  body: RobotBody;
  onRestart: () => void;
};

export function DestroyedScreen({ body, onRestart }: Props) {
  return (
    <main className="destroyed-screen">
      <section className="destroyed-card" role="dialog" aria-modal="true" aria-labelledby="destroyed-title">
        <small>SYSTEMKRITISCH · HP 0/{STARTING_HP}</small>
        <h1 id="destroyed-title">ROBOTER ZERSTÖRT</h1>
        <div className="destroyed-robot-frame">
          <img src={body.sprite} alt={`${body.name} zerstört`} />
        </div>
        <h2>{body.name}</h2>
        <p>Keine Strukturpunkte mehr. Der aktuelle Floor muss neu gestartet werden.</p>
        <button onClick={onRestart}>FLOOR NEU STARTEN</button>
      </section>
    </main>
  );
}
