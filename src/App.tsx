import { useCallback, useEffect, useState } from "react";
import { BODIES, STARTING_HP } from "./game/catalog";
import { FIRST_CAMPAIGN_DECK_ID, floorGoalCompleted, getCampaignDeck, getNextCampaignDeck, type CampaignDeck } from "./game/campaign";
import { retreatAfterDuelLoss } from "./game/duelLoss";
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
  profileWithAbandonedDeck,
  profileWithCompletedDeck,
  profileWithStartedDeck,
  savePlayerProfiles,
  type PlayerProfileCollection,
} from "./game/playerProfile";
import { loadAppSettings, saveAppSettings, type AppSettings } from "./game/appSettings";
import { useAppFullscreen } from "./game/useFullscreen";
import type { BattleResult, EncounterConfig, GameScreen, MetaState } from "./game/types";
import { DestroyedScreen } from "./game/DestroyedScreen";
import { CampaignSuccessScreen } from "./campaign/CampaignSuccessScreen";
import {
  HubScreen,
  IntroScreen,
  ProfileWizardScreen,
  SettingsScreen,
  TitleScreen,
  type NewProfileDraft,
} from "./menu/MenuFlow";
import "./menu/HubDetailScreens.css";
import { MetaGame } from "./meta/MetaGame";
import { EncounterPanel } from "./meta/EncounterPanel";
import { NumberDuel } from "./duel/NumberDuel";
import { TransferScreen } from "./transfer/TransferScreen";

type AppScreen = GameScreen | "intro" | "title" | "profile-create" | "settings" | "hub" | "success";

function freshCampaignMeta(playerCount: number) {
  const firstDeck = getCampaignDeck(FIRST_CAMPAIGN_DECK_ID);
  return createFloorState(getFloor(firstDeck.floorId ?? "deck-vs2"), playerCount);
}

