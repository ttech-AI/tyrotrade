// Small window-event + subscribable-store bus for chat-wide signals.
//
// Two things travel here:
//
//   1. requestOpenChat() — "take me back to the conversation". Fired by a
//      browser-notification click or its in-app toast action. App.jsx listens
//      and navigates to /chat; ChatScreen listens and jumps to the latest
//      message.
//
//   2. Unread count — answers that landed while the user was elsewhere. A
//      module store rather than an event so the sidebar badge can read it
//      with useSyncExternalStore, without threading props through
//      DashboardLayout → Sidebar → NavMain.

const OPEN_EVENT = "tyrotrade:chat:open"
const FOCUS_COMPOSER_EVENT = "tyrotrade:chat:focus-composer"

/**
 * @param {{focusComposer?: boolean}} [detail] focusComposer is set by the
 *   notification's "Yanıtla" button — the user's intent is to type, not just
 *   to read, so the caret should already be waiting for them.
 */
export function requestOpenChat(detail = {}) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }))
}

/** Subscribe to open-chat requests. Returns an unsubscribe function. */
export function onOpenChat(cb) {
  if (typeof window === "undefined") return () => {}
  const listener = (e) => cb(e.detail ?? {})
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}

/** Ask the composer to take the caret (ChatComposer owns its own textarea ref). */
export function requestFocusComposer() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(FOCUS_COMPOSER_EVENT))
}

export function onFocusComposer(cb) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(FOCUS_COMPOSER_EVENT, cb)
  return () => window.removeEventListener(FOCUS_COMPOSER_EVENT, cb)
}

/* ── Unread store ─────────────────────────────────────────────────────── */

let unread = 0
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

/** useSyncExternalStore getSnapshot */
export function getUnreadCount() {
  return unread
}

/** useSyncExternalStore subscribe */
export function subscribeUnread(cb) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function bumpUnread() {
  unread += 1
  emit()
}

export function clearUnread() {
  if (unread === 0) return
  unread = 0
  emit()
}
