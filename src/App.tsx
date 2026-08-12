import { useCallback, useEffect, useState } from "react";
import { BODIES, STARTING_HP } from "./game/catalog";
import { FIRST_CAMPAIGN_DECK_ID, floorGoalCompleted, getCampaignDeck, getNextCampaignDeck, type CampaignDeck } from "./game/campaign";
import { getFloor, getPreviewFloorId } from "./game/floors";
import { encounterWithProfileDifficulty } from "./game/mathProgression";
import {
  createFloorState,
  loadMetaState,
  loadProfileMetaState,
  restartFloorState,
  saveProfileMetaState,
} from "./game/save";
import {
  activePlayerProfile,
  collectionWithActiveProfile,
  collectionWithNewProfile,
  collectionWithUpdatedProfile,
  createPlayerProfile,
  loadPlayerProfiles,
  profileWithCompletedDeck,
  profileWithStartedDeck,
  savePlayerProfiles,
  type PlayerProfile,
  type PlayerProfileCollection,
} from "./game/playerProfile";
import { useAppFullscreen } from "./game/useFullscreen";
import type { BattleResult, EncounterConfig, GameScreen, MetaState } from "./game/types";
import { DestroyedScreen } from "./game/DestroyedScreen";
import { CampaignScreen } from "./campaign/CampaignScreen";
import { CampaignSuccessScreen } from "./campaign/CampaignSuccessScreen";
import { MetaGame } from "./meta/MetaGame";
import { EncounterPanel } from "./meta/EncounterPanel";
import { NumberDuel } from "./duel/NumberDuel";
import { TransferScreen } from "./transfer/TransferScreen";

type AppScreen = GameScreen | "campaign" | "success";

function freshCampaignMeta(playerCount: number) {
  const firstDeck = getCampaignDeck(FIRST_CAMPAIGN_DECK_ID);
  return createFloorState(getFloor(firstDeck.floorId ?? "deck-vs2"), playerCount);
}

