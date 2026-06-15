import * as React from "react";
import {
  Eye,
  EyeOff,
  RotateCcw,
  ExternalLink,
  Database,
  Trash2,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FlashIcon,
  AiBrain02Icon,
  BubbleChatIcon,
} from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_COPILOT_CHAT_URL,
  isUsingDefaultKey,
  type GeminiModel,
} from "@/lib/settings/userSettings";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import { generateAnswer, GeminiError } from "@/lib/ai/gemini";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * /settings — application preferences. First card is the Gemini AI
 * chatbot key + model selection (the primary surface). Future cards
 * (theme persistence, sync, language) can stack underneath.
 *
 * Mirrors the TYROwms Settings reference layout: card with header
 * pill icon, plain-language description, the field, a Test button,
 * a status row, and a footer help link.
 */
export function SettingsPage() {
  const t = useT();
  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto py-3 px-1 space-y-3">
        <AiChatbotCard />
        <CopilotChatCard />
        <LocalStorageCard />
        <PlaceholderCard
          title={t("set.theme.title")}
          tagline={t("set.theme.tagline")}
          body={t("set.theme.body")}
        />
      </div>
    </ScrollArea>
  );
}

/* ─────────── AI Chatbot Card ─────────── */

function AiChatbotCard() {
  const t = useT();
  const { settings, setSettings, resetToDefaults } = useSettings();
  const accent = useThemeAccent();
  const [draftKey, setDraftKey] = React.useState(settings.geminiApiKey);
  const [show, setShow] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Keep the local draft synced when settings change externally (e.g.
  // user resets to defaults in another tab).
  React.useEffect(() => {
    setDraftKey(settings.geminiApiKey);
  }, [settings.geminiApiKey]);

  const isDirty = draftKey.trim() !== settings.geminiApiKey.trim();
  const usingDefault = isUsingDefaultKey({ geminiApiKey: settings.geminiApiKey });

  function handleSaveKey() {
    setSettings({ ...settings, geminiApiKey: draftKey.trim() });
    setTestStatus({ kind: "idle" });
  }

  function handleResetKey() {
    resetToDefaults();
    setTestStatus({ kind: "idle" });
  }

  function handleModelChange(value: string) {
    setSettings({ ...settings, geminiModel: value as GeminiModel });
  }

  async function handleTest() {
    setTestStatus({ kind: "loading" });
    try {
      const answer = await generateAnswer({
        apiKey: draftKey.trim() || settings.geminiApiKey,
        model: settings.geminiModel,
        systemInstruction:
          "Tek kelimeyle yanıt ver: 'merhaba' geldiğinde 'merhaba' yaz.",
        history: [],
        userPrompt: "merhaba",
      });
      setTestStatus({
        kind: "ok",
        message: t("set.ai.testOk").replace("{answer}", answer.slice(0, 40).trim()),
      });
    } catch (err) {
      const message =
        err instanceof GeminiError
          ? err.userMessage
          : t("set.ai.testUnknownError");
      setTestStatus({ kind: "error", message });
    }
  }

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="px-5 py-4 flex items-start gap-3 border-b border-border/40">
        <span
          className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
          style={{
            background: accent.gradient,
            boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
          }}
        >
          <HugeiconsIcon icon={FlashIcon} size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight leading-tight">
            {t("set.ai.title")}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            {t("set.ai.desc")}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* API key row */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[11.5px] font-semibold uppercase tracking-wider text-foreground/70">
              {t("set.ai.keyLabel")}
            </label>
            <StatusDot usingDefault={usingDefault} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={show ? "text" : "password"}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AQ.Ab8RN6I-..."
                className="pr-10 font-mono text-[12.5px]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                aria-label={show ? t("set.ai.keyHide") : t("set.ai.keyShow")}
              >
                {show ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            <Button
              type="button"
              onClick={handleTest}
              disabled={testStatus.kind === "loading"}
              className="shrink-0"
              style={{
                background: accent.gradient,
                color: "white",
                boxShadow: `0 4px 12px -4px ${accent.ring}`,
              }}
            >
              {testStatus.kind === "loading" ? t("set.ai.testing") : t("set.ai.test")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveKey}
              disabled={!isDirty}
            >
              {t("set.common.save")}
            </Button>
          </div>
          {testStatus.kind === "ok" && (
            <p className="text-[11.5px] text-emerald-700">
              ✓ {testStatus.message}
            </p>
          )}
          {testStatus.kind === "error" && (
            <p className="text-[11.5px] text-rose-600">
              ⚠ {testStatus.message}
            </p>
          )}
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-[11.5px] font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
            <HugeiconsIcon icon={AiBrain02Icon} size={12} strokeWidth={2} />
            {t("set.ai.modelLabel")}
          </label>
          <Select value={settings.geminiModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.5-flash">
                {t("set.ai.model.flash25")}
              </SelectItem>
              <SelectItem value="gemini-2.5-pro">
                {t("set.ai.model.pro25")}
              </SelectItem>
              <SelectItem value="gemini-1.5-flash">
                {t("set.ai.model.flash15")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Footer link + reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 text-[11.5px] text-foreground/70 hover:text-foreground"
            )}
          >
            <ExternalLink className="size-3" />
            {t("set.ai.getKeyLink")}
          </a>
          {!usingDefault && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetKey}
              className="h-7 px-2 gap-1.5 text-[11px]"
            >
              <RotateCcw className="size-3" />
              {t("set.common.resetToDefault")}
            </Button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function StatusDot({ usingDefault }: { usingDefault: boolean }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-semibold",
        usingDefault ? "text-foreground/55" : "text-emerald-700"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          usingDefault ? "bg-foreground/35" : "bg-emerald-500"
        )}
      />
      {usingDefault ? t("set.ai.statusDefault") : t("set.ai.statusCustom")}
    </span>
  );
}

