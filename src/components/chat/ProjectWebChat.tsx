import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import {
  CopilotStudioClient,
  ConnectionSettings,
} from "@microsoft/agents-copilotstudio-client";
import type { Activity } from "@microsoft/agents-activity";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { shouldUseMock } from "@/lib/dataverse";
import { MarkdownText } from "./ChatMessage";
import { isAuthConfigured, COPILOT_STUDIO_SCOPE } from "@/lib/auth/msal";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import { cn } from "@/lib/utils";

// Regenerated on every page load (module re-evaluation). Same value across
// component mount/unmount within a session → messages persist when drawer
// closes and reopens. New value on page refresh → stale storage is ignored.
const PAGE_SESSION_ID = Math.random().toString(36).slice(2);

const COPILOT_SETTINGS = new ConnectionSettings({
  directConnectUrl: import.meta.env.VITE_COPILOT_DIRECT_CONNECT_URL as string,
  environmentId: import.meta.env.VITE_COPILOT_ENVIRONMENT_ID as string,
  schemaName: import.meta.env.VITE_COPILOT_BOT_SCHEMA as string,
});

export interface ProjectContext {
  projectId: string;
  projectName: string;
}

export interface UserContext {
  name: string;
  email: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  pending?: boolean;   // waiting for first token — show dots
  streaming?: boolean; // tokens arriving — show text + cursor
}

interface ProjectWebChatProps {
  projectContext?: ProjectContext;
  userContext?: UserContext;
}

/**
 * Outer shell — guards against calling useMsal() when MsalProvider is not
 * mounted (mock mode or incomplete auth config).
 */
export function ProjectWebChat(props: ProjectWebChatProps) {
  // Dev-only visual preview — bypasses auth so the redesigned chat can be
  // eyeballed without a Copilot/MSAL login. Open with `?chatpreview=1`.
  // Stripped from production builds (import.meta.env.DEV is false there).
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("chatpreview")
  ) {
    return <ChatPreview />;
  }
  if (shouldUseMock() || !isAuthConfigured) {
    return (
      <div className="h-full flex items-center justify-center px-8 text-center">
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          TYRO Chat gerçek mod gerektirir.
          <br />
          <span className="font-medium text-foreground">VITE_USE_MOCK=false</span>{" "}
          ile oturum açın.
        </p>
      </div>
    );
  }
  return <ProjectWebChatCore {...props} />;
}

/**
 * Inner component — safe to call useMsal() here because the outer guard
 * ensures MsalProvider is mounted before this renders.
 */
