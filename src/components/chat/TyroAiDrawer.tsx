import * as React from "react";
import { Link } from "react-router-dom";
import { Eraser } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain02Icon, Robot01Icon } from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { ChatSuggestions } from "./ChatSuggestions";
import { ChatMessage, type ChatMessageData } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useSettings } from "@/hooks/useSettings";
import { useProjects } from "@/hooks/useProjects";
import { generateAnswer, GeminiError } from "@/lib/ai/gemini";
import { TYRO_AI_SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { buildDashboardContext } from "@/lib/ai/buildContext";
import { cn } from "@/lib/utils";

interface TyroAiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * TYRO AI chat drawer — slides in from the right on desktop, full
 * screen on mobile. Reads the active project list directly from
 * `useProjects` so the chat is always grounded in the same data the
 * user sees on the dashboard. Settings (API key + model) come from
 * `useSettings` so any change in the Settings page picks up here on
 * the next render.
 *
 * Conversation lives in component state — page reload clears it
 * (intentional first-phase scope). Lift to localStorage in a follow-up
 * if persistent threads become a need.
 */
export function TyroAiDrawer({ open, onOpenChange }: TyroAiDrawerProps) {
  const { settings } = useSettings();
  const { projects } = useProjects();
  const accent = useThemeAccent();

  const [messages, setMessages] = React.useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever a new message appears
  React.useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  const sendPrompt = React.useCallback(
    async (text: string) => {
      if (isLoading) return;
      setError(null);

      const userMsg: ChatMessageData = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        timestamp: new Date(),
      };
      const pendingId = `a-${Date.now()}`;
      const pendingMsg: ChatMessageData = {
        id: pendingId,
        role: "ai",
        text: "",
        timestamp: new Date(),
        pending: true,
      };
      // Capture history BEFORE we add the new turn so it's not duplicated
      const historyForApi = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setIsLoading(true);

      try {
        const context = buildDashboardContext(projects, new Date());
        const promptWithContext = `${text}\n\n--- VERİ ÖZETİ (kullanıcının dashboard filtresinde aktif olan projeler) ---\n${context}`;
        const answer = await generateAnswer({
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
          systemInstruction: TYRO_AI_SYSTEM_PROMPT,
          history: historyForApi,
          userPrompt: promptWithContext,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, text: answer, pending: false, timestamp: new Date() }
              : m
          )
        );
      } catch (err) {
        const message =
          err instanceof GeminiError
            ? err.userMessage
            : "Bir hata oluştu. Birkaç saniye sonra tekrar deneyin.";
        setError(message);
        // Replace the pending bubble with the error so it doesn't sit empty
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: `⚠ ${message}`,
                  pending: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, projects, settings]
  );

  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // The base `right` variant ships with `inset-y-0 right-0 h-full
          // rounded-l-3xl`. We don't fight the positioning — that breaks
          // the slide-in animation — and just layer in our own surface
          // styling: opaque white glass + a heavier outer shadow so the
          // rounded left corners read against the page behind.
          // `overflow-hidden` clips the top accent strip + footer ring
          // into the rounded-l-3xl corners; without it the strip cuts
          // straight across the curve.
          "w-full sm:max-w-[420px] p-0 flex flex-col gap-0 overflow-hidden",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        {/* Top accent bar so the drawer reads as the "AI surface" */}
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: accent.gradient }}
        />

        {/* Header — avatar + title + Temizle + close (Sheet ships its own X) */}
        <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={AiBrain02Icon} size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[15px] font-semibold tracking-tight leading-tight">
              TYRO AI
            </SheetTitle>
            <SheetDescription className="text-[11.5px] text-muted-foreground leading-tight mt-0.5">
              Uluslararası ticaret asistanı
            </SheetDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            className="h-7 px-2.5 gap-1.5 text-[11px] rounded-full mr-7"
            aria-label="Sohbeti temizle"
          >
            <Eraser className="size-3" />
            Temizle
          </Button>
        </div>

        {/* Body — welcome state OR scrollable thread */}
        <div className="flex-1 min-h-0 relative">
          {!hasMessages ? (
            <WelcomeState
              onPick={(prompt) => sendPrompt(prompt)}
              disabled={isLoading}
            />
          ) : (
            <ScrollArea className="h-full">
              <div ref={scrollRef} className="px-4 py-4 flex flex-col gap-3">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer — input + signature line */}
        <div className="px-4 py-3 shrink-0 border-t border-border/40 bg-white/95">
          <ChatInput onSubmit={sendPrompt} disabled={isLoading} />
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>TYRO AI · Veriler dashboard'dan</span>
            {error && (
              <Link
                to="/settings"
                onClick={() => onOpenChange(false)}
                className="text-rose-600 hover:underline"
              >
                Ayarlar
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────── Welcome state ─────────── */

function WelcomeState({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  const accent = useThemeAccent();
  return (
    <div className="h-full flex flex-col px-4 py-6 gap-5">
      <div className="flex flex-col items-center gap-3 mt-4">
        <span
          className="size-12 rounded-2xl grid place-items-center text-white shadow-sm"
          style={{
            background: accent.tint,
            color: accent.solid,
          }}
        >
          <HugeiconsIcon icon={Robot01Icon} size={22} strokeWidth={1.75} />
        </span>
        <div className="text-center">
          <h3 className="text-[15px] font-semibold tracking-tight">
            Nasıl yardımcı olabilirim?
          </h3>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug max-w-[280px]">
            Dashboard, projeler ve veri yönetimi hakkında doğal dil
            sorularınızı yanıtlayabilirim.
          </p>
        </div>
      </div>
      <ChatSuggestions
        onPick={(prompt) => onPick(prompt)}
        disabled={disabled}
      />
    </div>
  );
}
