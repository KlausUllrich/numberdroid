import { useEffect, useMemo, useRef, useState } from "react";
import { BODIES, PLAYER_NAMES, STARTING_HP } from "../game/catalog";
import type { BattleResult, EncounterConfig, RobotBody } from "../game/types";
import {
  COLS, MODE_INFO, ROWS, TOTAL_CORES, WIN_CORES,
  canAppend, chooseAiPath, findCombinations, freshGrid,
  pathExpression, pathResult, resolveGrid, rewardForLength, shiftRow,
  type Grid, type MotionStyle, type Pick, type Turn,
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
type EnemyMood = "idle" | "thinking" | "confused";
type PilotMotion = "idle" | "exit" | "enter";

type ResultCard = {
  outcome?: "win" | "loss";
  title: string;
  detail: string;
};

type ReactorProfile = {
  total: number;
  win: number;
  start: number;
};

const TILE_MOTION_MS = 560;
const FIREWALL_BREAK_MS = 1050;
const PILOT_SWAP_MS = 230;
const NORMAL_REACTOR: ReactorProfile = { total: TOTAL_CORES, win: WIN_CORES, start: 6 };
const FIREWALL_REACTOR: ReactorProfile = { total: 8, win: 7, start: 4 };

function chargeLabel(length: number, isFirewallPhase: boolean, coreExposed: boolean) {
  if (length < 2) return length === 1 ? "WEITER VERKETTEN" : "BEREIT";
  if (length === 2) return "+1";
  if (length === 3) return "+2";
  if (length === 4) return "+4";
  if (isFirewallPhase) return "FIREWALL-BRUCH";
  if (coreExposed) return "KERNÜBERNAHME";
  return "SOFORTSIEG";
}

function chargeTier(length: number) {
  if (length >= 5) return "instant";
  if (length === 4) return "four";
  if (length === 3) return "two";
  if (length === 2) return "one";
  return "idle";
}

export function NumberDuel({ encounter, playerBody, playerCount, remainingHp, initialMetaEnergy, onFinished }: Props) {
  const math = encounter.mathConfig ?? MODE_INFO[encounter.mode];
  const config = math;
  const enemyBody = BODIES[encounter.bodyId];
  const totalLayers = Math.max(1, encounter.duelLayers ?? 1);
  const hasFinalCorePhase = Boolean(encounter.boss && encounter.enemyId === "kronos" && totalLayers > 1);
  const initialReactor = hasFinalCorePhase ? FIREWALL_REACTOR : NORMAL_REACTOR;
  const gridRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<Grid>(() => freshGrid(math));
  const [turn, setTurn] = useState<Turn>("human");
  const [playerIndex, setPlayerIndex] = useState(0);
  const [selection, setSelection] = useState<Pick[]>([]);
  const [enemySelection, setEnemySelection] = useState<Pick[]>([]);
  const [teamCores, setTeamCores] = useState(initialReactor.start);
  const [clearedLayers, setClearedLayers] = useState(0);
  const [breakingLayer, setBreakingLayer] = useState<number | null>(null);
  const [metaEnergy, setMetaEnergy] = useState(initialMetaEnergy);
  const [abilityUses, setAbilityUses] = useState(playerBody.abilityId === "row-shift-right" ? 1 : 0);
  const [special, setSpecial] = useState<Special>(null);
  const [busy, setBusy] = useState(false);
  const [enemyMood, setEnemyMood] = useState<EnemyMood>("idle");
  const [pilotMotion, setPilotMotion] = useState<PilotMotion>("idle");
  const [message, setMessage] = useState(`Bilde eine Kette. Rechne selbst, ob sie ${config.target} ergibt.`);
  const [resultCard, setResultCard] = useState<ResultCard | null>(null);
  const [fallOffsets, setFallOffsets] = useState<Record<number, number>>({});
  const [rowShiftOffsets, setRowShiftOffsets] = useState<Record<number, number>>({});

  const activePath = turn === "human" ? selection : enemySelection;
  const activeBody = turn === "human" ? playerBody : enemyBody;
  const coreExposed = hasFinalCorePhase && clearedLayers >= totalLayers;
  const isFirewallPhase = hasFinalCorePhase && !coreExposed;
  const reactor = isFirewallPhase ? FIREWALL_REACTOR : NORMAL_REACTOR;
  const activeChargeLength = turn === "human" ? selection.length : enemySelection.length;
  const chargeReward = rewardForLength(activeChargeLength);
  const chargeText = chargeLabel(activeChargeLength, isFirewallPhase, coreExposed);
  const chargeClass = chargeTier(activeChargeLength);

  const nextOptions = useMemo(() => {
    const set = new Set<string>();
    if (turn !== "human" || special || busy || selection.length === 0) return set;
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      if (canAppend(selection, { row: r, col: c })) set.add(`${r}:${c}`);
    }
    return set;
  }, [turn, special, busy, selection]);

  function gridColumnStep() {
    const element = gridRef.current;
    if (!element) return 110;
    const gap = Number.parseFloat(window.getComputedStyle(element).columnGap) || 0;
    const width = Math.max(1, (element.clientWidth - gap * (COLS - 1)) / COLS);
    return width + gap;
  }

  function animateResolvedGrid(path: Pick[], onSettled: () => void) {
    const resolution = resolveGrid(grid, path, math);
    const element = gridRef.current;
    let rowStep = 72;
    if (element) {
      const rowGap = Number.parseFloat(window.getComputedStyle(element).rowGap) || 0;
      const rowHeight = Math.max(1, (element.clientHeight - rowGap * (ROWS - 1)) / ROWS);
      rowStep = rowHeight + rowGap;
    }

    const offsets: Record<number, number> = {};
    for (const [id, rows] of Object.entries(resolution.fallRows)) {
      if (rows > 0) offsets[Number(id)] = rows * rowStep;
    }

    setBusy(true);
    setGrid(resolution.grid);
    setFallOffsets(offsets);
    setSelection([]);
    setEnemySelection([]);
    window.setTimeout(() => {
      setFallOffsets({});
      onSettled();
    }, TILE_MOTION_MS);
  }

  function animateRowShift(row: number) {
    const rowTiles = grid[row];
    const colStep = gridColumnStep();
    const offsets: Record<number, number> = {};
    rowTiles.forEach((tile, col) => {
      offsets[tile.id] = col === COLS - 1 ? colStep * (COLS - 1) : -colStep;
    });

    setBusy(true);
    setAbilityUses(0);
    setSpecial(null);
    setRowShiftOffsets(offsets);
    setGrid((current) => shiftRow(current, row, "right"));
    setMessage(`REIHENSCHUB: Reihe ${row + 1} wird um ein Feld nach rechts verschoben.`);
    window.setTimeout(() => {
      setRowShiftOffsets({});
      setBusy(false);
      setMessage(`REIHENSCHUB abgeschlossen. Reihe ${row + 1} wurde nach rechts verschoben.`);
    }, TILE_MOTION_MS);
  }

  function beginEnemyTurn() {
    setSelection([]);
    setSpecial(null);
    if (playerCount <= 1) {
      setTurn("enemy");
      setBusy(false);
      setMessage(`${encounter.name} ist dran.`);
      return;
    }

    setPilotMotion("exit");
    setBusy(true);
    setMessage(`${PLAYER_NAMES[playerIndex]} gibt den Reaktor weiter …`);
    window.setTimeout(() => {
      setPilotMotion("idle");
      setTurn("enemy");
      setBusy(false);
      setMessage(`${encounter.name} ist dran.`);
    }, PILOT_SWAP_MS);
  }

  function breakFirewall(layerIndex: number) {
    const nextClearedLayers = layerIndex + 1;
    setBreakingLayer(layerIndex);
    setBusy(true);
    setMessage(`FIREWALL ${nextClearedLayers} kollabiert …`);
    window.setTimeout(() => {
      setBreakingLayer(null);
      setClearedLayers(nextClearedLayers);

      if (nextClearedLayers < totalLayers) {
        setTeamCores(FIREWALL_REACTOR.start);
        setGrid(freshGrid(math));
        setTurn("enemy");
        setBusy(false);
        setMessage(`FIREWALL ${nextClearedLayers} GEBROCHEN. Die nächste 8-Segment-Schutzschicht ist aktiv. Ressourcen bleiben verbraucht.`);
        return;
      }

      if (hasFinalCorePhase) {
        setTeamCores(NORMAL_REACTOR.start);
        setGrid(freshGrid(math));
        setSelection([]);
        setEnemySelection([]);
        setTurn("human");
        setPilotMotion("idle");
        setBusy(false);
        setMessage("BEIDE FIREWALLS ZERSTÖRT. KRONOS' 12-SEGMENT-KOMMANDOKERN IST FREIGELEGT — jetzt den Kern übernehmen!");
        return;
      }

      setBusy(false);
      setResultCard({
        outcome: "win",
        title: "KOMMANDOKERN OFFEN",
        detail: `${encounter.name}: Alle ${totalLayers} Reaktor-Firewalls sind zerstört. Der Körpertransfer ist bereit.`,
      });
    }, FIREWALL_BREAK_MS);
  }

  useEffect(() => {
    if (turn !== "enemy" || busy || resultCard) return;
    const timers: number[] = [];
    const later = (delay: number, callback: () => void) => {
      const timer = window.setTimeout(callback, delay);
      timers.push(timer);
    };

    setBusy(true);
    setEnemyMood("thinking");
    setMessage(`${encounter.name} rechnet …`);
    later(560, () => setMessage(`${encounter.name} prüft die Zahlen noch einmal …`));
    later(1080, () => {
      const path = chooseAiPath(findCombinations(grid, math), encounter.difficulty);
      setEnemySelection(path);
      if (!path.length) {
        setEnemyMood("confused");
        setMessage(`${encounter.name} setzt an … und zieht den Greifer wieder zurück.`);
        later(650, () => setMessage(`${encounter.name}: „Moment. Das sah eben noch richtig aus …“`));
        later(1450, () => {
          setEnemyMood("idle");
          finishEnemyTurn();
        });
        return;
      }

      setEnemyMood("idle");
      setMessage(`${encounter.name} hat eine Kette gefunden.`);
      const enemyReward = rewardForLength(path.length);
      later(820, () => {
        const next = Math.max(0, teamCores - enemyReward.power);
        const loses = enemyReward.instant || next <= reactor.total - reactor.win;
        setTeamCores(loses ? 0 : next);
        animateResolvedGrid(path, () => {
          if (loses) {
            setBusy(false);
            setResultCard({ outcome: "loss", title: "REAKTOR VERLOREN", detail: `${encounter.name} übernimmt den Reaktor.` });
          } else finishEnemyTurn();
        });
      });
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // One AI action is intentionally scheduled from this turn snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  function finishEnemyTurn() {
    setEnemySelection([]);
    setSelection([]);
    setEnemyMood("idle");
    const nextPlayerIndex = (playerIndex + 1) % Math.max(1, playerCount);
    setPlayerIndex(nextPlayerIndex);
    setTurn("human");
    setBusy(false);
    if (playerCount > 1) {
      setPilotMotion("enter");
      window.setTimeout(() => setPilotMotion("idle"), 300);
      setMessage(`${PLAYER_NAMES[nextPlayerIndex]} übernimmt. Ziel: ${config.symbol} ${config.target}.`);
    } else {
      setPilotMotion("idle");
      setMessage(`Dein Zug. Ziel: ${config.symbol} ${config.target}.`);
    }
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
      animateRowShift(row);
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
    const result = pathResult(selection, grid, math);
    if (result !== config.target) {
      const next = Math.max(0, teamCores - 1);
      const loses = next <= reactor.total - reactor.win;
      setTeamCores(loses ? 0 : next);
      setResultCard({
        outcome: loses ? "loss" : undefined,
        title: loses ? "REAKTOR VERLOREN" : "ÜBERLADUNG",
        detail: `${pathExpression(selection, grid, math)} = ${result}. Gesucht war ${config.target}. Die Zahlen bleiben liegen; 1 Reaktorsegment geht an den Droiden.`,
      });
      if (!loses) setMessage("Rechenfehler: Das Feld bleibt unverändert.");
      return;
    }

    const gained = rewardForLength(selection.length);
    const next = Math.min(reactor.total, teamCores + gained.power);
    const winsCurrentLayer = gained.instant || next >= reactor.win;
    setTeamCores(winsCurrentLayer ? reactor.total : next);
    animateResolvedGrid(selection, () => {
      if (winsCurrentLayer) {
        if (totalLayers > 1 && !coreExposed) {
          breakFirewall(clearedLayers);
          return;
        }
        setBusy(false);
        setResultCard({
          outcome: "win",
          title: coreExposed ? "KOMMANDOKERN ÜBERNOMMEN" : "TRANSFER GEWONNEN",
          detail: coreExposed
            ? `${encounter.name}: Der freigelegte Kommandokern ist besiegt. Der Körpertransfer ist bereit.`
            : `${encounter.name} wurde besiegt. Der Körpertransfer ist bereit.`,
        });
        return;
      }
      beginEnemyTurn();
    });
  }

  function closeMistake() {
    setResultCard(null);
    setSelection([]);
    beginEnemyTurn();
  }

  const robotMotionClass = turn === "human"
    ? pilotMotion === "exit" ? "pilot-exit" : pilotMotion === "enter" ? "pilot-enter" : ""
    : enemyMood === "thinking" ? "enemy-thinking" : enemyMood === "confused" ? "enemy-confused" : "";

  return (
    <main className="duel-screen">
      <header className="duel-hud">
        <div><small>NUMBERDROID · {totalLayers > 1 ? "KOMMANDODUELL" : "TRANSFERDUELL"}</small><b>{encounter.name}</b></div>
        {totalLayers > 1 && (
          <div className="duel-layer-hud">
            <small>{coreExposed ? "KOMMANDOKERN" : "SCHUTZSCHICHTEN"}</small>
            <b>{coreExposed ? "OFFEN" : `${totalLayers - clearedLayers} / ${totalLayers}`}</b>
          </div>
        )}
        <div className="duel-hp-readout"><small>ROBOTER-HP</small><b>{remainingHp} / {STARTING_HP}</b></div>
      </header>

      <section className="duel-layout">
        <aside className={`active-robot ${turn === "enemy" ? "enemy" : "player"} ${robotMotionClass}`}>
          <small>{turn === "enemy" ? "GEGNER · DROIDZUG" : `${PLAYER_NAMES[playerIndex]} · DU BIST DRAN`}</small>
          <img src={activeBody.sprite} alt={activeBody.name} />
          <b>{activeBody.name}</b>
          <span>{turn === "enemy" ? enemyMood === "confused" ? "RECHENKERN VERWIRRT" : enemyMood === "thinking" ? "RECHENKERN ANALYSIERT" : "FEINDLICHER KÖRPER" : activeBody.abilityLabel}</span>
        </aside>

        <section className="number-board-panel">
          <div className="turn-strip"><b>{turn === "enemy" ? "ROTE KETTE" : "GRÜNE KETTE"}</b><span>{message}</span></div>
          <div ref={gridRef} className="number-grid">
            {grid.flatMap((row, r) => row.map((tile, c) => {
              const index = activePath.findIndex((pick) => pick.row === r && pick.col === c);
              const selected = index >= 0;
              const end = selected && index === activePath.length - 1;
              const nextOption = nextOptions.has(`${r}:${c}`);
              const fallY = fallOffsets[tile.id] ?? 0;
              const shiftX = rowShiftOffsets[tile.id] ?? 0;
              const motionStyle = (fallY > 0 || shiftX !== 0)
                ? ({
                    ...(fallY > 0 ? { "--fall-y": `-${fallY}px` } : {}),
                    ...(shiftX !== 0 ? { "--row-shift-x": `${shiftX}px` } : {}),
                  } as MotionStyle)
                : undefined;
              return (
                <button
                  key={tile.id}
                  className={`${selected ? turn === "enemy" ? "enemy-selected" : "selected" : ""} ${end ? "chain-end" : ""} ${nextOption ? "next-option" : ""} ${special ? "special-target" : ""} ${fallY > 0 ? "tile-fall" : ""} ${shiftX !== 0 ? "tile-row-shift" : ""}`}
                  style={motionStyle}
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

        <aside className={`reactor-panel-clean ${isFirewallPhase ? "firewall-phase" : ""} ${coreExposed ? "boss-core-exposed" : ""}`}>
          <div className="reactor-target" aria-label={`Rechenziel ${config.symbol} ${config.target}`}>
            <small>{coreExposed ? "KOMMANDOKERN · RECHENZIEL" : isFirewallPhase ? "FIREWALL · RECHENZIEL" : "RECHENZIEL"}</small>
            <div className="reactor-target-equation"><span>{config.symbol}</span><strong>{config.target}</strong></div>
          </div>
          {totalLayers > 1 && (
            <div className="boss-firewalls" aria-label={`${clearedLayers} von ${totalLayers} Firewalls zerstört`}>
              <div className="boss-firewall-stack">
                {Array.from({ length: totalLayers }, (_, index) => {
                  const state = index < clearedLayers
                    ? "broken"
                    : breakingLayer === index
                      ? "breaking"
                      : index === clearedLayers
                        ? "current"
                        : "armed";
                  return (
                    <div key={index} className={`boss-firewall ${state}`}>
                      <span className="shield">⬢</span>
                      <b>FIREWALL {index + 1}</b>
                      <small>{state === "broken" ? "ZERSTÖRT" : state === "current" ? "AKTIV" : "BEREIT"}</small>
                    </div>
                  );
                })}
              </div>
              {breakingLayer !== null && <div className="firewall-break-flash">FIREWALL {breakingLayer + 1} GEBROCHEN</div>}
            </div>
          )}
          <div className={`core-row ${isFirewallPhase ? "firewall-segments" : ""}`} aria-label={`${teamCores} Team-Reaktorsegmente, ${reactor.total - teamCores} Droid-Reaktorsegmente, ${reactor.total} insgesamt`}>
            {Array.from({ length: reactor.total }, (_, index) => <i key={index} className={index < teamCores ? "team" : "enemy"} />)}
          </div>
          <div className={`chain-charge tier-${chargeClass}`} aria-label={`Kettenlänge ${activeChargeLength}. ${activeChargeLength >= 2 ? chargeReward.instant ? "Sofort-Territorium bei korrekter Rechnung" : `Reaktorbonus ${chargeReward.power} bei korrekter Rechnung` : "Noch kein Reaktorbonus"}.`}>
            <div className="chain-charge-head"><small>KETTENENERGIE</small><strong>{chargeText}</strong></div>
            <div className="chain-charge-track" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Math.min(5, activeChargeLength) ? "filled" : ""} />)}
            </div>
          </div>
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
