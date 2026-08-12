export type AppLanguage = "de";

export type AppSettings = {
  version: 1;
  masterVolume: number;
  language: AppLanguage;
};

const SETTINGS_KEY = "numberdroid-app-settings-v1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  masterVolume: 0.8,
  language: "de",
};

function sanitize(candidate: Partial<AppSettings>): AppSettings {
  const rawVolume = typeof candidate.masterVolume === "number" && Number.isFinite(candidate.masterVolume)
    ? candidate.masterVolume
    : DEFAULT_APP_SETTINGS.masterVolume;
  return {
    version: 1,
    masterVolume: Math.max(0, Math.min(1, rawVolume)),
    language: "de",
  };
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return sanitize(JSON.parse(raw) as Partial<AppSettings>);
  } catch { /* ignore damaged settings */ }
  return { ...DEFAULT_APP_SETTINGS };
}

export function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitize(settings)));
  } catch { /* storage may be unavailable */ }
}