export default function App() {
  const previewFloorId = getPreviewFloorId();
  const [profileCollection, setProfileCollection] = useState<PlayerProfileCollection>(() => loadPlayerProfiles());
  const profile = activePlayerProfile(profileCollection);
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [meta, setMeta] = useState<MetaState>(() => {
    const legacy = loadMetaState();
    if (previewFloorId) return createFloorState(getFloor(previewFloorId), legacy.playerCount);
    const initialProfile = activePlayerProfile(loadPlayerProfiles());
    const hasStoredProfile = loadPlayerProfiles().profiles.some((entry) => entry.id === initialProfile.id);
    return hasStoredProfile
      ? loadProfileMetaState(initialProfile.id, initialProfile.id === "player-1") ?? freshCampaignMeta(legacy.playerCount)
      : freshCampaignMeta(legacy.playerCount);
  });
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (!previewFloorId) return "intro";
    return meta.damageTaken >= STARTING_HP ? "destroyed" : "deck";
  });
  const [encounter, setEncounter] = useState<EncounterConfig | null>(null);
  const [transfer, setTransfer] = useState<{ encounter: EncounterConfig; oldBodyId: MetaState["currentBody"] } | null>(null);
  const [completedCampaignDeckId, setCompletedCampaignDeckId] = useState<string | null>(null);
  const [hubNotice, setHubNotice] = useState("");
  const fullscreen = useAppFullscreen();

  const updateMeta = useCallback((next: MetaState) => setMeta(next), []);
  const remainingHp = Math.max(0, STARTING_HP - meta.damageTaken);
  const hasProfiles = profileCollection.profiles.length > 0;
  const gameplayScreen = screen === "deck" || screen === "encounter" || screen === "duel" || screen === "transfer" || screen === "destroyed";
  const showFullscreenGate = fullscreen.needsFullscreenPrompt;

  useEffect(() => {
    if (previewFloorId || !hasProfiles) return;
    const timer = window.setTimeout(() => saveProfileMetaState(profile.id, meta), 220);
    return () => window.clearTimeout(timer);
  }, [meta, previewFloorId, profile.id, hasProfiles]);

  useEffect(() => {
    if (previewFloorId) return;
    const timer = window.setTimeout(() => savePlayerProfiles(profileCollection), 120);
    return () => window.clearTimeout(timer);
  }, [profileCollection, previewFloorId]);

  useEffect(() => {
    if (previewFloorId) return;
    const timer = window.setTimeout(() => saveAppSettings(settings), 120);
    return () => window.clearTimeout(timer);
  }, [settings, previewFloorId]);

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
    setHubNotice("");
    setCompletedCampaignDeckId(campaignDeck.id);
    setScreen("success");
  }, [meta, previewFloorId, profile.currentCampaignDeckId, screen]);

  function loadProfileRun(profileId: string) {
    return loadProfileMetaState(profileId, profileId === "player-1") ?? freshCampaignMeta(meta.playerCount);
  }

  function switchProfile(profileId: string, destination: "title" | "hub") {
    if (!profileCollection.profiles.some((entry) => entry.id === profileId)) return;
    if (hasProfiles) saveProfileMetaState(profile.id, meta);
    const selectedRun = loadProfileRun(profileId);
    setProfileCollection((current) => collectionWithActiveProfile(current, profileId));
    setMeta(selectedRun);
    setCompletedCampaignDeckId(null);
    setHubNotice("");
    setEncounter(null);
    setTransfer(null);
    setScreen(destination);
  }

  function cycleProfile() {
    if (profileCollection.profiles.length < 2) return;
    const index = profileCollection.profiles.findIndex((entry) => entry.id === profile.id);
    const next = profileCollection.profiles[(index + 1 + profileCollection.profiles.length) % profileCollection.profiles.length];
    switchProfile(next.id, "title");
  }

  function continueProfile() {
    if (!hasProfiles) return;
    switchProfile(profile.id, "hub");
  }

  function createProfile(draft: NewProfileDraft) {
    if (hasProfiles) saveProfileMetaState(profile.id, meta);
    const usedIds = new Set(profileCollection.profiles.map((entry) => entry.id));
    let index = profileCollection.profiles.length + 1;
    let id = `player-${index}`;
    while (usedIds.has(id)) {
      index += 1;
      id = `player-${index}`;
    }
    const nextProfile = createPlayerProfile(id, draft.name, draft.audience, draft.mathStartId);
    setProfileCollection((current) => collectionWithNewProfile(current, nextProfile));
    setMeta(freshCampaignMeta(meta.playerCount));
    setCompletedCampaignDeckId(null);
    setHubNotice("");
    setEncounter(null);
    setTransfer(null);
    setScreen("hub");
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
      && storedRun.damageTaken < STARTING_HP
      && !floorGoalCompleted(storedRun, floor);
    const next = canResume ? storedRun : createFloorState(floor, meta.playerCount);
    setProfileCollection((current) => {
      const active = activePlayerProfile(current);
      return collectionWithUpdatedProfile(current, profileWithStartedDeck(active, deck.id));
    });
    setCompletedCampaignDeckId(null);
    setHubNotice("");
    setMeta(next);
    setEncounter(null);
    setTransfer(null);
    setScreen("deck");
  }

  function returnToHub() {
    if (!previewFloorId && hasProfiles) saveProfileMetaState(profile.id, meta);
    setEncounter(null);
    setTransfer(null);
    setCompletedCampaignDeckId(null);
    setHubNotice("");
    setScreen("hub");
  }

  function returnToTitle() {
    if (hasProfiles) saveProfileMetaState(profile.id, meta);
    setEncounter(null);
    setTransfer(null);
    setCompletedCampaignDeckId(null);
    setHubNotice("");
    setScreen("title");
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

    const failedFloor = getFloor(meta.floorId);
    const retreated = retreatAfterDuelLoss(energyState, failedFloor);
    const damageTaken = retreated.damageTaken;

    if (damageTaken >= STARTING_HP && !previewFloorId) {
      const fresh = createFloorState(failedFloor, meta.playerCount);
      saveProfileMetaState(profile.id, fresh);
      setProfileCollection((current) => {
        const active = activePlayerProfile(current);
        return collectionWithUpdatedProfile(current, profileWithAbandonedDeck(active));
      });
      setMeta(fresh);
      setEncounter(null);
      setTransfer(null);
      setCompletedCampaignDeckId(null);
      setHubNotice("MISSION NICHT GESCHAFFT · DU BIST ZURÜCK IM HUB");
      setScreen("hub");
      return;
    }

    const restarted = rotatePilot(retreated);
    if (!previewFloorId) saveProfileMetaState(profile.id, restarted);
    setMeta(restarted);
    setEncounter(null);
    setTransfer(null);
    setHubNotice(`KAMPF VERLOREN · ZURÜCK ZUM LEVELSTART · ${Math.max(0, STARTING_HP - damageTaken)} HP ÜBRIG`);
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
  const showDeck = screen === "deck" || screen === "encounter";

  return (
    <>
      {showFullscreenGate && (
        <div className="zk-app-start-gate">
          <section className="zk-app-start-card" role="dialog" aria-modal="true" aria-labelledby="app-start-title">
            <div className="zk-app-start-mark">ND</div>
            <small>NUMBERDROID · SPIELMODUS</small>
            <h1 id="app-start-title">Im Vollbild spielen</h1>
            <p>Numberdroid funktioniert auf dem Handy am besten direkt im Querformat-Vollbildmodus.</p>
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

      {!previewFloorId && screen === "intro" && <IntroScreen onContinue={() => setScreen("title")} />}
      {!previewFloorId && screen === "title" && (
        <TitleScreen
          profiles={profileCollection.profiles}
          activeProfile={profile}
          onContinue={continueProfile}
          onCycleProfile={cycleProfile}
          onNewProfile={() => setScreen("profile-create")}
          onSettings={() => setScreen("settings")}
        />
      )}
      {!previewFloorId && screen === "profile-create" && <ProfileWizardScreen onComplete={createProfile} onCancel={() => setScreen("title")} />}
      {!previewFloorId && screen === "settings" && <SettingsScreen settings={settings} onChange={setSettings} onBack={() => setScreen("title")} />}
      {!previewFloorId && screen === "hub" && (
        <HubScreen profile={profile} meta={meta} notice={hubNotice} onStartMission={startCampaignDeck} onMainMenu={returnToTitle} />
      )}
      {!previewFloorId && screen === "success" && completedCampaignDeck && (
        <CampaignSuccessScreen deck={completedCampaignDeck} onHub={() => { setCompletedCampaignDeckId(null); setScreen("hub"); }} />
      )}

      {!previewFloorId && gameplayScreen && screen !== "destroyed" && (
        <button className="app-hub-toggle" onClick={returnToHub}>← HUB</button>
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
      {screen === "destroyed" && previewFloorId && (
        <DestroyedScreen body={BODIES[meta.currentBody]} onRestart={restartFloor} />
      )}
    </>
  );
}