function ProjectWebChatCore({ projectContext, userContext }: ProjectWebChatProps) {
  const { instance, accounts } = useMsal();

  // Restore messages only when page session AND project both match.
  // Page refresh generates a new PAGE_SESSION_ID → stored data is ignored.
  // Different project → start fresh so stale history doesn't bleed across.
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem("tyro:chat:session");
      if (!raw) return [];
      const stored = JSON.parse(raw) as {
        pageSessionId: string;
        projectId: string | null;
        messages: ChatMessage[];
      };
      const currentId = projectContext?.projectId ?? null;
      if (stored.pageSessionId !== PAGE_SESSION_ID) return [];
      return stored.projectId === currentId ? stored.messages : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [initKey, setInitKey] = React.useState(0);

  // True when component mounts with prior session messages → skip greeting.
  const hadPriorSession = React.useRef(messages.length > 0);

  const clientRef = React.useRef<CopilotStudioClient | null>(null);
  const contextRef = React.useRef(projectContext);
  const userContextRef = React.useRef(userContext);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const readyRef = React.useRef(false);
  // Generation counter — increment to abort any in-flight streaming loop.
  // Each send captures its own gen at start and checks it on every iteration.
  const abortGenRef = React.useRef(0);
  // Pending question stored in a ref + a counter to force re-run of the
  // send effect. Refs are always current (no closure staleness) and the
  // counter guarantees the effect fires on every new quick-ask. The
  // projectId is bundled with the question so the send effect can wait
  // until projectContext settles to the matching project before sending.
  const pendingQuestionRef = React.useRef<{ q: string; projectId: string } | null>(null);
  const [askTrigger, setAskTrigger] = React.useState(0);

  // Listen for quick-ask events + check sessionStorage on mount so a
  // question fired before this component mounted is still picked up.
  React.useEffect(() => {
    function pickUpPending() {
      const raw = sessionStorage.getItem("tyro:chat:pendingAsk");
      if (!raw) return;
      sessionStorage.removeItem("tyro:chat:pendingAsk");
      let parsed: { q: string; projectId: string } | null = null;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.q === "string" && typeof obj.projectId === "string") {
          parsed = obj;
        }
      } catch {
        parsed = { q: raw, projectId: "" };
      }
      if (!parsed) return;
      pendingQuestionRef.current = parsed;
      setAskTrigger((t) => t + 1);
    }
    pickUpPending();
    window.addEventListener("tyro:askInChat", pickUpPending);
    return () => window.removeEventListener("tyro:askInChat", pickUpPending);
  }, []);

  React.useEffect(() => {
    contextRef.current = projectContext;
  }, [projectContext]);

  React.useEffect(() => {
    userContextRef.current = userContext;
  }, [userContext]);

  // Clear chat history when switching to a different project so the
  // panel shows a fresh conversation scoped to the new project.
  // Declared BEFORE the persist effect so the clear runs first when
  // projectId changes — otherwise we'd briefly write old messages
  // under the new project key.
  const prevProjectIdRef = React.useRef<string | undefined>(projectContext?.projectId);
  React.useEffect(() => {
    const currentId = projectContext?.projectId;
    if (prevProjectIdRef.current !== currentId) {
      prevProjectIdRef.current = currentId;
      setMessages([]);
    }
  }, [projectContext?.projectId]);

  // Persist messages tagged with page session + project ID.
  React.useEffect(() => {
    try {
      sessionStorage.setItem(
        "tyro:chat:session",
        JSON.stringify({
          pageSessionId: PAGE_SESSION_ID,
          projectId: projectContext?.projectId ?? null,
          messages,
        })
      );
    } catch { /* ignore quota errors */ }
  }, [messages, projectContext?.projectId]);

  // Send pending question: fires whenever a new quick-ask arrives (askTrigger)
  // or when the project context settles. Does NOT guard on busy — instead,
  // sendPendingQuestion bumps abortGenRef to cancel any in-flight stream.
  React.useEffect(() => {
    const pending = pendingQuestionRef.current;
    if (!ready || !clientRef.current) return;
    if (!pending) return;
    // Wait for context to settle to the target project (only if a
    // target projectId was specified — legacy/plain pending has "").
    if (pending.projectId && projectContext?.projectId !== pending.projectId) return;
    pendingQuestionRef.current = null;
    void sendPendingQuestion(pending.q);
  }, [ready, askTrigger, projectContext?.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!ready || !projectContext || !clientRef.current) return;
    void sendEvent(clientRef.current, projectContext);
  }, [projectContext?.projectId, projectContext?.projectName, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialise: get token → create client → start conversation → send context.
  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = await getToken(instance, accounts);
        if (cancelled) return;

        const client = new CopilotStudioClient(COPILOT_SETTINGS, token);
        clientRef.current = client;

        setBusy(true);

        // Stream greeting — consume the generator to complete the handshake.
        // If restoring a prior session, suppress display so the old history
        // remains intact without a duplicate welcome message.
        const showGreeting = !hadPriorSession.current;
        const GREETING_ID = "greeting";
        let hadGreetingChunks = false;
        let firstGreetingMsg = true;

        for await (const activity of client.startConversationStreaming()) {
          if (cancelled) return;
          if (!showGreeting) continue;
          if (isStreamingChunk(activity) && activity.text != null) {
            hadGreetingChunks = true;
            if (firstGreetingMsg) {
              firstGreetingMsg = false;
              setMessages([
                { id: GREETING_ID, role: "bot", text: activity.text, streaming: true },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === GREETING_ID ? { ...m, text: activity.text! } : m
                )
              );
            }
          } else if (
            activity.type === "message" &&
            activity.from?.role === "bot" &&
            activity.text
          ) {
            if (hadGreetingChunks || firstGreetingMsg) {
              firstGreetingMsg = false;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === GREETING_ID);
                const msg = { id: GREETING_ID, role: "bot" as const, text: activity.text!, streaming: true };
                return existing ? prev.map((m) => m.id === GREETING_ID ? msg : m) : [...prev, msg];
              });
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === GREETING_ID
                    ? { ...m, text: m.text + "\n" + activity.text! }
                    : m
                )
              );
            }
          }
        }

        if (cancelled) return;

        if (showGreeting) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === GREETING_ID ? { ...m, streaming: false } : m
            )
          );
        }

        readyRef.current = true;
        setReady(true);
        setBusy(false);

        const uCtx = userContextRef.current;
        if (uCtx) await sendUserContext(client, uCtx);
        const ctx = contextRef.current;
        if (ctx) await sendEvent(client, ctx);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof InteractionRequiredAuthError) {
          sessionStorage.setItem("tyro:openChatAfterAuth", "1");
          void instance.acquireTokenRedirect({
            scopes: [COPILOT_STUDIO_SCOPE],
            account: accounts[0],
          });
          return;
        }
        setError(err instanceof Error ? err.message : "Bağlantı hatası");
        setBusy(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [initKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const text = input.trim();
    if (!text || !clientRef.current || busy) return;

    const gen = ++abortGenRef.current;
    setInput("");
    const userId = `u${Date.now()}`;
    const botId = `b${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text },
      { id: botId, role: "bot", text: "", pending: true },
    ]);
    setBusy(true);

    // Silently prepend user + project context so the bot knows who is
    // asking and which project is active without the user repeating it.
    const uCtx = userContextRef.current;
    const ctx = contextRef.current;
    const userLine = uCtx ? `[Kullanıcı: ${uCtx.name} <${uCtx.email}>]\n` : "";
    const projectLine = ctx
      ? `[Aktif Proje: ${ctx.projectName} - ${ctx.projectId}]\n`
      : "[Aktif Proje: yok]\n";
    const enrichedText = `${userLine}${projectLine}${text}`;

    try {
      const activity = { type: "message", text: enrichedText } as Activity;
      let hadStreamingChunks = false;
      let firstMessage = true;

      for await (const reply of clientRef.current.sendActivityStreaming(activity)) {
        if (abortGenRef.current !== gen) break;
        if (isStreamingChunk(reply) && reply.text != null) {
          hadStreamingChunks = true;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? { ...m, text: reply.text!, pending: false, streaming: true }
                : m
            )
          );
        } else if (reply.type === "message" && reply.from?.role === "bot" && reply.text) {
          if (hadStreamingChunks || firstMessage) {
            firstMessage = false;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId
                  ? { ...m, text: reply.text!, pending: false, streaming: true }
                  : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId
                  ? { ...m, text: m.text + "\n" + reply.text! }
                  : m
              )
            );
          }
        }
      }

      if (abortGenRef.current !== gen) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, text: m.text || "…", pending: false, streaming: false }
            : m
        )
      );
    } catch {
      if (abortGenRef.current !== gen) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, text: "Yanıt alınamadı.", pending: false, streaming: false }
            : m
        )
      );
    } finally {
      if (abortGenRef.current === gen) {
        setBusy(false);
        inputRef.current?.focus();
      }
    }
  }

  async function sendPendingQuestion(text: string) {
    if (!clientRef.current) return;
    // Bump generation to abort any in-flight handleSend/sendPendingQuestion loop.
    const gen = ++abortGenRef.current;
    const userId = `u${Date.now()}`;
    const botId = `b${Date.now()}`;
    // Finalize any dangling streaming/pending bot message from the aborted stream,
    // then append the new user message + bot placeholder in one state update.
    setMessages((prev) => {
      const finalized = prev.map((m) =>
        m.streaming || m.pending
          ? { ...m, streaming: false, pending: false, text: m.text || "…" }
          : m
      );
      return [
        ...finalized,
        { id: userId, role: "user" as const, text },
        { id: botId, role: "bot" as const, text: "", pending: true },
      ];
    });
    setBusy(true);
    const uCtx = userContextRef.current;
    const ctx = contextRef.current;
    const userLine = uCtx ? `[Kullanıcı: ${uCtx.name} <${uCtx.email}>]\n` : "";
    const projectLine = ctx
      ? `[Aktif Proje: ${ctx.projectName} - ${ctx.projectId}]\n`
      : "[Aktif Proje: yok]\n";
    const enrichedText = `${userLine}${projectLine}${text}`;
    try {
      const activity = { type: "message", text: enrichedText } as Activity;
      let hadChunks = false;
      let firstMsg = true;
      for await (const reply of clientRef.current.sendActivityStreaming(activity)) {
        if (abortGenRef.current !== gen) break;
        if (isStreamingChunk(reply) && reply.text != null) {
          hadChunks = true;
          setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, text: reply.text!, pending: false, streaming: true } : m));
        } else if (reply.type === "message" && reply.from?.role === "bot" && reply.text) {
          if (hadChunks || firstMsg) {
            firstMsg = false;
            setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, text: reply.text!, pending: false, streaming: true } : m));
          } else {
            setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, text: m.text + "\n" + reply.text! } : m));
          }
        }
      }
      if (abortGenRef.current !== gen) return;
      setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, text: m.text || "…", pending: false, streaming: false } : m));
    } catch {
      if (abortGenRef.current !== gen) return;
      setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, text: "Yanıt alınamadı.", pending: false, streaming: false } : m));
    } finally {
      if (abortGenRef.current === gen) setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] font-medium text-foreground">Bağlantı kurulamadı</p>
        <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-xs">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReady(false);
            clientRef.current = null;
            setInitKey((k) => k + 1);
          }}
          className="text-[12px] font-semibold underline-offset-2 hover:underline transition-opacity hover:opacity-70"
          style={{ color: TYRO_CHAT_TONE.solid }}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!ready && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <OrbAvatar size={44} />
          <div className="flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full animate-bounce"
                style={{ background: TYRO_CHAT_TONE.solid, animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <p className="text-[11.5px] text-muted-foreground">Bağlanıyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/40 px-3 py-3 bg-background/80 backdrop-blur-sm">
        <div className="chat-composer-beam rounded-2xl">
          <div
            className={cn(
              "flex items-end gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2",
              "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]"
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir şey sorun…"
              rows={1}
              disabled={busy}
              className={cn(
                "flex-1 resize-none bg-transparent block text-foreground",
                "text-[13px] leading-[20px] outline-none py-1.5",
                "placeholder:text-muted-foreground/60 disabled:opacity-50",
                "max-h-32 overflow-y-auto"
              )}
              style={{ height: "32px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "32px";
                if (el.scrollHeight > 32) {
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || busy}
              className="size-8 rounded-full grid place-items-center shrink-0 text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-35 disabled:pointer-events-none shadow-sm"
              style={{
                background: TYRO_CHAT_TONE.gradient,
                boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}`,
              }}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modern chat sub-components (mirror the corporate AI chat) ──────────── */

