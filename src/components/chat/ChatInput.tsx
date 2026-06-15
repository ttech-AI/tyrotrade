import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** aria-label for the send button (localised by the parent). */
  sendAria?: string;
  className?: string;
}

/**
 * Single-line chat input with a paper-plane send button. Submits on
 * Enter (without Shift), but Shift+Enter inserts a newline so multi-
 * line questions are still possible. Send button stays disabled
 * while the AI is thinking.
 */
export function ChatInput({
  onSubmit,
  disabled,
  placeholder = "Bir şey sorun…",
  sendAria = "Gönder",
  className,
}: ChatInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const accent = useThemeAccent();

  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0;

  function handleSubmit() {
    if (!canSend) return;
    onSubmit(trimmed);
    setValue("");
    // Reset height after clear
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Auto-grow up to ~4 lines, then scroll
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }

  return (
    <div
      className={cn(
        "relative flex items-end gap-2",
        "rounded-2xl bg-white/95 border border-border/60",
        "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]",
        "px-3 py-2",
        "transition-shadow",
        className
      )}
      style={{
        // Focus ring + glow follow the live theme accent so the input
        // matches the send button's gradient.
        ["--ai-accent-ring" as string]: accent.ring,
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = accent.solid;
        e.currentTarget.style.boxShadow = `0 4px 14px -4px ${accent.ring}`;
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent outline-none",
          "text-[13px] leading-relaxed",
          "placeholder:text-muted-foreground/70",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSend}
        aria-label={sendAria}
        className={cn(
          "size-8 rounded-xl grid place-items-center shrink-0 shadow-sm text-white",
          "transition-all duration-200",
          canSend ? "hover:scale-[1.06] active:scale-95" : "opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        )}
        style={{
          background: accent.gradient,
          boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
        }}
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}
