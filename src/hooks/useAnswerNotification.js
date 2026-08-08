import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { bumpUnread, clearUnread, getUnreadCount, requestOpenChat } from "@/lib/chatBus"
import { closeActiveNotification, getPermission, showNotification } from "@/lib/notify/browserNotify"
import { clearTitleBadge, setTitleBadge } from "@/lib/notify/titleBadge"
import { useLocale } from "@/hooks/useLocale"

// Decides HOW to tell the user that an agent answer landed, based on where
// they were when it landed.
//
// Agents can take a minute or more, so people send a question and go do
// something else. Three cases, one decision point (resolveTurn):
//
//   | user is…                             | channel                        |
//   |--------------------------------------|--------------------------------|
//   | on the tab, chat on screen           | nothing — they're reading it   |
//   | on the tab, chat not on screen       | toast + sidebar unread badge   |
//   | on another tab / app / minimised     | OS notification + tab title +  |
//   |                                      | favicon dot + unread badge     |
//
// "On the tab" is visibilityState === "visible" AND document.hasFocus().
// Visibility alone isn't enough: with two windows side by side the tab is
// visible while the user is typing somewhere else, and staying silent there
// is exactly the bug we're fixing.
//
// Every channel converges on requestOpenChat(), so clicking a Windows
// notification and clicking an in-app toast land in the same place.

const BODY_CHARS = 140
const TOAST_MS = 12_000

function snippet(text, max = BODY_CHARS) {
  // Markdown is noise in an OS notification — flatten the common syntax so
  // the preview reads like a sentence, not "## **Toplam** | 1.234 |".
  const flat = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1).trimEnd()}…`
}

/**
 * @param {boolean} chatVisible - chat screen is on screen for the user
 * @param {boolean} enabled - user preference for OS notifications
 */
export function useAnswerNotification(chatVisible, enabled = true) {
  const { t } = useLocale()

  // One turn at a time: ChatScreen serialises turns behind `busy` +
  // abortGenRef, so a single pending slot is enough.
  const pendingRef = useRef(null)
  const chatVisibleRef = useRef(chatVisible)
  const enabledRef = useRef(enabled)
  // Set when we notified an away user — replayed as a toast the moment they
  // come back, so the answer isn't only a badge they might not notice.
  const queuedToastRef = useRef(null)
  // Held while an answer is outstanding: Chrome may freeze a tab hidden for
  // ~5 min, and holding a Web Lock opts this tab out — which keeps the SSE
  // stream (and therefore the answer) alive while the user is away.
  const releaseLockRef = useRef(null)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const showToast = useCallback(
    (title, body, failed) => {
      const opts = {
        description: body,
        duration: TOAST_MS,
        action: {
          label: t("chat.notify.view", "Görüntüle"),
          onClick: () => requestOpenChat(),
        },
      }
      if (failed) toast.error(title, opts)
      else toast.success(title, opts)
    },
    [t],
  )

  // Chat came on screen → the user is looking at the answer. Drop every cue.
  useEffect(() => {
    chatVisibleRef.current = chatVisible
    if (!chatVisible) return
    clearUnread()
    clearTitleBadge()
    closeActiveNotification()
    queuedToastRef.current = null
  }, [chatVisible])

  // User came back to the tab: retract the OS notification and title badge
  // (they've clearly seen it), then replay the answer as a toast if the chat
  // still isn't on screen. The unread badge stays until they open the chat —
  // that's the one cue meant to outlive the return.
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return
      clearTitleBadge()
      closeActiveNotification()
      const queued = queuedToastRef.current
      queuedToastRef.current = null
      if (queued && !chatVisibleRef.current) {
        showToast(queued.title, queued.body, queued.failed)
      }
    }
    window.addEventListener("focus", onReturn)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      window.removeEventListener("focus", onReturn)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [showToast])

  const releaseLock = useCallback(() => {
    releaseLockRef.current?.()
    releaseLockRef.current = null
  }, [])

  const acquireLock = useCallback(() => {
    if (releaseLockRef.current) return
    if (typeof navigator === "undefined" || !navigator.locks?.request) return
    let release = () => {}
    const held = new Promise((resolve) => {
      release = resolve
    })
    releaseLockRef.current = release
    navigator.locks.request("tyrotrade-chat-pending-answer", () => held).catch(() => {
      // lock unavailable — freeze protection is best-effort only
    })
  }, [])

  // Never leave a lock held past unmount.
  useEffect(() => () => releaseLock(), [releaseLock])

  const armTurn = useCallback(
    (question) => {
      pendingRef.current = { question: String(question || "") }
      acquireLock()
    },
    [acquireLock],
  )

  const cancelTurn = useCallback(() => {
    pendingRef.current = null
    releaseLock()
  }, [releaseLock])

  const resolveTurn = useCallback(
    ({ answer, failed } = {}) => {
      const meta = pendingRef.current
      pendingRef.current = null
      releaseLock()
      // Not armed → this turn wasn't user-initiated (greeting, auto-submit,
      // consent loop), so there is nothing to announce.
      if (!meta) return

      const onTab = document.visibilityState === "visible" && document.hasFocus()
      if (onTab && chatVisibleRef.current) return // they're watching it stream in

      const title = failed
        ? t("chat.notify.failTitle", "Yanıt alınamadı")
        : t("chat.notify.readyTitle", "Yanıtınız hazır")
      const body = failed
        ? t("chat.notify.failBody", "Soru yanıtlanamadı. Sohbeti açıp tekrar deneyin.")
        : snippet(answer) || meta.question

      bumpUnread()

      if (onTab) {
        // Same tab, chat not on screen (e.g. they moved to the dashboard).
        showToast(title, body, failed)
        return
      }

      // Away: OS notification when allowed, plus the permission-free cues so
      // the signal survives a denied prompt or an unsupported browser.
      if (enabledRef.current && getPermission() === "granted") {
        void showNotification({
          title,
          body,
          tag: "tyrotrade-chat-answer",
          // Labels come from the app's locale — unlike the browser's own
          // close/settings affordances, which are Chrome's UI language and
          // cannot be changed. "Yanıtla" opens the chat with the caret in the
          // composer; "Kapat" just dismisses.
          actions: [
            { action: "reply", title: t("chat.notify.action.reply", "Yanıtla") },
            { action: "dismiss", title: t("chat.notify.action.dismiss", "Kapat") },
          ],
          onClick: () => requestOpenChat(),
        })
      }
      setTitleBadge(getUnreadCount(), t("chat.notify.titleBadge", "Yanıt hazır"))
      queuedToastRef.current = { title, body, failed }
    },
    [releaseLock, showToast, t],
  )

  return { armTurn, resolveTurn, cancelTurn }
}
