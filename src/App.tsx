import { useCallback, useEffect, useState } from "react";
import { BODIES, STARTING_HP } from "./game/catalog";
import { loadMetaState, restartFloorState, saveMetaState } from "./game/save";
import { useAppFullscreen } from "./game/useFullscreen";
import type { BattleResult, EncounterConfig, GameScreen, MetaState } from "./game/types";
import { DestroyedScreen } from "./game/DestroyedScreen";
import { MetaGame } from "./meta/MetaGame";
import { EncounterPanel } from "./meta/EncounterPanel";
import { NumberDuel } from "./duel/NumberDuel";
import { TransferScreen } from "./transfer/TransferScreen";

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMetaState());
  const [screen, setScreen] = useState<GameScreen>(() => meta.damageTaken >= STARTING_HP ? "destroyed" : "deck");
  const [encounter, setEncounter] = useState<EncounterConfig | null>(null);
  const [transfer, setTransfer] = useState<{ encounter: EncounterConfig; oldBodyId: MetaState["currentBody"] } | null>(null);
  const fullscreen = useAppFullscreen();

  const updateMeta = useCallback((next: MetaState) => setMeta(next), []);
  const remainingHp = Math.max(0, STARTING_HP - meta.damageTaken);

  useEffect(() => {
    const timer = window.setTimeout(() => saveMetaState(meta), 220);
    return () => window.clearTimeout(timer);
  }, [meta]);

  function rotatePilot(state: MetaState) {
    if (state.playerCount <= 1) return state;
    return { ...state, pilotIndex: (state.pilotIndex + 1) % state.playerCount };
  }

  function openEncounter(next: EncounterConfig) {
    setEncounter(next);
    setScreen("encounter");
  }

  function startEncounter() {
    if (!encounter) return;
    setScreen("duel");
  }

  function finishBattle(result: BattleResult) {
    if (!encounter) return;
    const energyState = { ...meta, metaEnergy: result.remainingMetaEnergy };
    if (result.outcome === "win") {
      setMeta(energyState);
      setTransfer({ encounter, oldBodyId: meta.currentBody });
      setScreen("transfer");
      return;
    }

    const damageTaken = Math.min(STARTING_HP, energyState.damageTaken + 1);
    const afterLoss = rotatePilot({
      ...energyState,
      x: encounter.retreat.x,
      y: encounter.retreat.y,
      damageTaken,
    });
    setMeta(afterLoss);
    setEncounter(null);
    setScreen(damageTaken >= STARTING_HP ? "destroyed" : "deck");
  }

  function finishTransfer() {
    if (!transfer) return;
    const target = transfer.encounter;
    const defeated = meta.defeated.includes(target.enemyId) ? meta.defeated : [...meta.defeated, target.enemyId];
    const afterTransfer = rotatePilot({
      ...meta,
      currentBody: target.bodyId,
      defeated,
      x: target.retreat.x,
      y: target.retreat.y,
    });
    setMeta(afterTransfer);
    setTransfer(null);
    setEncounter(null);
    setScreen("deck");
  }

  function restartFloor() {
    setMeta(restartFloorState(meta));
    setTransfer(null);
    setEncounter(null);
    setScreen("deck");
  }

  const showDeck = screen === "deck" || screen === "encounter";

  return (
    <>
      {fullscreen.needsFullscreenPrompt && (
        <div className="zk-app-start-gate">
          <section className="zk-app-start-card" role="dialog" aria-modal="true" aria-labelledby="app-start-title">
            <div className="zk-app-start-mark">ND</div>
            <small>NUMBERDROID · SPIELMODUS</small>
            <h1 id="app-start-title">Im Vollbild spielen</h1>
            <p>Für Deck, Zahlenduell und Körpertransfer wird auf dem Handy derselbe Querformat-Vollbildmodus verwendet.</p>
            <button className="primary" onClick={fullscreen.enterFullscreen}>⛶ &nbsp; VOLLBILD STARTEN</button>
            <button className="secondary" onClick={fullscreen.continueWithoutFullscreen}>OHNE VOLLBILD FORTFAHREN</button>
            {fullscreen.error && <div className="zk-app-start-error">{fullscreen.error}</div>}
          </section>
        </div>
      )}

      <button
        className="app-fullscreen-toggle"
        aria-label={fullscreen.isFullscreen ? "Vollbildmodus verlassen" : "Vollbildmodus starten"}
        onClick={fullscreen.isFullscreen ? fullscreen.exitFullscreen : fullscreen.enterFullscreen}
      >
        {fullscreen.isFullscreen ? "⛶×" : "⛶"}
      </button>

      {showDeck && <MetaGame meta={meta} onMetaChange={updateMeta} onEncounter={openEncounter} paused={screen !== "deck" || fullscreen.needsFullscreenPrompt} />}
      {screen === "encounter" && encounter && <EncounterPanel encounter={encounter} onCancel={() => { setEncounter(null); setScreen("deck"); }} onStart={startEncounter} />}
      {screen === "duel" && encounter && (
        <NumberDuel
          encounter={encounter}
          playerBody={BODIES[meta.currentBody]}
          playerCount={meta.playerCount}
          remainingHp={remainingHp}
          initialMetaEnergy={meta.metaEnergy}
          onFinished={finishBattle}
        />
      )}
      {screen === "transfer" && transfer && (
        <TransferScreen oldBody={BODIES[transfer.oldBodyId]} newBody={BODIES[transfer.encounter.bodyId]} onComplete={finishTransfer} />
      )}
      {screen === "destroyed" && (
        <DestroyedScreen body={BODIES[meta.currentBody]} onRestart={restartFloor} />
      )}
    </>
  );
}
