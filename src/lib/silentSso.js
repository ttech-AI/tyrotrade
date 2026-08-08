// Silent SSO ("prompt=none") — if the browser already holds an Entra session
// (the user signed into another Microsoft app), sign them in at boot without
// ever showing the login screen. If there is no session, fall back to the
// normal login page.
//
// Mechanism: a full-page loginRedirect({ prompt: "none" }) BEFORE React
// mounts (see main.jsx). Deliberately NOT ssoSilent(): in MSAL v5 the hidden
// iframe can only deliver its response through the redirect-bridge page
// (@azure/msal-browser/redirect-bridge) hosted at the redirect URI — this SPA
// doesn't host one, so every boot would burn the full iframe timeout for
// nothing. The redirect round-trip costs one visible navigation but always
// terminates.
//
// Loop / lockout protections (each learned the hard way):
//   • one attempt per tab — sessionStorage flag written BEFORE navigating;
//     if the flag can't be written, the attempt is skipped entirely (a
//     redirect loop is worse than a login screen).
//   • deliberate sign-out marker — localStorage, set by the sign-out action
//     BEFORE logoutRedirect and checked here. Without it the Entra session
//     (still alive after our app-level logout) would sign the user straight
//     back in — logout would be impossible. It survives until the user
//     MANUALLY logs in again (LoginPage clears it). Never clear it just
//     because an account shows up in the MSAL cache: another tab refreshing
//     mid-logout would cancel the sign-out.
//   • a redirect error from handleRedirectPromise blocks the attempt — the
//     user backing out of an interactive Entra prompt returns access_denied
//     (NOT login_required); silently retrying would bounce them right back
//     to the prompt they just escaped.
//   • kill switches: VITE_DISABLE_SILENT_SSO=1 at build time, ?nosso=1 per
//     visit — both usable without a code rollback.
//
// A failed silent attempt is the EXPECTED outcome for a signed-out browser:
// it comes back as login_required / interaction_required. Log at info level,
// show nothing.

const ATTEMPTED_KEY = "tyrotrade-sso-attempted" // sessionStorage — one try per tab
const SIGNED_OUT_KEY = "tyrotrade-signed-out" // localStorage — survives the tab

const KILLED_BY_ENV =
  import.meta.env.VITE_DISABLE_SILENT_SSO === "1" ||
  import.meta.env.VITE_DISABLE_SILENT_SSO === "true"

function killedByUrl() {
  try {
    return new URLSearchParams(window.location.search).get("nosso") === "1"
  } catch {
    return false
  }
}

export function isSignedOut() {
  try {
    return window.localStorage.getItem(SIGNED_OUT_KEY) === "1"
  } catch {
    return false
  }
}

// Call BEFORE logoutRedirect — the marker must already be persisted when the
// post-logout page load runs the silent-SSO decision.
export function markSignedOut() {
  try {
    window.localStorage.setItem(SIGNED_OUT_KEY, "1")
    if (window.localStorage.getItem(SIGNED_OUT_KEY) === "1") return
  } catch {
    // fall through to the retry below
  }
  // The write didn't stick. That is NOT proof the MSAL cache is gone: at
  // quota, existing entries survive and only new writes fail — a lost marker
  // here lets a brand-new tab silently sign the user back in after they
  // deliberately logged out. Free the biggest expendable key (the launcher
  // config CACHE, same literal as ConfigProvider's STORAGE_KEY) and retry.
  try {
    window.localStorage.removeItem("tyrotrade-config-v1")
    window.localStorage.setItem(SIGNED_OUT_KEY, "1")
  } catch {
    console.warn("[sso] sign-out marker could not be persisted — a new tab may silently sign back in")
  }
}

// ONLY the manual login action (LoginPage connect button) may call this —
// that click is the user's explicit "sign me back in".
export function clearSignedOut() {
  try {
    window.localStorage.removeItem(SIGNED_OUT_KEY)
  } catch {
    // ignore — worst case silent SSO stays off until storage works again
  }
}

function hasAttemptedThisTab() {
  try {
    return window.sessionStorage.getItem(ATTEMPTED_KEY) === "1"
  } catch {
    // Can't read the guard → assume attempted, so an unreadable storage can
    // never produce a redirect loop.
    return true
  }
}

/**
 * Decide whether this boot should try a silent sign-in.
 * `redirectError` is whatever handleRedirectPromise rejected with (or null).
 */
export function shouldAttemptSilentSso({ msalInstance, redirectError }) {
  if (KILLED_BY_ENV || killedByUrl()) return false
  if (redirectError) return false
  if (hasAttemptedThisTab()) return false
  if (isSignedOut()) return false
  // Offline: navigating to an unreachable Entra strands the user on a network
  // error page — in the installed PWA there is no address bar to escape from,
  // and each cold launch gets fresh sessionStorage so the attempt guard never
  // accumulates. A login screen beats a navigation to nowhere.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false
  // Never inside an embed (Teams tab, web part, preview): the return leg of
  // the hop arrives as iframe + auth params in the URL, which is exactly what
  // the renewal-frame short-circuit (index.html / isMsalRenewalFrame) window.
  // stop()s — the frame would wedge blank forever.
  if (typeof window !== "undefined" && window.parent && window.parent !== window) return false
  if (msalInstance.getAllAccounts().length > 0) return false // already signed in
  return true
}

/**
 * Start the silent attempt. Resolves false if the attempt could not start
 * (caller should render the app as usual); anything else means the page is
 * navigating away and nothing should be rendered.
 */
export async function attemptSilentSso(msalInstance, baseRequest) {
  try {
    window.sessionStorage.setItem(ATTEMPTED_KEY, "1")
  } catch {
    return false // no loop guard → no attempt
  }
  try {
    await msalInstance.loginRedirect({ ...baseRequest, prompt: "none" })
    return true // navigation is under way; the promise settling first is fine
  } catch (err) {
    // e.g. interaction_in_progress, popup/navigation blocked — not fatal,
    // just fall through to the login screen.
    if (import.meta.env.DEV) {
      console.info("[sso] silent attempt did not start:", err?.errorCode || err?.message || err)
    }
    return false
  }
}

// Error codes Entra returns when prompt=none finds no usable session — the
// expected "nobody's home" answers, not failures worth a console.warn.
const EXPECTED_SILENT_ERRORS = new Set([
  "login_required",
  "interaction_required",
  "consent_required",
  "account_selection_required",
  "no_account_error",
  "monitor_window_timeout",
])

export function isExpectedSilentError(err) {
  return EXPECTED_SILENT_ERRORS.has(err?.errorCode)
}
