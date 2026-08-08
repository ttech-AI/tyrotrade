import { memo, useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick01Icon, File01Icon, Download01Icon, Refresh01Icon, Alert02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { normalizeBotMarkdown } from "@/lib/markdown"
import { getDateTimeFormat } from "@/lib/intl-cache"
import { useLocale } from "@/hooks/useLocale"
import { useMe } from "@/hooks/useMe"
import { UserAvatar } from "@/components/common/UserAvatar"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useConfig } from "@/hooks/useConfig"
import { AdaptiveCardView } from "./AdaptiveCardView"

const TIME_FORMAT_OPTIONS = { hour: "2-digit", minute: "2-digit" }

// Kullanıcının gönderdiği dosya chip'inde gösterilen boyut etiketi.
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// Botun döndürdüğü dosya attachment'ından indirilebilir bir URL çıkarır.
// Adaptive Card DEĞİL; data: URI ya da http(s) bağlantı olabilir; bazı bot
// kartlarında dosya content içinde (downloadUrl/url) gelir.
function attachmentDownloadUrl(att) {
  if (att?.contentUrl) return att.contentUrl
  const c = att?.content
  if (c && typeof c === "object") return c.downloadUrl || c.url || null
  return null
}

// Botun gönderdiği bir dosyayı indirilebilir chip olarak gösterir.
function FileAttachment({ att }) {
  const { t } = useLocale()
  const url = attachmentDownloadUrl(att)
  if (!url) return null
  const name = att.name || att.content?.name || t("chat.attach.file")
  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm transition hover:border-brand-via/50 hover:bg-brand-soft/20"
    >
      <HugeiconsIcon icon={File01Icon} className="size-4 shrink-0 text-brand-deep" strokeWidth={1.6} />
      <span className="max-w-[200px] truncate font-medium" title={name}>
        {name}
      </span>
      <HugeiconsIcon
        icon={Download01Icon}
        className="size-4 shrink-0 text-muted-foreground transition group-hover:text-brand-deep"
        strokeWidth={1.8}
      />
    </a>
  )
}

// "Yazıyor" göstergesi — premium: brand-gradient shimmer ile parlayan, yumuşak
// crossfade ile ilerleyen durum kelimesi + ince nokta dalgası. Kelimeler doğal
// bir ilerleme verir (Düşünüyor → Yanıt hazırlanıyor → Neredeyse hazır) ve son
// kelimede DURMAZ — başa sarıp sürekli döngüde döner; böylece yanıt gecikse
// bile gösterge "canlı" kalır, son adımda donup kalmaz.
function TypingIndicator() {
  const { t } = useLocale()
  const phrases = [t("chat.typing.0"), t("chat.typing.1"), t("chat.typing.2")]
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setStep((s) => (s + 1) % phrases.length), 1600)
    return () => clearTimeout(id)
  }, [step, phrases.length])

  return (
    <span aria-live="polite" aria-label={phrases[step]} className="inline-flex items-baseline gap-1 py-0.5">
      <span className="grid">
        <AnimatePresence initial={false}>
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="chat-shimmer-text text-sm font-medium tracking-tight [grid-area:1/1] whitespace-nowrap"
          >
            {phrases[step]}
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-hidden className="inline-flex items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="chat-typing-dot size-1 rounded-full bg-brand-via/70"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </span>
    </span>
  )
}

function formatTime(date, locale) {
  return getDateTimeFormat(locale, TIME_FORMAT_OPTIONS).format(date)
}

// Bubble width tokens — wider on phones (more reading room when the user
// only sees one bubble at a time), narrower on tablet/desktop where two
// columns of context fit. ch-based caps on md+ keep long replies readable
// (max ~ 65 characters per line, the typographic comfort range).
const BUBBLE_MAX_WIDTH = "max-w-[88%] sm:max-w-[78%] md:max-w-[65ch]"

// Copy-to-clipboard button rendered next to the timestamp on assistant
// messages. Always visible on touch (no hover-reveal trap). Shows a brief
// "copied" tick on success.
function CopyButton({ content }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content ?? "")
      setCopied(true)
      toast.success(t("chat.message.copied"))
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error(t("chat.message.copyFailed"))
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("chat.message.copy")}
      title={t("chat.message.copy")}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60",
        "transition hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
      )}
    >
      <HugeiconsIcon
        icon={copied ? Tick01Icon : Copy01Icon}
        className={cn("size-3.5", copied && "text-brand-via")}
        strokeWidth={1.8}
      />
    </button>
  )
}

