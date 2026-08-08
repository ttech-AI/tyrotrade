import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Mic01Icon,
  MicOff01Icon,
  ArrowUp01Icon,
  File01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { onFocusComposer } from "@/lib/chatBus"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AgentSelect } from "./AgentSelect"
import { useLocale } from "@/hooks/useLocale"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { MAX_ATTACHMENT_BYTES, MAX_IMAGE_BYTES, isCompressibleImage } from "@/lib/copilot"
import { bcp47 } from "@/lib/intl-cache"

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  agent,
  onAgentChange,
  onMicToggle,
  disabled,
  className,
}) {
  const { t, locale } = useLocale()
  // Composer her yerde tek satır başlar; büyüme mobilde 2, masaüstünde 6
  // satırla sınırlı (geniş ekranda daha uzun mesaj görünür kalsın).
  const isMobile = useIsMobile()
  const taRef = useRef(null)
  const fileInputRef = useRef(null)
  const [attachments, setAttachments] = useState([])

  // Bildirimdeki "Yanıtla" düğmesi buraya iner: kullanıcı okumak için değil
  // yazmak için döndü, imleç hazır beklesin. Textarea ref'i bu bileşenin
  // içinde yaşadığı için dışarıdan prop yerine olayla isteniyor.
  useEffect(() => {
    return onFocusComposer(() => {
      const ta = taRef.current
      if (!ta) return
      ta.focus()
      const end = ta.value.length
      try {
        ta.setSelectionRange(end, end)
      } catch {
        // number/date gibi seçim desteklemeyen tiplerde atlanır
      }
    })
  }, [])

  // Mirror controlled value into a ref so dictate's onResult can read the
  // latest text without forcing the recognizer to re-create on each keystroke.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const unsupportedToastShownRef = useRef(false)

  // Web Speech API wrapper. The hook never mutates `value` — it only fires
  // callbacks; we own the textarea state and append finalized chunks here.
  const speech = useSpeechRecognition({
    lang: bcp47(locale),
    continuous: true,
    interimResults: true,
    onResult: ({ final, isFinal }) => {
      if (!isFinal || !final) return
      const prev = valueRef.current ?? ""
      const sep = prev.length === 0 || /\s$/.test(prev) ? "" : " "
      const next = prev + sep + final
      onChange?.(next)
      // Restore caret to end so further typing appends naturally. Skip on
      // touch — re-focusing fights the iOS soft-keyboard composition.
      if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) {
        requestAnimationFrame(() => {
          const ta = taRef.current
          if (!ta) return
          ta.focus()
          ta.setSelectionRange(next.length, next.length)
        })
      }
    },
    onError: (code) => {
      // user-initiated stop → silent
      if (code === "aborted") return
      const keyMap = {
        "not-allowed": "chat.mic.error.permission",
        "no-speech": "chat.mic.error.noSpeech",
        "audio-capture": "chat.mic.error.noMic",
        network: "chat.mic.error.network",
        "language-not-supported": "chat.mic.error.lang",
        "not-supported": "chat.mic.error.unsupported",
      }
      const key = keyMap[code] || "chat.mic.error.unknown"
      // no-speech is informational — natural pauses; everything else is error-level.
      if (code === "no-speech") toast(t(key))
      else toast.error(t(key))
    },
  })

  function handleMicClick() {
    if (!speech.isSupported) {
      if (!unsupportedToastShownRef.current) {
        toast.error(t("chat.mic.error.unsupported"))
        unsupportedToastShownRef.current = true
      }
      return
    }
    // Tell the parent what the NEXT listening state is, synchronously, so
    // it can flip the orb (or any other UI) without subscribing to the
    // recognizer's onstart/onend events. Engine async start is fine — the
    // parent gets a clean boolean to mirror.
    const nextListening = !speech.isListening
    if (nextListening) speech.start()
    else speech.stop()
    onMicToggle?.(nextListening)
  }

  // Abort recognition if the composer becomes disabled (orb thinking)
  // so a late final doesn't land in a textarea the user can't see.
  useEffect(() => {
    if (disabled && speech.isListening) speech.abort()
  }, [disabled, speech])

  // auto-resize
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    const max = (isMobile ? 2 : 6) * 24 // ~6 lines of 24px line-height (2 on mobile)
    el.style.height = Math.min(el.scrollHeight, max) + "px"
  }, [value, isMobile])

  // Focus on mount, but ONLY on hover-capable pointer devices. On mobile,
  // programmatic focus pops the soft keyboard (Android) or jumps the
  // viewport (iOS) the moment the user lands on the page — both ruin the
  // welcome experience. The user can always tap to focus.
  useEffect(() => {
    if (typeof window === "undefined") return
    const isTouch = "ontouchstart" in window || !window.matchMedia("(pointer: fine)").matches
    if (!isTouch) taRef.current?.focus()
  }, [])


  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && (value.trim() || attachments.length > 0)) {
        handleSendClick()
      }
    }
  }

  function handleSendClick() {
    // Drop any in-flight dictate interim — a delayed final after the
    // textarea has been cleared by the parent would otherwise land in
    // the fresh empty composer.
    if (speech.isListening) speech.abort()
    // Seçilen dosyaları parent'a teslim et — gönderim/base64 dönüşümü orada
    // (ChatScreen) yapılır. Tray'i hemen temizliyoruz.
    onSend?.(attachments)
    setAttachments([])
  }

  // ---------- Attachments ----------
  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleFiles(e) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    // Dosyalar activity'ye inline base64 olarak gömülür. Görseller gönderimden
    // önce otomatik küçültülür (bkz. compressImageFile) — o yüzden ham tavanları
    // yüksek (MAX_IMAGE_BYTES). Görsel-olmayan dosyalar sıkıştırılamaz, daha düşük
    // tavana (MAX_ATTACHMENT_BYTES) takılır. Aşan dosyayı ele ve bildir.
    const accepted = picked.filter((file) => {
      const cap = isCompressibleImage(file) ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_BYTES
      if (file.size > cap) {
        toast.error(
          t("chat.attach.tooLarge")
            .replace("{name}", file.name)
            .replace("{size}", formatFileSize(cap)),
        )
        return false
      }
      return true
    })
    if (accepted.length > 0) {
      setAttachments((prev) => [
        ...prev,
        ...accepted.map((file) => ({
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      ])
    }
    e.target.value = ""
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const hasContent = value.trim().length > 0 || attachments.length > 0

  return (
    // OUTER beam host. Must NOT have overflow:hidden — the beam's
    // ::before sits at inset:-2px (OUTSIDE the inner border), so any
    // overflow clip here would slice it off. The outer wrapper is also
    // where the brand-halo box-shadow lives.
    <div className={cn("composer-beam relative w-full rounded-2xl", className)}>
      {/* INNER chrome — keeps overflow:hidden so the rich-text toolbar
          and attachments tray AnimatePresence height tweens don't jut
          out of the rounded corners. */}
      <div
        className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
{/* Attachments preview */}
      <AnimatePresence initial={false}>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-border/60 bg-muted/20"
          >
            <div className="flex flex-wrap gap-2 px-4 py-2.5 sm:px-6">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs"
                >
                  <HugeiconsIcon
                    icon={File01Icon}
                    className="size-3.5 shrink-0 text-brand-deep"
                    strokeWidth={1.6}
                  />
                  <span className="max-w-[160px] truncate font-medium" title={att.name}>
                    {att.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatFileSize(att.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={t("chat.attach.remove")}
                    className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea + live interim overlay. The overlay is aria-hidden,
          pointer-events-none, absolutely positioned over the textarea
          region with matching typography + padding. It uses an invisible
          spacer the width/height of the committed `value` to push the
          interim text to exactly where the caret sits, so words "solidify"
          in place on isFinal. Writing interim into the textarea directly
          would reset selection on every event and break Android IME. */}
      <div className="relative px-4 pt-3 sm:px-6 sm:pt-4">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            // While listening: show a dedicated hint UNTIL the interim
            // overlay starts rendering words, then clear it so the
            // overlay's transcript has the field to itself (the muted
            // placeholder + muted interim were clashing).
            speech.isListening
              ? speech.interim
                ? ""
                : t("chat.mic.listeningPlaceholder")
              : t("chat.placeholder")
          }
          rows={1}
          inputMode="text"
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          aria-multiline="true"
          aria-label={t("chat.placeholder")}
          className="relative z-[1] min-h-[24px] resize-none border-0 bg-transparent dark:bg-transparent px-0 py-0 text-[16px] sm:text-base leading-6 shadow-none focus-visible:ring-0 focus-visible:border-0"
        />
        {speech.isListening && speech.interim && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-3 select-none whitespace-pre-wrap break-words text-[16px] leading-6 text-foreground/55 sm:inset-x-6 sm:top-4 sm:text-base"
          >
            <span className="invisible">
              {value ? value + (/\s$/.test(value) ? "" : " ") : ""}
            </span>
            <span>{speech.interim}</span>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openFilePicker}
                className="size-9 text-muted-foreground hover:text-foreground"
                aria-label={t("chat.attach")}
              >
                <HugeiconsIcon icon={Attachment01Icon} className="size-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {t("chat.attach")}
            </TooltipContent>
          </Tooltip>
          <AgentSelect value={agent} onChange={onAgentChange} />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleMicClick}
                disabled={disabled}
                aria-label={
                  !speech.isSupported
                    ? t("chat.mic.unsupported")
                    : speech.isListening
                      ? t("chat.mic.stop")
                      : t("chat.mic.start")
                }
                aria-pressed={speech.isListening}
                data-mic-state={
                  !speech.isSupported
                    ? "unsupported"
                    : speech.isListening
                      ? "listening"
                      : "idle"
                }
                className={cn(
                  "relative size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground sm:size-9",
                  speech.isListening && "bg-brand-via/15 text-brand-deep hover:text-brand-deep",
                  !speech.isSupported &&
                    "opacity-50 cursor-not-allowed hover:text-muted-foreground",
                )}
              >
                {speech.isListening ? (
                  <span aria-hidden="true" className="mic-bars relative z-[1]">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <HugeiconsIcon
                    icon={speech.isSupported ? Mic01Icon : MicOff01Icon}
                    className="relative z-[1] size-[18px]"
                  />
                )}
                {speech.isListening && (
                  <span aria-hidden="true" className="mic-listening-pulse" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {!speech.isSupported
                ? t("chat.mic.unsupported")
                : speech.isListening
                  ? t("chat.tooltip.micStop")
                  : t("chat.tooltip.mic")}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleSendClick}
                disabled={disabled || !hasContent}
                aria-label={t("chat.send")}
                className={cn(
                  "size-10 rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to p-0 text-white shadow-sm sm:size-10",
                  "duration-200 ease-linear hover:brightness-110 hover:text-white",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {t("chat.send")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      </div>
    </div>
  )
}