/**
 * Soft glowing gradient orb — the AI avatar. Modeled on the corporate AI
 * chat's PastelVoiceOrb (layered radial base + white highlight + a slowly
 * rotating conic undercurrent + a colored glow halo + gentle breathing),
 * recolored into this chat's indigo/violet family for cohesion. No glyph.
 */
function OrbAvatar({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <motion.span
      aria-hidden
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        boxShadow: "0 4px 14px -2px rgba(99,102,241,0.50), 0 2px 6px rgba(139,92,246,0.35)",
      }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <span
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.98) 0%, rgba(199,210,254,0.92) 20%, rgba(129,140,248,0.72) 48%, rgba(99,102,241,0.85) 76%, rgba(67,56,202,0.95) 100%)",
          boxShadow: "inset 0 0 8px rgba(255,255,255,0.55)",
        }}
      >
        <motion.span
          className="absolute -inset-2 rounded-full"
          style={{
            mixBlendMode: "multiply",
            opacity: 0.55,
            filter: "blur(4px)",
            background:
              "conic-gradient(from 210deg at 50% 50%, rgba(255,255,255,0.30), rgba(139,92,246,0.50), rgba(99,102,241,0.55), rgba(139,92,246,0.40), rgba(255,255,255,0.30))",
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </span>
    </motion.span>
  );
}

