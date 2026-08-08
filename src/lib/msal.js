import { PublicClientApplication, EventType, LogLevel } from "@azure/msal-browser"

// Redirect URI is derived from window.location.origin + Vite's BASE_URL, so
// it stays correct across:
//   - dev (http://localhost:5173/)
//   - the custom domain (https://tyrotrade.ttech.business/)
//   - any future legacy fallback under a subpath
// The Azure AD app registration must list every origin that actually serves
// the SPA in its SPA redirect URI list — currently localhost, the custom
// domain, and the legacy ttech-ai.github.io/tyro path.
function buildOrigin() {
  if (typeof window === "undefined") return "/"
  return window.location.origin + import.meta.env.BASE_URL
}

// Defaults baked in so the SPA also works when env vars aren't loaded (e.g. GH Pages
// build without a .env file). Override via VITE_MSAL_* if a different tenant/app is used.
// Note: SPA client IDs are not secrets — they ship in the bundle and are tied to
// allowed redirect URIs in Azure AD.
const TENANT_ID = import.meta.env.VITE_MSAL_TENANT_ID || "9efa3bdf-67ad-47e3-8dfb-d1df79a6d7fa"
const CLIENT_ID = import.meta.env.VITE_MSAL_CLIENT_ID || "31e375e5-7aa7-4bd6-b6f0-96968f8360f8"

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: buildOrigin(),
    postLogoutRedirectUri: buildOrigin() + "login",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // localStorage so tokens survive tab close; sessionStorage if you want per-session
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error,
      piiLoggingEnabled: false,
      loggerCallback: () => {},
    },
  },
}

export const COPILOT_STUDIO_SCOPE = "https://api.powerplatform.com/CopilotStudio.Copilots.Invoke"

export const loginRequest = {
  // GroupMember.Read.All is here so the consent prompt at first login also
  // covers the Graph /me/checkMemberGroups fallback in useIsInGroup. Without
  // it, the silent-token-acquisition would throw InteractionRequired and the
  // hook would fail-closed (= no admin tabs even for real admins). Still
  // requires admin consent on the app registration to take effect tenant-wide.
  //
  // `User.Read.All` (useIsUnderManager, manager chain) is deliberately NOT
  // here. It requires admin consent, and an unconsented admin-consent scope
  // in the LOGIN request turns the whole sign-in into an "Approval required"
  // wall — nobody gets into the app at all. The hook asks for it on its own
  // via acquireTokenSilent instead: once admin consent is granted the silent
  // call succeeds tenant-wide with no user prompt, and until then it throws
  // InteractionRequired and the hook fails closed (restricted agent stays
  // locked). Feature degrades; login never breaks. Same reasoning applies to
  // any future admin-consent scope — keep them out of loginRequest.
  scopes: ["User.Read", "GroupMember.Read.All", "openid", "profile", "email"],
  prompt: "select_account",
  extraScopesToConsent: [COPILOT_STUDIO_SCOPE],
}

export const copilotStudioRequest = {
  scopes: [COPILOT_STUDIO_SCOPE],
}

// Dataverse Web API access. Requires the SPA app registration to have
// "Dynamics CRM > user_impersonation" delegated permission (admin consented).
// The scope is the Dataverse environment URL + /user_impersonation.
export const DATAVERSE_URL = import.meta.env.VITE_DATAVERSE_URL || "https://tyro.crm4.dynamics.com"
export const dataverseRequest = {
  scopes: [`${DATAVERSE_URL}/user_impersonation`],
}

export const isMsalConfigured = Boolean(CLIENT_ID)

// sessionStorage flag used ONLY when MSAL isn't configured (mock / dev login).
// Single source of truth shared by App, LoginPage and NavUser.
export const MOCK_LOGGED_IN_KEY = "tyrotrade-logged-in"

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialize the instance and pick up the active account if one exists in cache.
// Must be awaited before any login/account calls.
let initPromise = null
export function ensureMsalInitialized() {
  if (!initPromise) {
    initPromise = msalInstance.initialize().then(() => {
      const accounts = msalInstance.getAllAccounts()
      if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
        msalInstance.setActiveAccount(accounts[0])
      }
    })
  }
  return initPromise
}

// Keep active account in sync with login / logout events
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account)
  }
  if (event.eventType === EventType.LOGOUT_SUCCESS) {
    msalInstance.setActiveAccount(null)
    // Wipe the in-memory group-membership AND manager-chain caches so a
    // different user signing into the same browser doesn't inherit the
    // previous user's "is admin" / "reports to X" verdict. Dynamic imports
    // avoid a cyclic module init (both hooks import ensureMsalInitialized
    // from THIS file).
    import("@/hooks/useIsInGroup")
      .then((m) => m.clearGroupMembershipCache())
      .catch(() => {
        // best effort — if the hook isn't reachable, the cache is gone
        // when the SPA re-mounts anyway
      })
    import("@/hooks/useIsUnderManager")
      .then((m) => m.clearManagerChainCache())
      .catch(() => {
        // best effort — see above
      })
  }
})
