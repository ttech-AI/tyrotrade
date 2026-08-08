import { useEffect, useState } from "react"
import { useMsal } from "@azure/msal-react"
import { isMsalConfigured, ensureMsalInitialized } from "@/lib/msal"
import { currentUser as mockUser } from "@/data/user"

function initialsFromName(name) {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

// Microsoft Graph profile-photo cache key (per MSAL account id).
//
// Two stored states:
//   - data URL string  → user has a photo, render it directly
//   - "none"           → confirmed no photo (e.g. 404 from Graph), don't
//                        keep retrying every mount
// Anything else (missing key) means we haven't tried yet.
function photoCacheKey(account) {
  return `tyrotrade-photo-${account?.homeAccountId ?? "unknown"}`
}

function readCachedPhoto(account) {
  if (typeof window === "undefined" || !account) return undefined
  const v = window.localStorage.getItem(photoCacheKey(account))
  if (v === null) return undefined
  if (v === "none") return null
  return v
}

function writeCachedPhoto(account, value) {
  if (typeof window === "undefined" || !account) return
  try {
    window.localStorage.setItem(photoCacheKey(account), value ?? "none")
  } catch {
    // Quota errors are non-fatal — just skip the cache write.
  }
}

async function fetchGraphPhoto(account, instance) {
  await ensureMsalInitialized()
  const tokenResp = await instance.acquireTokenSilent({
    scopes: ["User.Read"],
    account,
  })
  const res = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
    headers: { Authorization: `Bearer ${tokenResp.accessToken}` },
  })
  // 404 = the user just doesn't have a profile photo set. Treat as "no
  // photo" rather than an error so the fallback PastelOrb sticks.
  if (!res.ok) return null
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Returns the currently signed-in user in a shape matching `currentUser`:
 *   { name, fullName, initials, email, title, photoUrl }
 *
 * When MSAL is configured and a session is active, values come from the active
 * MSAL account claims and (if available) the Microsoft Graph profile photo.
 * Otherwise it falls back to the mock currentUser so the UI keeps working in
 * preview / no-auth mode. `photoUrl` is null when the user has no photo or
 * MSAL isn't configured.
 */
export function useMe() {
  const { accounts, instance } = useMsal()
  const account = accounts[0]

  // photoUrl is async: synchronous read from localStorage on first render
  // gives an instant cached photo; the effect below refreshes from Graph if
  // we've never tried (i.e. cache miss). `undefined` = haven't tried,
  // `null` = confirmed no photo, string = data URL.
  const [photoUrl, setPhotoUrl] = useState(() =>
    isMsalConfigured && account ? readCachedPhoto(account) ?? null : null,
  )

  useEffect(() => {
    if (!isMsalConfigured || !account) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhotoUrl(null)
      return
    }
    const cached = readCachedPhoto(account)
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhotoUrl(cached)
      return
    }
    let cancelled = false
    fetchGraphPhoto(account, instance)
      .then((dataUrl) => {
        if (cancelled) return
        writeCachedPhoto(account, dataUrl)
        setPhotoUrl(dataUrl)
      })
      .catch(() => {
        // Network / token errors — leave photoUrl null but don't poison the
        // cache (the next mount will retry).
        if (!cancelled) setPhotoUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [account, instance])

  if (!isMsalConfigured || !account) return { ...mockUser, photoUrl: null }

  const fullName = account.name || account.username || mockUser.fullName
  const firstName = fullName.split(/\s+/)[0]

  return {
    name: firstName,
    fullName,
    initials: initialsFromName(fullName) || mockUser.initials,
    email: account.username || mockUser.email,
    title: mockUser.title,
    photoUrl,
  }
}
