import { BODIES } from "../game/catalog";
import { CharacterGroundingLayer } from "./CharacterGroundingLayer";
import "./MetaGameMotion.css";
import "./CharacterGroundingFixture.css";

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function CharacterGroundingFixture() {
  const sprite = BODIES.pico.directionalSprite;

  return (
    <main className="zk-grounding-fixture" aria-label="Character grounding browser fixture">
      {DIRECTIONS.map((name, index) => (
        <section className="zk-grounding-card" data-direction={name} key={name}>
          <span className="zk-grounding-card-label">{index} · {name}</span>
          <div className="zk-meta-world zk-grounding-card-world">
            <div className={`zk-player standard dir-${index}`}>
              <CharacterGroundingLayer />
              <span
                className="zk-directional-sprite"
                style={{ backgroundImage: `url(${sprite})` }}
                aria-label={`PICO ${name}`}
                role="img"
              />
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
