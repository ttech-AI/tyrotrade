/**
 * Freight Dataverse token acquisition — bridges the ported client onto
 * tyroTrade's existing MSAL instance.
 *
 * The freight pages read a DIFFERENT Dataverse environment than the app
 * launcher does (operations-tiryaki vs tyro), so this is a second resource
 * and therefore a second token. Same tenant and the same signed-in account,
 * so no extra login: `acquireTokenSilent` mints it from the existing refresh
 * token the first time a freight page asks for data.
 *
 * Why silent-then-REDIRECT (the source used a popup): tyroTrade's whole auth
 * flow is redirect-based — a popup here would be blocked unless it happens to
 * be inside a user gesture, and these calls fire from data fetches.
 */
import { InteractionRequiredAuthError } from "@azure/msal-browser"
import { msalInstance, freightRequest, ensureMsalInitialized } from "@/lib/msal"

function activeAccount() {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) {
    throw new Error("[freight-auth] No signed-in account; sign in first.")
  }
  return msalInstance.getActiveAccount() ?? accounts[0]
}

/** Access token for the freight Dataverse environment (no "Bearer " prefix). */
export async function acquireDataverseToken(): Promise<string> {
  await ensureMsalInitialized()
  const account = activeAccount()
  try {
    const result = await msalInstance.acquireTokenSilent({ ...freightRequest, account })
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Consent for this resource hasn't been given yet (or was revoked).
      // Redirect is the only interaction type that reliably survives a
      // non-gesture call site; the user lands back on the same page signed in
      // with the freight scope granted.
      await msalInstance.acquireTokenRedirect({ ...freightRequest, account })
      // acquireTokenRedirect navigates away; nothing after this runs.
      throw err
    }
    throw err
  }
}

/** Force-refresh after a 401 — bypasses the MSAL cache. */
export async function refreshDataverseToken(): Promise<string> {
  await ensureMsalInitialized()
  const account = activeAccount()
  const result = await msalInstance.acquireTokenSilent({
    ...freightRequest,
    account,
    forceRefresh: true,
  })
  return result.accessToken
}