/* ─────────── Copilot Chat (TYRO Chat iframe) Card ─────────── */

/**
 * Lets the user override the Copilot Studio webchat URL that powers
 * the TYRO Chat drawer. Empty input + Save → reverts to the bundled
 * default (Tiryaki's bound agent) so wiping the field is a safe
 * "reset" gesture.
 *
 * Mirrors AiChatbotCard's geometry but uses the indigo TYRO Chat tone
 * for the header pill so the Settings entry visually matches the
 * topbar pill + drawer chrome it controls.
 */
function CopilotChatCard() {
  const t = useT();
  const { settings, setSettings } = useSettings();
  const [draft, setDraft] = React.useState(settings.copilotChatUrl);

  // Sync local draft when settings change in another tab / via reset.
  React.useEffect(() => {
    setDraft(settings.copilotChatUrl);
  }, [settings.copilotChatUrl]);

  const trimmedDraft = draft.trim();
  const trimmedSaved = (settings.copilotChatUrl ?? "").trim();
  const isDirty = trimmedDraft !== trimmedSaved;
  const usingDefault = trimmedSaved === DEFAULT_COPILOT_CHAT_URL;

  function handleSave() {
    // Empty draft → fall back to default (deletion = reset to factory).
    const next = trimmedDraft.length === 0 ? DEFAULT_COPILOT_CHAT_URL : trimmedDraft;
    setSettings({ ...settings, copilotChatUrl: next });
    setDraft(next);
  }

  function handleResetToDefault() {
    setSettings({ ...settings, copilotChatUrl: DEFAULT_COPILOT_CHAT_URL });
    setDraft(DEFAULT_COPILOT_CHAT_URL);
  }

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="px-5 py-4 flex items-start gap-3 border-b border-border/40">
        <span
          className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
          style={{
            background: TYRO_CHAT_TONE.gradient,
            boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
          }}
        >
          <HugeiconsIcon icon={BubbleChatIcon} size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight leading-tight">
            {t("set.chat.title")}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            {t("set.chat.desc")}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[11.5px] font-semibold uppercase tracking-wider text-foreground/70">
              {t("set.chat.urlLabel")}
            </label>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[10.5px] font-semibold",
                usingDefault ? "text-foreground/55" : "text-indigo-700"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  usingDefault ? "bg-foreground/35" : "bg-indigo-500"
                )}
              />
              {usingDefault ? t("set.chat.statusDefault") : t("set.chat.statusCustom")}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={DEFAULT_COPILOT_CHAT_URL}
              className="flex-1 font-mono text-[12px]"
              spellCheck={false}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={!isDirty}
            >
              {t("set.common.save")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <span className="text-[11.5px] text-muted-foreground">
            {t("set.chat.storedLocally")}
          </span>
          {!usingDefault && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="h-7 px-2 gap-1.5 text-[11px]"
            >
              <RotateCcw className="size-3" />
              {t("set.common.resetToDefault")}
            </Button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Placeholder card ─────────── */

function PlaceholderCard({
  title,
  tagline,
  body,
}: {
  title: string;
  tagline: string;
  body: string;
}) {
  return (
    <GlassPanel tone="subtle" className="rounded-2xl">
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
          <span className="text-[11px] text-muted-foreground">{tagline}</span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">
          {body}
        </p>
      </div>
    </GlassPanel>
  );
}

/* ─────────── LocalStorage card ─────────── */

interface StorageEntry {
  key: string;
  size: number;
  preview: string;
}

/**
 * Surfaces every `tyro:*` localStorage entry so the user can see what
 * the app keeps in their browser and clear individual keys (or all of
 * them) without DevTools. Sized in KB for quick triage of cache rows
 * that have grown large after a Dataverse sync.
 */
function LocalStorageCard() {
  const t = useT();
  const [entries, setEntries] = React.useState<StorageEntry[]>([]);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const out: StorageEntry[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("tyro:")) continue;
      const raw = window.localStorage.getItem(key) ?? "";
      out.push({
        key,
        size: new Blob([raw]).size,
        preview: raw.length > 80 ? `${raw.slice(0, 77)}…` : raw,
      });
    }
    out.sort((a, b) => b.size - a.size);
    setEntries(out);
  }, [tick]);

  const totalSize = entries.reduce((s, e) => s + e.size, 0);

  function deleteKey(key: string) {
    window.localStorage.removeItem(key);
    setTick((t) => t + 1);
    // Notify other listeners (e.g. useSettings) that storage changed
    window.dispatchEvent(new Event("storage"));
  }

  function clearAll() {
    if (
      !window.confirm(
        t("set.storage.confirmClear").replace("{count}", String(entries.length))
      )
    ) {
      return;
    }
    for (const e of entries) {
      window.localStorage.removeItem(e.key);
    }
    setTick((t) => t + 1);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="px-5 py-4 flex items-start gap-3 border-b border-border/40">
        <span className="size-9 rounded-xl grid place-items-center shrink-0 bg-foreground/[0.06] text-foreground/70">
          <Database className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight leading-tight">
            {t("set.storage.title")}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            {t("set.storage.desc")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("set.storage.total")}
          </div>
          <div className="text-[15px] font-bold tabular-nums">
            {formatSize(totalSize)}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic py-2">
            {t("set.storage.empty")}
          </p>
        ) : (
          entries.map((e) => (
            <div
              key={e.key}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11.5px] text-foreground/85 truncate">
                  {e.key}
                </div>
                <div className="text-[10.5px] text-muted-foreground/85 truncate">
                  {e.preview}
                </div>
              </div>
              <span className="text-[10.5px] tabular-nums text-muted-foreground shrink-0">
                {formatSize(e.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-rose-600"
                onClick={() => deleteKey(e.key)}
                aria-label={t("set.storage.deleteAria").replace("{key}", e.key)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {entries.length > 0 && (
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {entries.length} {t("set.storage.itemsUnit")} · {formatSize(totalSize)}{" "}
            {t("set.storage.usageSuffix")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="h-7 px-3 gap-1.5 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
          >
            <Trash2 className="size-3" />
            {t("set.storage.clearAll")}
          </Button>
        </div>
      )}
    </GlassPanel>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
