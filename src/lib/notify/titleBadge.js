// Permission-free "something is waiting for you" cues: the browser tab title
// and the favicon.
//
// These are the fallback whenever an OS notification isn't possible
// (permission not granted, iOS Safari outside the installed PWA, Android
// Chrome without a service worker) — and useful reinforcement even when it
// is, because a tab title survives a dismissed notification.
//
// The original title and favicon href are captured on the first badge and
// restored on clear, so nothing leaks if the app changes the title itself.

let originalTitle = null
let originalIconHref = null

function iconLink() {
  if (typeof document === "undefined") return null
  return document.querySelector('link[rel~="icon"]')
}

/** Prefix the tab title with a count + swap in the dotted favicon. Idempotent. */
export function setTitleBadge(count, label) {
  if (typeof document === "undefined") return
  if (originalTitle === null) originalTitle = document.title
  document.title = `(${count}) ${label} · ${originalTitle}`

  const link = iconLink()
  if (link) {
    if (originalIconHref === null) originalIconHref = link.getAttribute("href")
    link.setAttribute("href", `${import.meta.env.BASE_URL}favicon-badge.svg`)
  }
}

/** Restore the original title + favicon. Safe to call when never badged. */
export function clearTitleBadge() {
  if (typeof document === "undefined") return
  if (originalTitle !== null) {
    document.title = originalTitle
    originalTitle = null
  }
  const link = iconLink()
  if (link && originalIconHref !== null) {
    link.setAttribute("href", originalIconHref)
    originalIconHref = null
  }
}
