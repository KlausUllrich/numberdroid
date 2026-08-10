import { useEffect, useMemo, useState } from "react";
import { BODIES, PLAYER_NAMES, STARTING_HP } from "../game/catalog";
import type { BattleResult, EncounterConfig, RobotBody } from "../game/types";
import {
  COLS, MODE_INFO, ROWS, TOTAL_CORES, WIN_CORES,
  canAppend, chooseAiPath, findCombinations, freshGrid,
  pathExpression, pathResult, resolveGrid, rewardForLength, shiftRow,
  type Grid, type Pick, type Turn,
} from "./duelEngine";
import "./NumberDuel.css";

type Props = {
  encounter: EncounterConfig;
  playerBody: RobotBody;
  playerCount: number;
  remainingHp: number;
  initialMetaEnergy: number;
  onFinished: (result: BattleResult) => void;
};

type Special = null | "adjust-up" | "adjust-down" | "row-shift";

type ResultCard = {
  outcome?: "win" | "loss";
  title: string;
  detail: string;
};

export function NumberDuel({ encounter, playerBody, playerCount, remainingHp, initialMetaEnergy, onFinished }: Props) {
  const mode = encounter.mode;
  const config = MODE_INFO[mode];
  const enemyBody = BODIES[encounter.bodyId];
  const [grid, setGrid] = useState<Grid>(() => freshGrid(mode));
  const [turn, setTurn] = useState<Turn>("human");
  const [playerIndex, setPlayerIndex] = useState(0);
  const [selection, setSelection] = useState<Pick[]>([]);
  const [enemySelection, setEnemySelection] = useState<Pick[]>([]);
  const [teamCores, setTeamCores] = useState(6);
  const [metaEnergy, setMetaEnergy] = useState(initialMetaEnergy);
  const [abilityUses, setAbilityUses] = useState(playerBody.abilityId === "row-shift-right" ? 1 : 0);
  const [special, setSpecial] = useState<Special>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(`Bilde eine Kette. Rechne selbst, ob sie ${config.target} ergibt.`);
  const [resultCard, setResultCard] = useState<ResultCard | null>(null);

  const activePath = turn === "human" ? selection : enemySelection;
  const activeBody = turn === "human" ? playerBody : enemyBody;
  const nextOptions = useMemo(() => {
    const set = new Set<string>();
    if (turn !== "human" || special || busy || selection.length === 0) return set;
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      if (canAppend(selection, { row: r, col: c })) set.add(`${r}:${c}`);
    }
    return set;
  }, [turn, special, busy, selection]);

  useEffect(() => {
    if (turn !== "enemy" || busy || resultCard) return;
    setBusy(true);
    setMessage(`${encounter.name} sucht eine Kette …`);
    const timer = window.setTimeout(() => {
      const path = chooseAiPath(findCombinations(grid, mode), encounter.difficulty);
      setEnemySelection(path);
      if (!path.length) {
        setMessage(`${encounter.name} passt. Du bist wieder dran.`);
        window.setTimeout(() => finishEnemyTurn(), 700);
        return;
      }
      const enemyReward = rewardForLength(path.length);
      window.setTimeout(() => {
        const next = Math.max(0, teamCores - enemyReward.power);
        const loses = enemyReward.instant || next <= TOTAL_CORES - WIN_CORES;
        setTeamCores(loses ? 0 : next);
        setGrid(resolveGrid(grid, path, mode).grid);
        if (loses) {
          setBusy(false);
          setResultCard({ outcome: "loss", title: "REAKTOR VERLOREN", detail: `${encounter.name} übernimmt den Reaktor.` });
        } else finishEnemyTurn();
      }, 800);
    }, 700);
    return () => window.clearTimeout(timer);
    // One AI action is intentionally scheduled from this turn snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  function finishEnemyTurn() {
    setEnemySelection([]);
    setSelection([]);
    setPlayerIndex((index) => (index + 1) % Math.max(1, playerCount));
    setTurn("human");
    setBusy(false);
    setMessage(`Dein Zug. Ziel: ${config.symbol} ${config.target}.`);
  }

  function selectTile(row: number, col: number) {
    if (turn !== "human" || busy || resultCard) return;
    if (special === "adjust-up" || special === "adjust-down") {
      const delta = special === "adjust-up" ? 1 : -1;
      const old = grid[row][col].value;
      const next = old + delta;
      if (next < 1 || next > config.maxValue) {
        setMessage("Diese Zahl kann in diesem Rechenprotokoll nicht weiter verändert werden.");
        return;
      }
      setGrid((current) => current.map((line, r) => line.map((tile, c) => r === row && c === col ? { ...tile, value: next } : tile)));
      setMetaEnergy((energy) => Math.max(0, energy - 1));
      setSpecial(null);
      setMessage(`Meta-Energie eingesetzt: ${old} → ${next}.`);
      return;
    }
    if (special === "row-shift") {
      setGrid((current) => shiftRow(current, row, "right"));
      setAbilityUses(0);
      setSpecial(null);
      setMessage(`REIHENSCHUB: Reihe ${row + 1} wurde um ein Feld nach rechts verschoben.`);
      return;
    }

    const pick = { row, col };
    const existing = selection.findIndex((item) => item.row === row && item.col === col);
    if (existing >= 0) {
      setSelection(existing === selection.length - 1 ? selection.slice(0, -1) : selection.slice(0, existing + 1));
      return;
    }
    if (selection.length === 0 || canAppend(selection, pick)) {
      setSelection((current) => [...current, pick]);
      return;
    }
    setMessage("Setze die Kette nur an einem orthogonal angrenzenden Feld fort.");
  }

  function startAdjustment(delta: 1 | -1) {
    if (metaEnergy < 1 || turn !== "human" || busy) return;
    setSelection([]);
    setSpecial(delta === 1 ? "adjust-up" : "adjust-down");
    setMessage(`Wähle genau eine Zahl für ${delta > 0 ? "+1" : "−1"}. Kosten: 1 Meta-Energie.`);
  }

  function startAbility() {
    if (playerBody.abilityId !== "row-shift-right" || abilityUses < 1 || busy) return;
    setSelection([]);
    setSpecial("row-shift");
    setMessage("MAGNETAR: Tippe eine Zahl in der Reihe, die nach rechts verschoben werden soll.");
  }

  function submit() {
    if (selection.length < 2 || busy || turn !== "human") return;
    // Correctness is intentionally checked only here. No pre-submit UI depends on it.
    const result = pathResult(selection, grid, mode);
    if (result !== config.target) {
      const next = Math.max(0, teamCores - 1);
      const loses = next <= TOTAL_CORES - WIN_CORES;
      setTeamCores(loses ? 0 : next);
      setResultCard({
        outcome: loses ? "loss" : undefined,
        title: loses ? "REAKTOR VERLOREN" : "ÜBERLADUNG",
        detail: `${pathExpression(selection, grid, mode)} = ${result}. Gesucht war ${config.target}. Die Zahlen bleiben liegen; 1 Reaktorkern geht an den Droiden.`,
      });
      if (!loses) setMessage("Rechenfehler: Das Feld bleibt unverändert.");
      return;
    }

    const gained = rewardForLength(selection.length);
    const next = Math.min(TOTAL_CORES, teamCores + gained.power);
    const wins = gained.instant || next >= WIN_CORES;
    setTeamCores(wins ? TOTAL_CORES : next);
    setGrid(resolveGrid(grid, selection, mode).grid);
    setSelection([]);
    if (wins) {
      setResultCard({ outcome: "win", title: "TRANSFER GEWONNEN", detail: `${encounter.name} wurde besiegt. Der Körpertransfer ist bereit.` });
      return;
    }
    setTurn("enemy");
    setMessage(`${encounter.name} ist dran.`);
  }

  function closeMistake() {
    setResultCard(null);
    setSelection([]);
    setTurn("enemy");
  }

  return (
    <main className="duel-screen">
      <header className="duel-hud">
        <div><small>NUMBERDROID · TRANSFERDUELL</small><b>{encounter.name}</b></div>
        <div className="duel-hp-readout"><small>ROBOTER-HP</small><b>{remainingHp} / {STARTING_HP}</b></div>
      </header>

      <section className="duel-layout">
        <aside className={`active-robot ${turn === "enemy" ? "enemy" : "player"}`}>
          <small>{turn === "enemy" ? "GEGNER · DROIDZUG" : `${PLAYER_NAMES[playerIndex]} · DU BIST DRAN`}</small>
          <img src={activeBody.sprite} alt={activeBody.name} />
          <b>{activeBody.name}</b>
          <span>{turn === "enemy" ? "FEINDLICHER KÖRPER" : activeBody.abilityLabel}</span>
        </aside>

        <section className="number-board-panel">
          <div className="turn-strip"><b>{turn === "enemy" ? "ROTE KETTE" : "GRÜNE KETTE"}</b><span>{message}</span></div>
          <div className="number-grid">
            {grid.flatMap((row, r) => row.map((tile, c) => {
              const index = activePath.findIndex((pick) => pick.row === r && pick.col === c);
              const selected = index >= 0;
              const end = selected && index === activePath.length - 1;
              const next = nextOptions.has(`${r}:${c}`);
              return (
                <button
                  key={tile.id}
                  className={`${selected ? turn === "enemy" ? "enemy-selected" : "selected" : ""} ${end ? "chain-end" : ""} ${next ? "next-option" : ""} ${special ? "special-target" : ""}`}
                  onClick={() => selectTile(r, c)}
                  disabled={turn === "enemy" || busy}
                  aria-label={`Zahl ${tile.value}, Reihe ${r + 1}, Spalte ${c + 1}${end ? ", Kettenende" : ""}`}
                >
                  <span>{tile.value}</span>{selected && <em>{index + 1}</em>}
                </button>
              );
            }))}
          </div>
          <div className="duel-actions">
            <div className="special-actions">
              <button disabled={metaEnergy < 1 || busy || turn !== "human"} onClick={() => startAdjustment(-1)}>⚡ −1</button>
              <button disabled={metaEnergy < 1 || busy || turn !== "human"} onClick={() => startAdjustment(1)}>⚡ +1</button>
              <button disabled={playerBody.abilityId !== "row-shift-right" || abilityUses < 1 || busy || turn !== "human"} onClick={startAbility}>{playerBody.abilityLabel} · {abilityUses}×</button>
              {special && <button onClick={() => setSpecial(null)}>ABBRECHEN</button>}
            </div>
            <button className="submit" disabled={selection.length < 2 || busy || turn !== "human" || Boolean(special)} onClick={submit}>REAKTOR AUSLÖSEN</button>
          </div>
        </section>

        <aside className="reactor-panel-clean">
          <div className="reactor-target" aria-label={`Rechenziel ${config.symbol} ${config.target}`}>
            <small>RECHENZIEL</small>
            <div className="reactor-target-equation"><span>{config.symbol}</span><strong>{config.target}</strong></div>
          </div>
          <div className="core-row" aria-label={`${teamCores} Team-Reaktorkerne, ${TOTAL_CORES - teamCores} Droid-Reaktorkerne`}>
            {Array.from({ length: TOTAL_CORES }, (_, index) => <i key={index} className={index < teamCores ? "team" : "enemy"} />)}
          </div>
          <p className="reactor-rewards">2 Zahlen → +1<br />3 → +2 · 4 → +4<br />5+ → Sofortsieg</p>
          <div className="resource-readout">META-ENERGIE <b>⚡ {metaEnergy}</b></div>
        </aside>
      </section>

      {resultCard && (
        <div className={`duel-result ${resultCard.outcome ?? "mistake"}`} role="dialog" aria-modal="true">
          <section>
            <small>{resultCard.outcome === "win" ? "TRANSFERPROTOKOLL" : "REAKTORMELDUNG"}</small>
            <h2>{resultCard.title}</h2>
            <p>{resultCard.detail}</p>
            {resultCard.outcome === "win" && <button onClick={() => onFinished({ outcome: "win", remainingMetaEnergy: metaEnergy })}>KÖRPERTRANSFER</button>}
            {resultCard.outcome === "loss" && <button onClick={() => onFinished({ outcome: "loss", remainingMetaEnergy: metaEnergy })}>ZURÜCK ZUM DECK</button>}
            {!resultCard.outcome && <button onClick={closeMistake}>WEITER</button>}
          </section>
        </div>
      )}
    </main>
  );
}