export default function App() {
  const previewFloorId = getPreviewFloorId();
  const [profileCollection, setProfileCollection] = useState<PlayerProfileCollection>(() => loadPlayerProfiles());
  const profile = activePlayerProfile(profileCollection);
  const [meta, setMeta] = useState<MetaState>(() => {
    const legacy = loadMetaState();
    if (previewFloorId) return createFloorState(getFloor(previewFloorId), legacy.playerCount);
    return loadProfileMetaState(profile.id, profile.id === "player-1") ?? freshCampaignMeta(legacy.playerCount);
  });
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (!previewFloorId) return "campaign";
    return meta.damageTaken >= STARTING_HP ? "destroyed" : "deck";
  });
  const [encounter, setEncounter] = useState<EncounterConfig | null>(null);
  const [transfer, setTransfer] = useState<{ encounter: EncounterConfig; oldBodyId: MetaState["currentBody"] } | null>(null);
  const [completedCampaignDeckId, setCompletedCampaignDeckId] = useState<string | null>(null);
  const fullscreen = useAppFullscreen();

  const updateMeta = useCallback((next: MetaState) => setMeta(next), []);
  const remainingHp = Math.max(0, STARTING_HP - meta.damageTaken);

  useEffect(() => {
    if (previewFloorId) return;
    const timer = window.setTimeout(() => saveProfileMetaState(profile.id, meta), 220);
    return () => window.clearTimeout(timer);
  }, [meta, previewFloorId, profile.id]);

  useEffect(() => {
    if (previewFloorId) return;
    const timer = window.setTimeout(() => savePlayerProfiles(profileCollection), 120);
    return () => window.clearTimeout(timer);
  }, [profileCollection, previewFloorId]);

  useEffect(() => {
    if (previewFloorId || screen !== "deck" || !profile.currentCampaignDeckId) return;
    const floor = getFloor(meta.floorId);
    if (!floorGoalCompleted(meta, floor)) return;
    const campaignDeck = getCampaignDeck(profile.currentCampaignDeckId);
    const nextDeck = getNextCampaignDeck(campaignDeck.id);
    setProfileCollection((current) => {
      const active = activePlayerProfile(current);
      return collectionWithUpdatedProfile(current, profileWithCompletedDeck(active, campaignDeck.id, nextDeck?.id));
    });
    setCompletedCampaignDeckId(campaignDeck.id);
    setScreen("success");
  }, [meta, previewFloorId, profile.currentCampaignDeckId, screen]);

  function updateActiveProfile(next: PlayerProfile) {
    setProfileCollection((current) => collectionWithUpdatedProfile(current, next));
  }

  function selectProfile(profileId: string) {
    if (profileId === profile.id) return;
    saveProfileMetaState(profile.id, meta);
    const selected = profileCollection.profiles.find((entry) => entry.id === profileId);
    if (!selected) return;
    const selectedRun = loadProfileMetaState(profileId);
    setProfileCollection((current) => collectionWithActiveProfile(current, profileId));
    setMeta(selectedRun ?? freshCampaignMeta(meta.playerCount));
    setCompletedCampaignDeckId(null);
    setEncounter(null);
    setTransfer(null);
    setScreen("campaign");
  }

  function createProfile() {
    saveProfileMetaState(profile.id, meta);
    const usedIds = new Set(profileCollection.profiles.map((entry) => entry.id));
    let index = profileCollection.profiles.length + 1;
    let id = `player-${index}`;
    while (usedIds.has(id)) {
      index += 1;
      id = `player-${index}`;
    }
    const nextProfile = createPlayerProfile(id, `SPIELER ${index}`);
    setProfileCollection((current) => collectionWithNewProfile(current, nextProfile));
    setMeta(freshCampaignMeta(meta.playerCount));
    setCompletedCampaignDeckId(null);
    setEncounter(null);
    setTransfer(null);
    setScreen("campaign");
  }

  function rotatePilot(state: MetaState) {
    if (state.playerCount <= 1) return state;
    return { ...state, pilotIndex: (state.pilotIndex + 1) % state.playerCount };
  }

  function startCampaignDeck(deck: CampaignDeck) {
    if (!deck.floorId) return;
    const floor = getFloor(deck.floorId);
    const storedRun = loadProfileMetaState(profile.id);
    const canResume = profile.currentCampaignDeckId === deck.id
      && storedRun?.floorId === deck.floorId
      && !floorGoalCompleted(storedRun, floor);
    const next = canResume ? storedRun : createFloorState(floor, meta.playerCount);
    setProfileCollection((current) => {
      const active = activePlayerProfile(current);
      return collectionWithUpdatedProfile(current, profileWithStartedDeck(active, deck.id));
    });
    setCompletedCampaignDeckId(null);
    setMeta(next);
    setEncounter(null);
    setTransfer(null);
    setScreen(next.damageTaken >= STARTING_HP ? "destroyed" : "deck");
  }

  function returnToCampaign() {
    if (!previewFloorId) saveProfileMetaState(profile.id, meta);
    setEncounter(null);
    setTransfer(null);
    setCompletedCampaignDeckId(null);
    setScreen("campaign");
  }

  function openEncounter(next: EncounterConfig) {
    const campaignDeck = !previewFloorId && profile.currentCampaignDeckId
      ? getCampaignDeck(profile.currentCampaignDeckId)
      : null;
    const resolved = campaignDeck
      ? encounterWithProfileDifficulty(next, profile.mathStartId, profile.tacticalChallengeId, campaignDeck.order)
      : next;
    setEncounter(resolved);
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
    const defeatedEncounterIds = meta.defeatedEncounterIds.includes(target.encounterId)
      ? meta.defeatedEncounterIds
      : [...meta.defeatedEncounterIds, target.encounterId];
    const accessKeyIds = target.accessKey && !meta.accessKeyIds.includes(target.accessKey.keyId)
      ? [...meta.accessKeyIds, target.accessKey.keyId]
      : meta.accessKeyIds;
    const afterTransfer = rotatePilot({
      ...meta,
      currentBody: target.bodyId,
      currentDeckSize: target.deckSize ?? "standard",
      defeatedEncounterIds,
      accessKeyIds,
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

  const completedCampaignDeck = completedCampaignDeckId ? getCampaignDeck(completedCampaignDeckId) : null;
  const nextCampaignDeck = completedCampaignDeck ? getNextCampaignDeck(completedCampaignDeck.id) : null;
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

      {!previewFloorId && screen === "campaign" && (
        <CampaignScreen
          profile={profile}
          profiles={profileCollection.profiles}
          onProfileChange={updateActiveProfile}
          onSelectProfile={selectProfile}
          onCreateProfile={createProfile}
          onStartDeck={startCampaignDeck}
        />
      )}

      {!previewFloorId && screen === "success" && completedCampaignDeck && (
        <CampaignSuccessScreen deck={completedCampaignDeck} nextDeck={nextCampaignDeck} onShip={returnToCampaign} onNext={startCampaignDeck} />
      )}

      {!previewFloorId && screen !== "campaign" && screen !== "success" && (
        <button className="app-campaign-toggle" onClick={returnToCampaign}>← SCHIFF</button>
      )}

      {showDeck && (
        <MetaGame
          meta={meta}
          onMetaChange={updateMeta}
          onEncounter={openEncounter}
          tacticalChallengeId={previewFloorId ? "standard" : profile.tacticalChallengeId}
          paused={screen !== "deck" || fullscreen.needsFullscreenPrompt}
        />
      )}
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
        <TransferScreen
          oldBody={BODIES[transfer.oldBodyId]}
          newBody={BODIES[transfer.encounter.bodyId]}
          oldDeckSize={meta.currentDeckSize}
          newDeckSize={transfer.encounter.deckSize ?? "standard"}
          accessKey={transfer.encounter.accessKey}
          onComplete={finishTransfer}
        />
      )}
      {screen === "destroyed" && (
        <DestroyedScreen body={BODIES[meta.currentBody]} onRestart={restartFloor} />
      )}
    </>
  );
}
