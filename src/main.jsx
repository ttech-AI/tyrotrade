import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { MsalProvider } from "@azure/msal-react"
import "@fontsource/kanit/700.css"
import "./index.css"
import App from "./App.jsx"
import { msalInstance, ensureMsalInitialized, isMsalConfigured, loginRequest } from "@/lib/msal"
import { shouldAttemptSilentSso, attemptSilentSso, isExpectedSilentError } from "@/lib/silentSso"
import { onNotificationAction } from "@/lib/notify/browserNotify"
import { requestOpenChat } from "@/lib/chatBus"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { LocaleProvider } from "@/providers/LocaleProvider"
import { PaletteProvider } from "@/providers/PaletteProvider"
import { ConfigProvider } from "@/providers/ConfigProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

// BASE_URL is "/" everywhere now that the SPA is served from the custom
// domain tyrotrade.ttech.business root (the CNAME file in public/ binds Pages to
// the custom domain). Kept as-is via env in case base ever changes again.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

// MSAL runs silent token renewal in a hidden iframe pointed at the redirect URI
// (this SPA root). Bootstrapping React there is wasteful and the in-app router can
// navigate the iframe off the auth-response hash the parent MSAL polls for, breaking
// renewal. index.html sets the flag + best-effort window.stop()s the bundle; this is
// the JS-level backstop so we never run redirect handling or render in that iframe.
function isMsalRenewalFrame() {
  if (typeof window === "undefined") return false
  if (window.__MSAL_RENEWAL_FRAME__) return true
  const inIframe = window.parent && window.parent !== window
  const hasAuth = /[?#].*(code=|error=|state=)/.test(window.location.href)
  return Boolean(inIframe && hasAuth)
}

// MSAL redirect flow: initialize, then process any auth response the redirect
// landed us with (clears the URL hash + sets the active account) BEFORE React
// mounts. App's auth gate then sees the authenticated state on first render.
if (!isMsalRenewalFrame()) {
  // Answer-notification buttons. A service-worker notification has no default
  // click behaviour: notify-sw.js focuses this tab and posts the chosen action
  // here, and this turns it into the same in-app "open the chat" signal the
  // toast uses. Registered at boot, outside React, so it works whatever screen
  // happens to be mounted when the click arrives.
  onNotificationAction((action) => requestOpenChat({ focusComposer: action === "reply" }))

  // bfcache: the document that starts the silent-SSO hop never rendered
  // (#root empty) yet stays in session history. The Back button can restore
  // it as-is — module scripts do NOT re-run on a bfcache restore — leaving a
  // permanent white page. Reload to re-boot; the per-tab attempt flag in
  // sessionStorage guarantees the reload cannot re-trigger the hop.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !document.getElementById("root")?.hasChildNodes()) {
      window.location.reload()
    }
  })

  let rendered = false
  function renderApp() {
    if (rendered) return // a throw after render must not createRoot twice
    rendered = true
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <BrowserRouter basename={basename}>
          <MsalProvider instance={msalInstance}>
            <ThemeProvider>
              <PaletteProvider>
                <LocaleProvider>
                  <ConfigProvider>
                    <TooltipProvider delayDuration={150}>
                      <App />
                    </TooltipProvider>
                  </ConfigProvider>
                </LocaleProvider>
              </PaletteProvider>
            </ThemeProvider>
          </MsalProvider>
        </BrowserRouter>
      </StrictMode>,
    )
  }

  // Promise.resolve().then(...) converts a SYNCHRONOUS throw from
  // ensureMsalInitialized (config regression, MSAL validating eagerly) into a
  // rejection the .catch below already handles — a bare call would escape the
  // chain and leave a blank page with renderApp never reached.
  Promise.resolve()
    .then(() => ensureMsalInitialized())
    .then(() => msalInstance.handleRedirectPromise())
    .then((result) => {
      if (result?.account) {
        msalInstance.setActiveAccount(result.account)
        // Redirect URI is root; route the freshly-authed user straight to
        // /dashboard so the auth gate doesn't flash /login while React's
        // useIsAuthenticated catches up after the redirect callback.
        window.history.replaceState(null, "", import.meta.env.BASE_URL + "dashboard")
      }
      return null
    })
    .catch((err) => {
      // A rejected redirect is the NORMAL return path of a failed silent SSO
      // attempt (login_required & friends) — log quietly and fall through to
      // the login screen. Anything else (user backed out of an Entra prompt →
      // access_denied, config errors, …) is worth a warn. Either way the error
      // is passed down so the SSO decision can see it — never chain a silent
      // attempt onto a boot that already returned an auth error.
      const log = isExpectedSilentError(err) ? "info" : "warn"
      console[log]("[MSAL] redirect returned an error:", err?.errorCode || err?.message || err)
      // Always truthy — a falsy rejection value (throw undefined somewhere)
      // must still block the silent attempt in shouldAttemptSilentSso.
      return err || new Error("redirect failed with no error object")
    })
    .then(async (redirectError) => {
      // Silent SSO (prompt=none, full-page redirect — see src/lib/silentSso.js
      // for why not ssoSilent and for every guard). Decided BEFORE React mounts:
      // on attempt the page navigates away without ever rendering, so the login
      // screen cannot flash; on success the next boot lands authenticated.
      if (isMsalConfigured && shouldAttemptSilentSso({ msalInstance, redirectError })) {
        const navigating = await attemptSilentSso(msalInstance, loginRequest)
        if (navigating) return
      }
      renderApp()
    })
    // Terminal backstop, restoring the old .finally(render) guarantee: no
    // matter what threw above, the user gets the app instead of a white page.
    .catch((err) => {
      console.warn("[boot] unexpected failure:", err?.message || err)
      renderApp()
    })
}
