import { useEffect, useState } from "react"
import { useMsal } from "@azure/msal-react"
import { ensureMsalInitialized, isMsalConfigured } from "@/lib/msal"

/**
 * Checks whether the signed-in MSAL user is a member of an Entra ID
 * security group.
 *
 * Strategy (in order):
 *   1. Primary — read `account.idTokenClaims.groups` (Array<string> of group
 *      object-ids). Requires the Azure AD app reg → Token configuration →
 *      "Add groups claim" → "Security groups" → ID token. Zero network calls.
 *   2. Fallback — when the claim is missing or not an array (Azure AD emits
 *      no `groups` claim if the user is in > ~200 groups — "token overage" —
 *      OR if the claim isn't configured yet), call
 *      `POST https://graph.microsoft.com/v1.0/me/checkMemberGroups`
 *      with `{ groupIds: [groupId] }`. Requires delegated
 *      `GroupMember.Read.All` (admin-consented).
 *   3. Mock mode (MSAL not configured / no active account) → false.
 *
 * The result is memoized in a module-level Map keyed by
 * `${homeAccountId}::${groupId}` so re-mounts and route changes within the
 * same browser session don't re-hit Graph. Logout clears the cache via
 * `clearGroupMembershipCache()` invoked from the MSAL event callback in
 * `src/lib/msal.js`.
 *
 * @param {string} groupId Entra ID group object-id (GUID) to check.
 * @returns {boolean | undefined}
 *   - true  → member
 *   - false → not member OR no MSAL session OR Graph fallback failed
 *   - undefined → still resolving (only during the initial Graph round-trip;
 *                 the primary claim path is synchronous and never undefined)
 */

const membershipCache = new Map()

export function clearGroupMembershipCache() {
  membershipCache.clear()
}

function cacheKey(account, groupId) {
  return `${account?.homeAccountId ?? "anon"}::${groupId}`
}

export function useIsInGroup(groupId) {
  const { accounts, instance } = useMsal()
  const account = accounts[0]

  const [result, setResult] = useState(() => {
    if (!isMsalConfigured || !account) return false
    const claimGroups = account.idTokenClaims?.groups
    if (Array.isArray(claimGroups)) return claimGroups.includes(groupId)
    const cached = membershipCache.get(cacheKey(account, groupId))
    return cached === undefined ? undefined : cached
  })

  useEffect(() => {
    if (!isMsalConfigured || !account) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(false)
      return
    }
    const claimGroups = account.idTokenClaims?.groups
    if (Array.isArray(claimGroups)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(claimGroups.includes(groupId))
      return
    }
    const key = cacheKey(account, groupId)
    const cached = membershipCache.get(key)
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(cached)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await ensureMsalInitialized()
        const tokenResp = await instance.acquireTokenSilent({
          scopes: ["GroupMember.Read.All"],
          account,
        })
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me/checkMemberGroups",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenResp.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ groupIds: [groupId] }),
          },
        )
        if (cancelled) return
        if (!res.ok) {
          // Fail-closed but do NOT cache so a later retry can succeed.
          setResult(false)
          return
        }
        const json = await res.json()
        const isMember = Array.isArray(json.value) && json.value.includes(groupId)
        membershipCache.set(key, isMember)
        setResult(isMember)
      } catch {
        // InteractionRequiredAuthError, network failures, etc. — fail-closed.
        if (!cancelled) setResult(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId, groupId])

  return result
}
