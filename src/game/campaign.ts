import type { FloorDefinition, MetaState } from "./types";

export type CampaignAct = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
};

export type CampaignDeck = {
  id: string;
  order: number;
  actId: string;
  title: string;
  subtitle: string;
  floorId?: string;
  intro: string;
  outro: string;
  mechanics: string[];
  mathPressure: "comfort" | "core" | "stretch" | "mastery";
  prototype?: boolean;
};

export const CAMPAIGN_ACTS: CampaignAct[] = [
  { id: "act-1", order: 1, title: "AKT I · EINDRINGEN", subtitle: "Übernehmen · Orientieren · Überleben" },
  { id: "act-2", order: 2, title: "AKT II · SICHERHEIT", subtitle: "Wachen · Zugänge · Patrouillen" },
  { id: "act-3", order: 3, title: "AKT III · SYSTEME", subtitle: "Fähigkeiten · Ressourcen · Zahlenkern" },
  { id: "act-4", order: 4, title: "AKT IV · JAGD", subtitle: "Fallen · Beutedroiden · Verfolgung" },
  { id: "act-5", order: 5, title: "AKT V · KOMMANDO", subtitle: "Kombinieren · Meistern · Übernehmen" },
];

const FIRST_DECKS: CampaignDeck[] = [
  {
    id: "campaign-b2",
    order: 1,
    actId: "act-1",
    title: "DECK B2",
    subtitle: "MASCHINENRING",
    floorId: "deck-vs2",
    intro: "Der erste echte Zugang zum Schiff liegt im Maschinenring. Sichere Energie, übernimm geeignete Droiden und arbeite dich bis zur Deckkontrolle vor.",
    outro: "Deck B2 ist unter Kontrolle. Tiefer im Schiff werden die Sicherheitsroutinen dichter – aber du hast jetzt einen Weg hinein.",
    mechanics: ["Droiden-Transfer", "Meta-Energie", "Security-Zugänge", "Wachen & Patrouillen"],
    mathPressure: "comfort",
  },
  {
    id: "campaign-c3",
    order: 2,
    actId: "act-1",
    title: "DECK C3",
    subtitle: "VERSORGUNGSRING",
    intro: "C3 hält die Versorgung des Schiffes am Laufen. Die Droiden hier arbeiten enger zusammen und reagieren auf Störungen schneller.",
    outro: "Die Versorgung ist offen. Das Schiff hat dich bemerkt.",
    mechanics: ["Bekannte Systeme kombinieren", "Erste stärkere Spezialisten"],
    mathPressure: "core",
    prototype: true,
  },
];

const RESERVED_DECK_SLOTS: CampaignDeck[] = Array.from({ length: 23 }, (_, index) => {
  const order = index + 3;
  const actOrder = Math.min(5, Math.floor((order - 1) / 5) + 1);
  return {
    id: `campaign-slot-${String(order).padStart(2, "0")}`,
    order,
    actId: `act-${actOrder}`,
    title: `DECK ${String(order).padStart(2, "0")}`,
    subtitle: "NOCH NICHT KARTIERT",
    intro: "Dieser Bereich des Schiffs ist noch nicht als Produktionsdeck ausgearbeitet.",
    outro: "",
    mechanics: [],
    mathPressure: order < 8 ? "core" : order < 15 ? "stretch" : "mastery",
    prototype: true,
  };
});

export const CAMPAIGN_DECKS: CampaignDeck[] = [...FIRST_DECKS, ...RESERVED_DECK_SLOTS];

export const FIRST_CAMPAIGN_DECK_ID = "campaign-b2";

export function getCampaignDeck(deckId: string) {
  return CAMPAIGN_DECKS.find((deck) => deck.id === deckId) ?? CAMPAIGN_DECKS[0];
}

export function getCampaignDeckForFloor(floorId: string) {
  return CAMPAIGN_DECKS.find((deck) => deck.floorId === floorId) ?? null;
}

export function getNextCampaignDeck(deckId: string) {
  const current = getCampaignDeck(deckId);
  return CAMPAIGN_DECKS.find((deck) => deck.order === current.order + 1) ?? null;
}

export function campaignDeckPlayable(deck: CampaignDeck) {
  return Boolean(deck.floorId);
}

export function floorGoalCompleted(meta: MetaState, floor: FloorDefinition) {
  const goal = floor.goal;
  if (!goal) return false;
  if (goal.kind === "defeat-encounter") return meta.defeatedEncounterIds.includes(goal.encounterId);
  return meta.completedActionIds.includes(goal.actionId);
}
