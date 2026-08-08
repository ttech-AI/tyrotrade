// Thin, failure-proof wrapper around the Web Notifications API.
//
// Used to tell the user "your agent's answer is ready" when the tab is hidden
// or unfocused (another browser tab, another app, minimised window).
//
// Every call is defensive, because availability is genuinely uneven:
//   • iOS Safari exposes `Notification` ONLY inside an installed PWA — in a
//     normal tab the constructor is missing entirely. (This app is
//     installable, so add-to-home-screen users do get it.)
//   • Android Chrome DOES expose the constructor but THROWS ("Illegal
//     constructor") because it requires a ServiceWorkerRegistration.
//   • Corporate policy can pin the permission to `denied` with no prompt.
//
// So showNotification() returns a boolean instead of throwing, and callers
// always fall back to the permission-free cues (tab title, favicon dot,
// sidebar badge, toast) which work everywhere.

/** macOS (iOS dahil değil — orada bayrak zaten desteklenmiyor, zararsız). */
function isMacOS() {
  if (typeof navigator === "undefined") return false
  return /Mac/i.test(navigator.userAgent) && !/iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** @returns {boolean} true when the constructor exists (says nothing about permission) */
export function notificationsSupported() {
  return typeof window !== "undefined" && typeof window.Notification === "function"
}

/** @returns {"unsupported"|"default"|"granted"|"denied"} */
export function getPermission() {
  if (!notificationsSupported()) return "unsupported"
  const p = window.Notification.permission
  return p === "granted" || p === "denied" ? p : "default"
}

// MUST be called from a user gesture — Safari rejects it otherwise and Chrome
// treats gesture-less prompts as spam (which can get the origin blocked).
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported"
  try {
    const result = await window.Notification.requestPermission()
    return result === "granted" || result === "denied" ? result : "default"
  } catch {
    // Old Safari used the callback form and can reject the promise call.
    return getPermission()
  }
}

// The last page-level notification we opened, so it can be retracted when the
// user comes back on their own — otherwise it lingers in the OS tray. Service
// worker notifications are retracted via registration.getNotifications(tag).
let active = null
let activeTag = null

async function swRegistration() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null
  try {
    // `ready` would hang forever when no SW is registered (dev builds have
    // devOptions.enabled:false), so ask for the current registration instead.
    const reg = await navigator.serviceWorker.getRegistration()
    return reg && typeof reg.showNotification === "function" ? reg : null
  } catch {
    return null
  }
}

/**
 * Show an OS-level notification.
 *
 * Prefers the service worker: only SW notifications can carry action BUTTONS,
 * and on Android Chrome the page-level constructor throws outright. Falls back
 * to `new Notification()` when there is no SW (dev server, first load before
 * the worker activates) — same notification, minus the buttons.
 *
 * Note: `actions` are honoured by Chrome/Edge (desktop + Android). Safari and
 * Firefox ignore them and simply render the plain notification, so the buttons
 * must never be the ONLY way to act — clicking the body does the same thing.
 *
 * @param {object} opts
 * @param {Array<{action: string, title: string}>} [opts.actions] localized buttons
 * @returns {Promise<boolean>} false when nothing could be shown, so the caller falls back.
 */
export async function showNotification({ title, body, tag = "tyrotrade-chat", actions = [], onClick }) {
  if (getPermission() !== "granted") return false

  const options = {
    body,
    // Same tag ⇒ a newer notification REPLACES the older one (no stacking).
    tag,
    icon: `${import.meta.env.BASE_URL}favicon.svg`,
    badge: `${import.meta.env.BASE_URL}favicon.svg`,
  }

  // requireInteraction keeps the notification up until the user acts on it —
  // the whole point when they may be away for minutes. Windows honours it.
  //
  // macOS is deliberately EXCLUDED. An app there can only have ONE
  // notification style, so Chromium browsers route requireInteraction
  // notifications through a separate helper identity ("Google Chrome Helper
  // (Alerts)", "Microsoft Edge Helper (Alerts)") which appears as its OWN row
  // in System Settings → Notifications and is usually never approved. Observed
  // exactly this: on the same Mac, Chrome bannered (its helper was allowed)
  // while Edge only reached Notification Center with no banner.
  //
  // And we lose nothing by dropping it: macOS 10.15+ forces requireInteraction
  // to false anyway. Setting it bought no persistence — it only moved us onto
  // the fragile path.
  if (!isMacOS()) options.requireInteraction = true

  const reg = await swRegistration()
  if (reg) {
    try {
      await closeActiveNotification()
      // Windows shows at most two buttons; more are silently dropped.
      await reg.showNotification(title, { ...options, actions: actions.slice(0, 2) })
      activeTag = tag
      return true
    } catch {
      // fall through to the page-level constructor
    }
  }

  try {
    await closeActiveNotification()
    const n = new window.Notification(title, options)
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        // focus can be blocked; the click handler must still run
      }
      n.close()
      active = null
      onClick?.()
    }
    active = n
    activeTag = null
    return true
  } catch {
    // Android Chrome throws here when there's no service worker.
    return false
  }
}

export async function closeActiveNotification() {
  try {
    active?.close()
  } catch {
    // already gone
  }
  active = null

  if (!activeTag) return
  const tag = activeTag
  activeTag = null
  try {
    const reg = await swRegistration()
    const shown = (await reg?.getNotifications({ tag })) ?? []
    for (const n of shown) n.close()
  } catch {
    // nothing we can do — the OS will expire it
  }
}

/**
 * Route clicks on service-worker notifications back into the app.
 *
 * A SW notification has NO default click behaviour: notify-sw.js focuses this
 * tab and posts the chosen action here. Called once at boot (main.jsx) so a
 * click works no matter which screen is mounted.
 *
 * @param {(action: string) => void} handler receives "open" or "reply"
 * @returns {() => void} unsubscribe
 */
export function onNotificationAction(handler) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return () => {}
  const listener = (event) => {
    if (event.data?.type !== "tyrotrade:notification-action") return
    // Logged so a dead-looking button can be told apart from a message that
    // never arrived — the two failures look identical from the outside.
    console.log("[tyrotrade-notify] action received", event.data.action)
    handler(event.data.action)
  }
  navigator.serviceWorker.addEventListener("message", listener)
  // REQUIRED, and the reason clicking a notification button appeared to do
  // nothing: a client's message queue only starts flowing when `onmessage` is
  // assigned or startMessages() is called. With addEventListener alone the
  // service worker's postMessage is queued and never delivered — the tab was
  // focused by the worker, then simply sat there.
  try {
    navigator.serviceWorker.startMessages?.()
  } catch {
    // not implemented — onmessage-style delivery will already be running
  }

  // Self-heal a stale worker. The BUTTONS come from the page (it calls
  // registration.showNotification), but the CLICK is handled by whatever
  // worker is installed — so a user still running the previous worker sees
  // the buttons and gets nothing when pressing them. Asking for an update at
  // boot pulls the new sw.js; skipWaiting + clientsClaim then activate it
  // without waiting for every tab to close.
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => reg?.update())
    .catch(() => {
      // offline or no registration — nothing to heal
    })

  return () => navigator.serviceWorker.removeEventListener("message", listener)
}
