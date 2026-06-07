import * as React from "react";
import { getMsalInstance, isAuthConfigured } from "@/lib/auth/msal";
import { shouldUseMock } from "@/lib/dataverse";

/**
 * 🔒 Read-only — fetch the signed-in user's Microsoft 365 profile photo
 * from Graph for the sidebar avatar. Falls back to `null` (caller shows
 * initials) on any failure: no photo set, no Graph consent, mock mode,
 * or a stale session.
 *
 * Why silent-only: the avatar is decorative, so we NEVER escalate to an
 * interactive popup just to render a face. The `User.Read` scope is
 * already part of `loginRequest`, so the token is normally cached /
 * refresh-token reachable; if it isn't, initials are a fine fallback.
 *
 * The blob → objectURL is cached at module scope keyed by account, so
 * the photo is fetched once per signed-in user per session (the
 * ProfileMenu can mount the avatar twice — trigger + popover — without
 * double-fetching, and sidebar collapse/expand doesn't refetch).
 */

const GRAPH_PHOTO_URL = "https://graph.microsoft.com/v1.0/me/photo/$value";
const GRAPH_SCOPES = ["User.Read"];

/** accountId → objectURL (or null when the user has no photo / it failed). */
const photoCache = new Map<string, string | null>();
/** In-flight loads so a remount doesn't kick off a second fetch. */
const inFlight = new Map<string, Promise<string | null>>();

async function loadPhoto(accountId: string): Promise<string | null> {
  const msal = getMsalInstance();
  const account =
    msal.getAllAccounts().find((a) => a.homeAccountId === accountId) ??
    msal.getActiveAccount() ??
    msal.getAllAccounts()[0] ??
    null;
  if (!account) return null;

  let token: string;
  try {
    const res = await msal.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    });
    token = res.accessToken;
  } catch {
    // Silent-only by design — an avatar isn't worth an interactive prompt.
    return null;
  }

  try {
    const resp = await fetch(GRAPH_PHOTO_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 404 = user has no profile photo set; any non-OK → fall back.
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Returns an object-URL for the signed-in user's profile photo, or null
 * (→ render initials). Pass the MSAL account's `homeAccountId`.
 */
export function useUserPhoto(
  accountId: string | null | undefined
): string | null {
  const [url, setUrl] = React.useState<string | null>(() =>
    accountId ? (photoCache.get(accountId) ?? null) : null
  );

  React.useEffect(() => {
    if (!accountId || shouldUseMock() || !isAuthConfigured) {
      setUrl(null);
      return;
    }
    // Cache hit → use it, no network.
    if (photoCache.has(accountId)) {
      setUrl(photoCache.get(accountId) ?? null);
      return;
    }
    let cancelled = false;
    const existing = inFlight.get(accountId);
    const p = existing ?? loadPhoto(accountId);
    if (!existing) inFlight.set(accountId, p);
    void p.then((result) => {
      photoCache.set(accountId, result);
      inFlight.delete(accountId);
      if (!cancelled) setUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return url;
}