/**
 * One chat row — user (right, soft-tint bubble) or bot (left, gradient
 * avatar + "TYRO" label + card bubble with markdown, streaming cursor and a
 * copy action). Shared by the live chat and the dev preview.
 */
function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end"
      >
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground"
          style={{
            // Soft accent tint (matches the corporate AI chat's user bubble).
            // Semi-transparent indigo sits well over both light and dark cards.
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.30)",
          }}
        >
          <span className="whitespace-pre-wrap">{msg.text}</span>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-2 items-start"
    >
      <OrbAvatar size={28} className="mt-0.5" />
      <div className="flex flex-col items-start min-w-0 max-w-[calc(100%-2.25rem)]">
        <span className="mb-1 text-[11px] font-semibold text-muted-foreground">TYRO</span>
        <div className="min-w-0 max-w-full rounded-2xl rounded-tl-md border border-border/60 bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground shadow-sm">
          {msg.pending ? (
            <TypingIndicator />
          ) : (
            <>
              <MarkdownText text={msg.text} />
              {msg.streaming && (
                <span
                  className="inline-block w-0.5 h-[1em] ml-0.5 align-middle animate-pulse rounded-full"
                  style={{ background: TYRO_CHAT_TONE.solid }}
                />
              )}
            </>
          )}
        </div>
        {!msg.pending && !msg.streaming && msg.text && msg.text !== "…" && (
          <div className="mt-1">
            <CopyButton text={msg.text} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

const TYPING_PHRASES = ["Düşünüyor", "Yanıt hazırlanıyor", "Neredeyse hazır"];

/**
 * "Yazıyor" indicator — a brand-gradient shimmer sweeping across a status
 * word that crossfades through a natural progression, plus a soft dot wave.
 * Loops so the indicator stays alive even if the reply is slow.
 */
function TypingIndicator() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const id = setTimeout(() => setStep((s) => (s + 1) % TYPING_PHRASES.length), 1600);
    return () => clearTimeout(id);
  }, [step]);
  return (
    <span className="inline-flex items-center gap-1.5 py-0.5">
      <span className="grid">
        <AnimatePresence initial={false}>
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 5, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -5, filter: "blur(3px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="chat-shimmer-text text-[12.5px] font-medium tracking-tight [grid-area:1/1] whitespace-nowrap"
          >
            {TYPING_PHRASES[step]}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="inline-flex items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="chat-typing-dot size-1 rounded-full"
            style={{ background: "rgba(67,56,202,0.6)", animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Copy-to-clipboard control shown under each finished assistant message. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Kopyalandı");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Kopyalanamadı");
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Kopyala"
      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground/70 transition hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
    </button>
  );
}

