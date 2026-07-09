import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain02Icon } from "@hugeicons/core-free-icons";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export interface ChatMessageData {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
  /** Set on the AI message currently waiting for a response so the
   *  bubble can render a 3-dot loader instead of empty text. */
  pending?: boolean;
}

interface ChatMessageProps {
  message: ChatMessageData;
  className?: string;
}

/**
 * Render a single chat bubble. User messages right-aligned with an
 * accent bubble; AI messages left-aligned with a small avatar +
 * glass card. Light markdown subset ( **bold**, line breaks,
 * "- " bullet lists ) is rendered inline.
 */
export function ChatMessage({ message, className }: ChatMessageProps) {
  const accent = useThemeAccent();
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className={cn("flex justify-end", className)}>
        <div
          className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm"
          style={{
            // User bubble tint follows the theme accent so user messages
            // and the send button + drawer avatar all share the same hue.
            background: accent.tint,
            border: `1px solid ${accent.ring}`,
            color: "#0f172a",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex gap-2 items-start", className)}>
      <span
        className="size-7 rounded-xl grid place-items-center shrink-0 shadow-sm text-white mt-0.5"
        style={{
          background: accent.gradient,
          boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
        }}
      >
        <HugeiconsIcon icon={AiBrain02Icon} size={14} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-white/85 border border-border/50 shadow-sm">
          {message.pending ? <PendingDots /> : <MarkdownText text={message.text} />}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Tiny markdown subset ─────────── */

type MdBlock =
  | { type: "p"; content: string[] }
  | { type: "ul"; content: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

/** Split a `| a | b |` row into trimmed cells (leading/trailing pipes stripped). */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** A markdown table separator row, e.g. `| --- | :--: | ---: |`. */
function isTableSeparator(line: string): boolean {
  const s = line.trim();
  if (!s.includes("-") || !s.includes("|")) return false;
  const cells = splitTableRow(s);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));
}

/**
 * Render a small subset of markdown: paragraphs, line breaks, `**bold**`,
 * bullet lines ("- "), and GitHub-style tables (`| a | b |` + `|---|---|`).
 * Tables matter because the Copilot agent formats tabular answers as markdown
 * tables — Copilot Studio's own UI renders them, so this custom renderer must
 * too (otherwise the web-app chat shows mangled pipes). Kept lightweight (no
 * react-markdown dependency).
 */
export function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Table: a row containing "|" immediately followed by a separator row.
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2; // consume header + separator
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        lines[i].includes("|") &&
        !isTableSeparator(lines[i])
      ) {
        rows.push(splitTableRow(lines[i].trimEnd()));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const isBullet = /^\s*[-*•]\s+/.test(line);
    if (isBullet) {
      const last = blocks[blocks.length - 1];
      const item = line.replace(/^\s*[-*•]\s+/, "");
      if (last && last.type === "ul") last.content.push(item);
      else blocks.push({ type: "ul", content: [item] });
    } else if (line.trim() === "") {
      if (blocks.length && blocks[blocks.length - 1].type === "p") {
        blocks.push({ type: "p", content: [] });
      }
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "p") last.content.push(line);
      else blocks.push({ type: "p", content: [line] });
    }
    i++;
  }

  return (
    <div className="space-y-1.5">
      {blocks.map((b, bi) => {
        if (b.type === "table") {
          return (
            <div key={bi} className="overflow-x-auto -mx-1">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {b.header.map((h, j) => (
                      <th
                        key={j}
                        className="text-left font-semibold px-2 py-1 border-b border-border/60 whitespace-nowrap"
                      >
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri} className="border-b border-border/25">
                      {r.map((c, ci) => (
                        <td key={ci} className="px-2 py-1 align-top tabular-nums whitespace-nowrap">
                          <Inline text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={bi} className="list-disc pl-4 space-y-0.5">
              {b.content.map((c, j) => (
                <li key={j}>
                  <Inline text={c} />
                </li>
              ))}
            </ul>
          );
        }
        return b.content.length === 0 ? null : (
          <p key={bi}>
            {b.content.map((c, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inline text={c} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Render a single line, applying `**bold**` segments. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/* ─────────── Pending state ─────────── */

function PendingDots() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="text-[12px]">{t("ai.thinking")}</span>
      <span className="inline-flex gap-0.5">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
    </span>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1 rounded-full bg-current animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}
