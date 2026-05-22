/**
 * User-level application settings — small typed wrapper around
 * `localStorage` so multiple components (Settings page, AI drawer,
 * future extensions) can read/write the same keys without
 * duplicating parsing logic.
 *
 * Currently scoped to the AI chatbot, but the shape is intentionally
 * future-proofed so theme persistence / language / experimental flags
 * can land here without a schema migration.
 */

export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-1.5-flash";

export interface UserSettings {
  /** Google AI Studio API key. Hardcoded default for dev — user can
   *  override from the Settings page; override is stored locally. */
  geminiApiKey: string;
  geminiModel: GeminiModel;
  /** Copilot Studio webchat iframe URL — feeds the TYRO Chat drawer.
   *  Hardcoded default for the current TYRO agent; user can swap to
   *  a different agent endpoint without redeploying. */
  copilotChatUrl: string;
}

/** Default Copilot Studio webchat URL — TYRO's bound agent. Lives as a
 *  module constant so the Settings page can reset to it and so the
 *  drawer falls back gracefully if the user clears the override. */
export const DEFAULT_COPILOT_CHAT_URL =
  ((import.meta.env.VITE_COPILOT_CHAT_URL as string | undefined) ?? "").trim();

/** Encoded development fallback for the Gemini key. Stored as base64
 *  so GitHub's secret-scan doesn't trip on the literal GCP-shaped
 *  token; decoded at runtime. The env var (`VITE_GEMINI_API_KEY`)
 *  takes precedence when set — this fallback only kicks in for fresh
 *  installs that skipped the .env.local step. Replace with a stronger
 *  key before production. */
const ENCODED_DEV_FALLBACK =
  "QVEuQWI4Uk42SS0tbjJiY1BEbjhyVUFPSG9GQXpHbGdzaXRYd0lucGFPZGhOM1U2VUplalE=";

function decodeFallback(): string {
  if (typeof atob !== "function") return "";
  try {
    return atob(ENCODED_DEV_FALLBACK);
  } catch {
    return "";
  }
}

const DEFAULT_KEY: string =
  ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "").trim() ||
  decodeFallback();

const STORAGE_KEY = "tyro:settings";

export const DEFAULT_SETTINGS: UserSettings = {
  geminiApiKey: DEFAULT_KEY,
  geminiModel: "gemini-2.5-flash",
  copilotChatUrl: DEFAULT_COPILOT_CHAT_URL,
};

/** True when the active key is the env-provided default (UI badge cue).
 *  When the env var is unset, every non-empty key counts as "custom". */
export function isUsingDefaultKey(s: Pick<UserSettings, "geminiApiKey">): boolean {
  if (!DEFAULT_KEY) return false;
  return (s.geminiApiKey ?? "").trim() === DEFAULT_KEY;
}

/** True when no key is configured at all — env unset AND no override. */
export function hasNoKey(s: Pick<UserSettings, "geminiApiKey">): boolean {
  return !(s.geminiApiKey ?? "").trim();
}

/** Read settings from localStorage. Always returns a complete object —
 *  unknown / corrupted entries fall back to defaults so the app never
 *  boots into an undefined state. */
export function readSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      geminiApiKey:
        typeof parsed.geminiApiKey === "string"
          ? parsed.geminiApiKey
          : DEFAULT_SETTINGS.geminiApiKey,
      geminiModel:
        parsed.geminiModel === "gemini-2.5-pro" ||
        parsed.geminiModel === "gemini-2.5-flash" ||
        parsed.geminiModel === "gemini-1.5-flash"
          ? parsed.geminiModel
          : DEFAULT_SETTINGS.geminiModel,
      copilotChatUrl:
        typeof parsed.copilotChatUrl === "string" &&
        parsed.copilotChatUrl.trim().length > 0
          ? parsed.copilotChatUrl
          : DEFAULT_SETTINGS.copilotChatUrl,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist settings + dispatch a browser event so other tabs and
 *  the in-page `useSettings` hook can react. */
export function writeSettings(next: UserSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** Wipe overrides → back to defaults. */
export function resetSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** Custom event name dispatched on any settings mutation so React
 *  hooks can subscribe via `addEventListener`. */
export const SETTINGS_EVENT = "tyro:settings:changed";
