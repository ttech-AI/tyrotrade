import type { ReactNode } from "react";
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
  | { type: "ol"; content: string[] }
  | { type: "h"; level: number; content: string }
  | { type: "quote"; content: string[] }
  | { type: "code"; content: string[] }
  | { type: "hr" }
  | { type: "table"; header: string[]; rows: string[][] };

/**
 * Copilot Studio replies often carry raw HTML tags — line breaks (`<br>`,
 * `<hr>`), paragraphs (`<p>`) and inline emphasis (`<b>`/`<strong>`,
 * `<i>`/`<em>`). This renderer never interprets raw HTML (no dangerous
 * innerHTML), so those tags would otherwise show as literal text. Convert
 * them to their CommonMark equivalents before parsing. XSS-safe: we only
 * rewrite a fixed tag whitelist to markdown, never inject HTML.
 */
function normalizeMarkdown(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<\/?p\s*\/?>/gi, "\n\n")
    .replace(/<\/?(?:b|strong)\s*>/gi, "**")
    .replace(/<\/?(?:i|em)\s*>/gi, "*")
    .replace(/<\/?u\s*>/gi, "")
    .replace(/\n{3,}/g, "\n\n");
}

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
 * Render a lightweight subset of markdown covering everything the Copilot
 * agent emits: paragraphs, line breaks, `**bold**`, `*italic*`, `` `code` ``,
 * `[links](url)`, ATX headings (`#`..`######`), bullet lists ("- "), numbered
 * lists ("1. "), blockquotes ("> "), horizontal rules ("---"), fenced code
 * blocks (```), and GitHub-style tables (`| a | b |` + `|---|---|`).
 * Tables matter because the Copilot agent formats tabular answers as markdown
 * tables — Copilot Studio's own UI renders them, so this custom renderer must
 * too (otherwise the web-app chat shows mangled pipes). Kept dependency-free
 * (no react-markdown) while matching the corporate AI chat's rendered look.
 */
export function MarkdownText({ text }: { text: string }) {
  const lines = normalizeMarkdown(text).split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Fenced code block: ``` … ``` (optional language after the opening fence).
    const fence = /^\s*```/.test(line);
    if (fence) {
      const code: string[] = [];
      i++; // consume opening fence
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push({ type: "code", content: code });
      continue;
    }

    // Horizontal rule: a line that is only ---, *** or ___ (3+).
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

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

    // Blockquote: consecutive "> " lines fold into one quote block.
    if (/^\s*>\s?/.test(line)) {
      const item = line.replace(/^\s*>\s?/, "");
      const last = blocks[blocks.length - 1];
      if (last && last.type === "quote") last.content.push(item);
      else blocks.push({ type: "quote", content: [item] });
      i++;
      continue;
    }

    // ATX heading: `#`..`######` followed by a space. Copilot uses these
    // for section titles; without a case here the literal `##` leaks through.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    const isBullet = /^\s*[-*•]\s+/.test(line);
    const isOrdered = /^\s*\d+\.\s+/.test(line);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, content: heading[2].trim() });
    } else if (isBullet) {
      const last = blocks[blocks.length - 1];
      const item = line.replace(/^\s*[-*•]\s+/, "");
      if (last && last.type === "ul") last.content.push(item);
      else blocks.push({ type: "ul", content: [item] });
    } else if (isOrdered) {
      const last = blocks[blocks.length - 1];
      const item = line.replace(/^\s*\d+\.\s+/, "");
      if (last && last.type === "ol") last.content.push(item);
      else blocks.push({ type: "ol", content: [item] });
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
            <div key={bi} className="max-w-full overflow-x-auto">
              <table className="w-max border-collapse text-[12px]">
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
        if (b.type === "hr") {
          return <hr key={bi} className="my-2 border-border/60" />;
        }
        if (b.type === "code") {
          return (
            <pre
              key={bi}
              className="overflow-x-auto rounded-lg bg-muted/60 border border-border/50 px-3 py-2 text-[12px] leading-relaxed"
            >
              <code className="font-mono whitespace-pre">{b.content.join("\n")}</code>
            </pre>
          );
        }
        if (b.type === "quote") {
          return (
            <blockquote
              key={bi}
              className="border-l-2 border-border pl-3 text-muted-foreground italic space-y-0.5"
            >
              {b.content.map((c, j) => (
                <p key={j}>
                  <Inline text={c} />
                </p>
              ))}
            </blockquote>
          );
        }
        if (b.type === "h") {
          // Scale the three sensible heading levels down to chat-bubble size;
          // deeper levels collapse onto the smallest so nothing looks oversized.
          const cls =
            b.level <= 1
              ? "text-[15px] font-semibold text-foreground mt-1"
              : b.level === 2
                ? "text-[14px] font-semibold text-foreground mt-1"
                : "text-[13px] font-semibold text-foreground";
          return (
            <p key={bi} className={cls}>
              <Inline text={b.content} />
            </p>
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
        if (b.type === "ol") {
          return (
            <ol key={bi} className="list-decimal pl-4 space-y-0.5">
              {b.content.map((c, j) => (
                <li key={j}>
                  <Inline text={c} />
                </li>
              ))}
            </ol>
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

// One tokenizer pass over inline markdown. Order matters: inline code first
// (its content is never re-formatted), then links, then bold, then italic.
const INLINE_RE =
  /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

/** Render a single line, applying inline `code`, [links](url), **bold** and *italic*. */
function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  let key = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      // `inline code`
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      // [text](url) — only allow safe schemes, else fall back to raw text.
      const close = tok.indexOf("](");
      const label = tok.slice(1, close);
      const url = tok.slice(close + 2, -1);
      if (/^(https?:|mailto:)/i.test(url)) {
        nodes.push(
          <a
            key={key++}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: "#4338ca" }}
          >
            {label}
          </a>
        );
      } else {
        nodes.push(tok);
      }
    } else if (m[3]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      // *italic* or _italic_
      nodes.push(
        <em key={key++} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
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
