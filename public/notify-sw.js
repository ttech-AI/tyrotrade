// Service-worker scope: everything below runs off `self`, which is already a
// browser global for ESLint. (No /* eslint-env */ header — flat config
// dropped support for those comments.)
//
// Imported into the generated Workbox service worker (see `workbox.importScripts`
// in vite.config.js) purely to handle clicks on answer notifications.
//
// Why the notification has to come from the service worker at all: action
// BUTTONS ("Yanıtla" / "Kapat") only exist on notifications shown via
// ServiceWorkerRegistration.showNotification(). The page-level
// `new Notification()` constructor cannot carry them — and on Android Chrome
// it throws outright. The trade-off is that a service-worker notification has
// NO default click behaviour, so every click has to be handled here.
//
// What is still NOT ours, no matter what: the notification's visual design.
// Windows renders it with its own Action Center chrome and appends Chrome's
// own close / settings affordances in the browser's UI language. Only the
// title, body, icon and these action buttons come from us.

const LOG = "[tyrotrade-notify-sw]"

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "open"
  console.log(LOG, "click", { action })
  event.notification.close()
  // "Kapat" — dismissing is the whole intent, don't surface the app.
  if (action === "dismiss") return

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const sameOrigin = all.filter((c) => c.url.startsWith(self.location.origin))
      console.log(
        LOG,
        "clients",
        sameOrigin.map((c) => ({ url: c.url, focused: c.focused, visibility: c.visibilityState })),
      )
      // Prefer a tab already sitting on the chat — focusing that one means the
      // user lands on the answer with no route change at all.
      const existing = sameOrigin.find((c) => c.url.includes("/chat")) ?? sameOrigin[0]

      if (existing) {
        // Tell the page first. It routes itself to the chat, which preserves
        // the running conversation instead of reloading it — and it must not
        // depend on focus() succeeding.
        existing.postMessage({ type: "tyrotrade:notification-action", action })

        // Then try to surface that tab. focus() RESOLVES WITH the client, so
        // `focused` tells us whether it actually took: Windows can refuse to
        // raise a background window on a service worker's request (focus-steal
        // prevention), which is silent — no throw, nothing happens, and from
        // the user's side the button looks dead.
        let focused = false
        try {
          const client = await existing.focus()
          focused = Boolean(client?.focused ?? true)
        } catch (err) {
          console.log(LOG, "focus() rejected", err?.message || err)
        }
        console.log(LOG, "focus result", { focused })
        if (focused) return
        // Last resort: opening a window is honoured where focus() isn't, so
        // the user always ends up looking at the chat. The conversation itself
        // lives in the original tab's sessionStorage, so this is deliberately
        // the fallback and never the first move.
        console.log(LOG, "focus refused — opening a window instead")
      }

      await self.clients.openWindow(`${self.location.origin}/chat`)
    })(),
  )
})