// Yarıda kesilmiş yanıtlarda kopyala butonunun yanında görünür. Tıklayınca
// onay popup'ı açar; onaylanınca aynı tur yeniden gönderilir (onRetry).
// Sessiz otomatik retry yerine onaya bağladık: agent'lar yan etkili işlem
// (mail/ticket) yapabildiği için aynı tur habersiz iki kez tetiklenmesin.
function RetryButton({ message, onRetry }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("chat.message.retry")}
        title={t("chat.message.retry")}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60",
          "transition hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        )}
      >
        <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" strokeWidth={1.8} />
      </button>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("chat.retry.title")}</DialogTitle>
          <DialogDescription>{t("chat.retry.desc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t("chat.retry.cancel")}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => {
              setOpen(false)
              onRetry?.(message)
            }}
          >
            {t("chat.retry.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChatMessageInner({ message, onCardAction, onSuggestedAction, onRetry }) {
  const { t, locale } = useLocale()
  const { getAgent } = useConfig()
  const me = useMe()
  const isUser = message.role === "user"
  const time = message.time instanceof Date ? message.time : new Date(message.time)

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-end gap-2"
      >
        <div className={cn("flex flex-col items-end gap-1.5", BUBBLE_MAX_WIDTH)}>
          {message.content && (
            <div className="rounded-2xl rounded-tr-md border border-brand-via/30 bg-brand-soft/40 px-4 py-2.5 text-sm leading-relaxed text-foreground">
              {message.content}
            </div>
          )}
          {message.attachments?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-brand-via/30 bg-card px-2 py-1 text-xs"
                >
                  <HugeiconsIcon icon={File01Icon} className="size-3.5 shrink-0 text-brand-deep" strokeWidth={1.6} />
                  <span className="max-w-[160px] truncate font-medium" title={att.name}>
                    {att.name}
                  </span>
                  {att.size != null && (
                    <span className="tabular-nums text-muted-foreground">{formatFileSize(att.size)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {formatTime(time, locale)}
          </span>
        </div>
        {/* User avatar — Microsoft Graph profile photo when available
            (cached per account in localStorage), pastel orb fallback. */}
        <UserAvatar photoUrl={me.photoUrl} label={me.fullName} className="size-7 shrink-0" />
      </motion.div>
    )
  }

  const agent = getAgent(message.agent)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-2"
    >
      <div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white">
        <IconOrLogo iconName={agent?.iconName} logo={agent?.logo} className="size-3.5" />
      </div>
      <div className={cn("flex flex-col items-start", BUBBLE_MAX_WIDTH)}>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-foreground/80">{agent?.name}</span>
        </div>
        <div className="flex flex-col gap-2">
          {message.content && (
            <div
              className={cn(
                "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5",
                "text-sm leading-relaxed text-foreground",
                "prose prose-sm max-w-none dark:prose-invert",
                "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
                "prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
                "prose-hr:my-3 prose-blockquote:my-2",
                "prose-a:text-brand-via prose-a:no-underline hover:prose-a:underline",
                // GFM tabloları: yatay kaydırma + ince kenarlık + başlık vurgusu.
                "prose-table:my-2 prose-table:block prose-table:w-full prose-table:overflow-x-auto",
                "prose-th:border prose-th:border-border prose-th:bg-muted/60 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold",
                "prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 prose-td:align-top",
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeBotMarkdown(message.content)}</ReactMarkdown>
            </div>
          )}
          {message.attachments?.map((att, i) =>
            att.contentType === "application/vnd.microsoft.card.adaptive" ? (
              <div key={i} className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
                <AdaptiveCardView card={att.content} onAction={onCardAction} />
              </div>
            ) : attachmentDownloadUrl(att) ? (
              <FileAttachment key={i} att={att} />
            ) : null,
          )}
          {!message.content && !message.attachments?.length && !message.suggestedActions?.length && !message.incomplete && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5">
              <TypingIndicator />
            </div>
          )}
          {message.suggestedActions?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.suggestedActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestedAction?.(action)}
                  className={cn(
                    "rounded-full border border-brand-via/40 bg-brand-soft/30 px-3.5 py-1.5",
                    "text-xs font-medium text-foreground transition hover:bg-brand-soft/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  )}
                >
                  {action.title || action.value}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Timestamp + copy action row. Copy button always visible on touch
            (no hover-reveal) — matches ChatGPT/Claude mobile pattern. */}
        <div className="mt-0.5 flex items-center gap-1 text-muted-foreground/70">
          <span className="text-[10px] tabular-nums">{formatTime(time, locale)}</span>
          {message.incomplete && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={Alert02Icon} className="size-3" strokeWidth={1.8} />
              {t("chat.message.incomplete")}
            </span>
          )}
          <CopyButton content={message.content} />
          {message.incomplete && message.retry && <RetryButton message={message} onRetry={onRetry} />}
        </div>
      </div>
    </motion.div>
  )
}

// React.memo with shallow prop compare — message objects are immutable
// (new objects on every append), so default referential equality is
// enough to skip re-renders for older bubbles when a new message arrives.
// Big win on long conversations: previously every assistant token-stream
// update re-rendered the entire list (N motion.divs); now only the last
// bubble re-renders.
export const ChatMessage = memo(ChatMessageInner, (prev, next) =>
  prev.message === next.message &&
  prev.onCardAction === next.onCardAction &&
  prev.onSuggestedAction === next.onSuggestedAction &&
  prev.onRetry === next.onRetry,
)
