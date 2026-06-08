import {
  PublicClientApplication,
  type Configuration,
  type RedirectRequest,
} from "@azure/msal-browser";

/**
 * MSAL configuration for the tyroFreight SPA.
 *
 * Auth flow: PKCE redirect (Microsoft's recommendation for SPAs).
 * Token cache: sessionStorage — survives F5 within the tab, gone on close.
 *
 * The Dataverse env URL + user_impersonation scope come from `.env.local`.
 * Dev workflow: `VITE_USE_MOCK=true` bypasses login entirely.
 *
 * Multi-resource consent: `loginRequest.extraScopesToConsent` adds the
 * Copilot Studio scope so the user sees ONE combined consent screen at
 * login (Dataverse + Copilot Studio). MSAL's docs require using
 * resource-specific scopes here — `.default` cannot be combined with
 * other resource scopes (AADSTS70011). `CopilotStudio.Copilots.Invoke`
 * is the resource-specific PP scope the SDK accepts (same audience as
 * `.default`, just narrower).
 *
 * Azure AD app registration prerequisites:
 *   - Power Platform API → CopilotStudio.Copilots.Invoke (Delegated)
 *   - Dynamics CRM → user_impersonation (Delegated)
 *   Both granted (admin consent recommended).
 */

const tenantId = import.meta.env.VITE_AAD_TENANT_ID ?? "";
const clientId = import.meta.env.VITE_AAD_CLIENT_ID ?? "";
const redirectUri =
  import.meta.env.VITE_AAD_REDIRECT_URI ??
  (typeof window !== "undefined" ? window.location.origin : "");

const dataverseScope =
  import.meta.env.VITE_DATAVERSE_SCOPE ??
  (import.meta.env.VITE_DATAVERSE_URL
    ? `${import.meta.env.VITE_DATAVERSE_URL}/user_impersonation`
    : "");

/** Resource-specific Copilot Studio invoke scope. Avoids the `.default` +
 *  resource-specific combination that Azure AD rejects. */
export const COPILOT_STUDIO_SCOPE =
  "https://api.powerplatform.com/CopilotStudio.Copilots.Invoke";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

/** Login request — opens Microsoft sign-in with required scopes.
 *
 *  `extraScopesToConsent` includes the Copilot Studio scope so the consent
 *  screen lists both resources. MSAL issues a token only for the primary
 *  resource (Dataverse) here; the PP token is obtained later via
 *  `acquireTokenSilent` using the refresh token — no second prompt. */
export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile", "User.Read", dataverseScope].filter(Boolean),
  prompt: "select_account",
  extraScopesToConsent: [COPILOT_STUDIO_SCOPE],
};

/** Token request shape used by `acquireToken()`. */
export const dataverseTokenRequest = {
  scopes: dataverseScope ? [dataverseScope] : [],
};

/** Token request shape for Copilot Studio (used by ProjectWebChat). */
export const copilotStudioTokenRequest = {
  scopes: [COPILOT_STUDIO_SCOPE],
};

/** Lazy-init MSAL instance — only created when env vars are present. */
let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    if (!clientId || !tenantId) {
      throw new Error(
        "[auth] VITE_AAD_CLIENT_ID veya VITE_AAD_TENANT_ID tanımlı değil. " +
          ".env.local dosyasını kontrol et."
      );
    }
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

/** Convenience flag — true when MSAL config is complete. */
export const isAuthConfigured = !!(clientId && tenantId && dataverseScope);
