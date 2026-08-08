import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { MsalProvider } from "@azure/msal-react"
import "@fontsource/kanit/700.css"
import "./index.css"
import App from "./App.jsx"
import { msalInstance, ensureMsalInitialized } from "@/lib/msal"
import { applyDefaultsMigration } from "@/lib/defaultsMigration"
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
  // BEFORE anything reads localStorage: one-time wipe of stale persisted
  // defaults (old locale/palette) so the 2026-08 default change actually
  // reaches browsers that visited earlier. See the module for the rationale.
  applyDefaultsMigration()

  // Answer-notification buttons. A service-worker notification has no default
  // click behaviour: notify-sw.js focuses this tab and posts the chosen action
  // here, and this turns it into the same in-app "open the chat" signal the
  // toast uses. Registered at boot, outside React, so it works whatever screen
  // happens to be mounted when the click arrives.
  onNotificationAction((action) => requestOpenChat({ focusComposer: action === "reply" }))

  ensureMsalInitialized()
    .then(() => msalInstance.handleRedirectPromise())
    .then((result) => {
      if (result?.account) {
        msalInstance.setActiveAccount(result.account)
        // Redirect URI is root; route the freshly-authed user straight to
        // /dashboard so the auth gate doesn't flash /login while React's
        // useIsAuthenticated catches up after the redirect callback.
        window.history.replaceState(null, "", import.meta.env.BASE_URL + "dashboard")
      }
    })
    .catch((err) => {
      console.warn("[MSAL] redirect handler failed:", err?.errorCode || err?.message || err)
    })
    .finally(() => {
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
    })
}
