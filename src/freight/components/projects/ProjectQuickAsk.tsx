import * as React from "react";
import { createPortal } from "react-dom";
import { requestOpenChat } from "@/lib/chatBus";
import { ArrowUp } from "@/freight/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { TYRO_CHAT_TONE } from "@/freight/components/layout/TyroChatButton";
import type { Project } from "@/freight/lib/dataverse/entities";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

interface ProjectQuickAskProps {
  project: Project;
  anchor: { x: number; y: number };
  onClose: () => void;
  /** Called before submit so the chat panel can switch context to this project. */
  onSelectProject?: () => void;
}

/** Floating quick-ask popup rendered via portal at the right-click position. */
export function ProjectQuickAsk({ project, anchor, onClose, onSelectProject }: ProjectQuickAskProps) {
  const { t } = useLocale();
  const [question, setQuestion] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Auto-focus input when it mounts
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click or Escape
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Clamp to viewport so it doesn't overflow right/bottom edge
  const [pos, setPos] = React.useState({ left: anchor.x, top: anchor.y });
  React.useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: Math.min(anchor.x, window.innerWidth - rect.width - 12),
      top: Math.min(anchor.y, window.innerHeight - rect.height - 12),
    });
  }, [anchor]);

  function handleSubmit() {
    const q = question.trim();
    if (!q) return;
    onSelectProject?.();
    // Hand the question to tyroTrade's own chat rather than the source app's
    // Copilot Studio drawer. The question is parked in sessionStorage with its
    // project so the chat screen can pick it up once it has mounted, then the
    // shared chat bus opens the chat and focuses the composer.
    sessionStorage.setItem(
      "tyrotrade:chat:pendingAsk",
      JSON.stringify({ q, projectId: project.projectNo }),
    );
    requestOpenChat({ focusComposer: true });
    onClose();
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      className={cn(
        "w-96 rounded-2xl overflow-hidden",
        // Floating overlay → popover surface, so it inverts in dark mode.
        "bg-[color-mix(in_oklab,var(--popover)_95%,transparent)] backdrop-blur-xl backdrop-saturate-150",
        "border border-border/50",
        "shadow-[0_16px_48px_-8px_color-mix(in_oklab,var(--foreground)_22%,transparent),0_4px_12px_-4px_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Accent bar */}
      <div className="h-0.5 w-full" style={{ background: TYRO_CHAT_TONE.gradient }} />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-start gap-2.5">
        <span
          className="size-8 rounded-xl grid place-items-center shrink-0 text-white mt-0.5"
          style={{
            background: TYRO_CHAT_TONE.gradient,
            boxShadow: `0 4px 8px -3px ${TYRO_CHAT_TONE.ring}`,
          }}
        >
          <HugeiconsIcon icon={BubbleChatIcon} size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground leading-snug break-words line-clamp-3">
            {project.projectName}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
            {project.projectNo}
          </p>
        </div>
      </div>

      {/* Input row */}
      <div className="px-3 pb-3.5">
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border/50 bg-[color-mix(in_oklab,var(--muted)_80%,transparent)] px-3 py-2",
            "focus-within:border-brand-via/40 focus-within:shadow-[0_0_0_2px_color-mix(in_oklab,var(--brand-via)_10%,transparent)]",
            "transition-all duration-150"
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
            }}
            placeholder={t("proj.quickAsk.placeholder")}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50 min-w-0"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!question.trim()}
            className="size-7 rounded-lg grid place-items-center shrink-0 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            style={{
              background: TYRO_CHAT_TONE.gradient,
              boxShadow: `0 3px 8px -2px ${TYRO_CHAT_TONE.ring}`,
            }}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-1.5 px-0.5">
          {t("proj.quickAsk.hint")}
        </p>
      </div>
    </div>,
    document.body
  );
}