/* ─── Dev-only preview (no auth) ────────────────────────────────────────── */

const PREVIEW_ANSWER = `## 🚢 AMANI — P&L Özeti
Proje: **CORN // 40KMT** · \`PRJ000002292\` · Segment: Iraq

### 📊 P&L Tablosu (USD)

| Kalem | Tahmini | Gerçekleşen | Sapma |
|---|---|---|---|
| Satış | +16.255.395 | +16.255.395 | 0 |
| Alım | −12.366.315 | −12.366.315 | 0 |
| Gider | −2.397.330 | −2.356.971 | −40.359 |
| **Kar / Zarar** | **+1.491.750** | **+1.532.109** | **+40.359** |

### 🔍 Temel Fiyatlar
- Satış: **277,87 $/MT**
- Alım: **211,39 $/MT**
- Gider: *40,98 $/MT* (tahmini)

> ✅ Gerçekleşen kâr tahminin **+40.359 $** üzerinde — giderler bütçenin altında kaldı.

### 🧾 Faturalar (geniş tablo — yatay kaydır)

| Fatura No | Tarih | Müşteri | Sipariş No | Ürün | Miktar | Tutar | Para Birimi |
|---|---|---|---|---|---|---|---|
| SLT0002 | 30.06.2026 | AVISORES CA | AFZSSS000000002 | MISIR BÜTÜN | 25.000.000 KG | 7.656.910,37 | USD |
| SLT0001 | 30.06.2026 | ALIMENTOS GLOBAL GOURMET C.A. | AFZSSS000000003 | SOYA KÜSPESİ | 5.270.878 KG | 2.450.958,27 | USD |`;

