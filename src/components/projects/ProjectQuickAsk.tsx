import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowUp } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import type { Project } from "@/lib/dataverse/entities";
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
    // Bundle question + target projectId so the chat waits for context to
    // settle to the right project before sending — guards against React's
    // transition batching where projectContext can lag behind state updates.
    sessionStorage.setItem(
      "tyro:chat:pendingAsk",
      JSON.stringify({ q, projectId: project.projectNo })
    );
    window.dispatchEvent(new CustomEvent("tyro:askInChat"));
    onClose();
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      className={cn(
        "w-72 rounded-2xl overflow-hidden",
        "bg-white/95 backdrop-blur-xl backdrop-saturate-150",
        "border border-border/50",
        "shadow-[0_16px_48px_-8px_rgba(15,23,42,0.22),0_4px_12px_-4px_rgba(15,23,42,0.08)]"
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Accent bar */}
      <div className="h-0.5 w-full" style={{ background: TYRO_CHAT_TONE.gradient }} />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
        <span
          className="size-6 rounded-lg grid place-items-center shrink-0 text-white"
          style={{
            background: TYRO_CHAT_TONE.gradient,
            boxShadow: `0 4px 8px -3px ${TYRO_CHAT_TONE.ring}`,
          }}
        >
          <HugeiconsIcon icon={BubbleChatIcon} size={12} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-700 leading-tight truncate">
            {project.projectName}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            {project.projectNo}
          </p>
        </div>
      </div>

      {/* Input row */}
      <div className="px-2 pb-2.5">
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-xl border border-border/50 bg-slate-50/80 px-2.5 py-1.5",
            "focus-within:border-[#6366f1]/40 focus-within:shadow-[0_0_0_2px_rgba(99,102,241,0.10)]",
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
            placeholder="Bu proje hakkında sorun…"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/50 min-w-0"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!question.trim()}
            className="size-6 rounded-lg grid place-items-center shrink-0 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            style={{
              background: TYRO_CHAT_TONE.gradient,
              boxShadow: `0 3px 8px -2px ${TYRO_CHAT_TONE.ring}`,
            }}
          >
            <ArrowUp className="size-3" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1 px-0.5">
          Enter → TYRO Chat'te yanıtla
        </p>
      </div>
    </div>,
    document.body
  );
}