const PREVIEW_MESSAGES: ChatMessage[] = [
  { id: "p-greet", role: "bot", text: "Merhaba 👋 Ben TYRO. Projeler, gemiler ve P&L hakkında soru sorabilirsin." },
  { id: "p-user", role: "user", text: "AMANI gemisinin P&L'ini ver" },
  { id: "p-bot", role: "bot", text: PREVIEW_ANSWER },
  { id: "p-typing", role: "bot", text: "", pending: true },
];

/** Renders the chat shell with canned messages + a static composer. */
function ChatPreview() {
  return (
    <div className="h-full flex flex-col bg-muted/20">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {PREVIEW_MESSAGES.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </div>
      <div className="shrink-0 border-t border-border/40 px-3 py-3 bg-background/80 backdrop-blur-sm">
        <div className="chat-composer-beam rounded-2xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]">
            <span className="flex-1 py-1.5 text-[13px] text-muted-foreground/60">Bir şey sorun…</span>
            <span
              className="size-8 rounded-full grid place-items-center shrink-0 text-white shadow-sm"
              style={{ background: TYRO_CHAT_TONE.gradient, boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}` }}
            >
              <ArrowUp className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getToken(
  instance: ReturnType<typeof useMsal>["instance"],
  accounts: ReturnType<typeof useMsal>["accounts"]
): Promise<string> {
  const account = accounts[0];
  if (!account) throw new Error("Microsoft oturumu bulunamadı.");
  const request = { scopes: [COPILOT_STUDIO_SCOPE], account };
  const result = await instance.acquireTokenSilent(request);
  return result.accessToken;
}

/**
 * Returns true when an activity is a streaming text chunk from the SDK.
 *
 * The Copilot Studio SDK yields `typing` activities while the bot is
 * generating its response. Each one carries the CUMULATIVE text so far
 * (sorted and joined from all received chunks). The streaming metadata
 * lives in either `channelData.streamType` (legacy) or an `entities`
 * entry with `type === "streaminfo"`.
 */
function isStreamingChunk(activity: Activity): boolean {
  if (activity.type !== "typing") return false;
  const cd = activity.channelData as { streamType?: string } | undefined;
  if (cd?.streamType === "streaming") return true;
  const entities = activity.entities as
    | Array<{ type?: string; streamType?: string }>
    | undefined;
  return !!entities?.some(
    (e) => e.type === "streaminfo" && e.streamType === "streaming"
  );
}

/** Send a setUserContext event activity so the bot knows who is speaking. */
async function sendUserContext(
  client: CopilotStudioClient,
  ctx: UserContext
): Promise<void> {
  const activity = {
    type: "event",
    name: "setUserContext",
    value: { userName: ctx.name, userEmail: ctx.email },
  } as Activity;
  for await (const _ of client.sendActivityStreaming(activity)) {
    // noop — consume generator so the HTTP request completes
  }
}

/** Send a setProjectContext event activity; ignore any bot response. */
async function sendEvent(
  client: CopilotStudioClient,
  ctx: ProjectContext
): Promise<void> {
  const activity = {
    type: "event",
    name: "setProjectContext",
    value: { projectId: ctx.projectId, projectName: ctx.projectName },
  } as Activity;
  for await (const _ of client.sendActivityStreaming(activity)) {
    // noop — consume generator so the HTTP request completes
  }
}
