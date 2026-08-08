import { InteractionRequiredAuthError } from "@azure/msal-browser"
import { msalInstance, dataverseRequest, DATAVERSE_URL } from "./msal"

const API_BASE = `${DATAVERSE_URL}/api/data/v9.2`
const TABLE = "tyro_launcherapps" // entity-set name (plural)

// tyro_type choice values — match ../tyro reposundaki scripts/import_seed_data.py
export const TYPE_AGENT = 100000000
export const TYPE_AI_APP = 100000001
export const TYPE_BUSINESS_APP = 100000002

const COLLECTION_TO_TYPE = {
  agents: TYPE_AGENT,
  aiApps: TYPE_AI_APP,
  businessApps: TYPE_BUSINESS_APP,
}

// Dataverse record ids are GUIDs. Client-generated fallback ids (makeId) and the
// static seed ids are NOT — using one as an OData key (PATCH/DELETE) returns 400.
// Used to decide create-vs-update and to skip remote calls on local-only rows.
export function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  )
}

async function getToken() {
  const account = msalInstance.getActiveAccount()
  if (!account) throw new Error("No active MSAL account")
  try {
    const result = await msalInstance.acquireTokenSilent({
      ...dataverseRequest,
      account,
    })
    return result.accessToken
  } catch (err) {
    // Silent renewal failed (refresh token expired or Dataverse consent missing).
    // We deliberately do NOT auto-trigger an interactive redirect from a background
    // data call — that would yank the whole page to AAD without user action. Surface
    // a clear error so ConfigProvider falls back to cached/seed and CRUD shows a real
    // failure; reconnecting requires an explicit sign-out / sign-in.
    if (err instanceof InteractionRequiredAuthError) {
      throw new Error(
        "Dataverse session expired — sign out and sign in again to reconnect.",
        { cause: err },
      )
    }
    throw err
  }
}

async function api(path, init = {}) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Dataverse ${res.status}: ${text || res.statusText}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---- row ↔ UI item mapping ----

function rowToAgent(r) {
  return {
    id: r.tyro_launcherappid,
    name: r.tyro_name ?? "",
    description: r.tyro_description ?? "",
    tenantId: r.tyro_tenantid ?? "",
    clientId: r.tyro_clientid ?? "",
    agentId: r.tyro_agentid ?? "",
    iconName: r.tyro_iconname ?? "",
    logo: null,
  }
}

function rowToApp(r) {
  return {
    id: r.tyro_launcherappid,
    name: r.tyro_name ?? "",
    description: r.tyro_description ?? "",
    url: r.tyro_url ?? "#",
    iconName: r.tyro_iconname ?? "",
    logo: null,
  }
}

function agentToRow(item) {
  return {
    tyro_name: item.name ?? "",
    tyro_type: TYPE_AGENT,
    tyro_description: item.description ?? "",
    tyro_tenantid: item.tenantId ?? "",
    tyro_clientid: item.clientId ?? "",
    tyro_agentid: item.agentId ?? "",
    tyro_iconname: item.iconName ?? "",
    tyro_isactive: true,
  }
}

function appToRow(item, type) {
  return {
    tyro_name: item.name ?? "",
    tyro_type: type,
    tyro_description: item.description ?? "",
    tyro_url: item.url ?? "#",
    tyro_iconname: item.iconName ?? "",
    tyro_isactive: true,
  }
}

// ---- public API ----

export async function fetchAllItems() {
  const select = [
    "tyro_launcherappid",
    "tyro_name",
    "tyro_type",
    "tyro_description",
    "tyro_url",
    "tyro_tenantid",
    "tyro_clientid",
    "tyro_agentid",
    "tyro_iconname",
    "tyro_sortorder",
    "tyro_isactive",
  ].join(",")
  const data = await api(
    `/${TABLE}?$select=${select}&$filter=tyro_isactive eq true&$orderby=tyro_sortorder`,
  )
  const rows = data.value || []
  return {
    agents: rows.filter((r) => r.tyro_type === TYPE_AGENT).map(rowToAgent),
    aiApps: rows.filter((r) => r.tyro_type === TYPE_AI_APP).map(rowToApp),
    businessApps: rows.filter((r) => r.tyro_type === TYPE_BUSINESS_APP).map(rowToApp),
  }
}

// Copilot Studio agent'larının gerçek ikonu konuşma SDK'sında YOKTUR; agent'lar
// Dataverse'te `bot` tablosunda (entity set: bots) durur ve ikon orada bir image
// kolonunda saklanır. ÖNEMLİ: bu bot'lar app'in launcher Dataverse'inden
// (tyro.crm4) FARKLI bir ortamda olabilir. Bu yüzden Global Discovery ile
// kullanıcının eriştiği tüm ortamları bulup her birinde schemaName'leri arıyoruz.
const DISCO_URL = "https://globaldisco.crm.dynamics.com"

// Verilen Dataverse org URL'i için kaynağa özel (audience = o org) bir token al.
// "Dynamics CRM user_impersonation" delegated izni tüm org'lar için geçerlidir;
// scope'u org URL'ine göre isteyince token o org'a göre düzenlenir.
async function getTokenForResource(resourceUrl) {
  const account = msalInstance.getActiveAccount()
  if (!account) throw new Error("No active MSAL account")
  const result = await msalInstance.acquireTokenSilent({
    scopes: [`${String(resourceUrl).replace(/\/$/, "")}/user_impersonation`],
    account,
  })
  return result.accessToken
}

// Keyfi bir org URL'ine karşı GET (cross-env).
async function dvGet(baseUrl, path) {
  const token = await getTokenForResource(baseUrl)
  const res = await fetch(`${baseUrl}/api/data/v9.2${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
  })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`)
  return res.json()
}

// Global Discovery: kullanıcının eriştiği tüm Dataverse ortamlarının API URL'leri.
async function discoverOrgUrls() {
  const token = await getTokenForResource(DISCO_URL)
  const res = await fetch(`${DISCO_URL}/api/discovery/v2.0/Instances`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`discovery ${res.status}`)
  const data = await res.json()
  return [...new Set((data.value || []).map((i) => i.ApiUrl).filter(Boolean))]
}

// Tek bir org'da schemaName'leri arayıp ikon thumbnail'lerini döndürür.
async function fetchBotIconsFromOrg(baseUrl, names) {
  const filter = names.map((s) => `schemaname eq '${String(s).replace(/'/g, "''")}'`).join(" or ")
  const data = await dvGet(baseUrl, `/bots?$select=botid,schemaname,name&$filter=${encodeURIComponent(filter)}`)
  const bots = data.value || []
  if (!bots.length) return {}

  // İkon kolonunu keşfet: `bot` tablosunda image-tipi kolon yok; Copilot Studio
  // ikonu `iconbase64` (Memo) gibi base64 metin kolonunda durur. Adında
  // icon/image/logo/avatar/picture geçen kolonları aday alıyoruz (kolon adını
  // sabitlemeyip ortamlar arası farklara dayanıklı kalmak için).
  let cols = []
  try {
    const md = await dvGet(
      baseUrl,
      `/EntityDefinitions(LogicalName='bot')/Attributes?$select=LogicalName`,
    )
    cols = (md.value || [])
      .map((a) => a.LogicalName)
      .filter((n) => /icon|image|logo|avatar|picture/i.test(n))
  } catch {
    /* metadata okunamadı */
  }
  if (!cols.length) return {}

  const map = {}
  await Promise.all(
    bots.map(async (bot) => {
      if (!bot.schemaname) return
      try {
        const row = await dvGet(baseUrl, `/bots(${bot.botid})?$select=${cols.join(",")}`)
        const raw = cols.map((c) => row[c]).find((v) => typeof v === "string" && v.length > 0)
        const uri = base64ToDataUri(raw)
        if (uri) map[bot.schemaname] = uri
      } catch {
        /* tek bot ikonu çekilemedi — atla */
      }
    }),
  )
  return map
}

// Ham base64'ü (veya hazır data-URI'yi) bir <img> kaynağına çevirir. Mime'ı
// base64 imza ön-ekinden tespit eder ki yanlış tip yüzünden kırık görünmesin.
function base64ToDataUri(raw) {
  if (typeof raw !== "string" || !raw) return null
  if (raw.startsWith("data:")) return raw
  let mime = "image/png"
  if (raw.startsWith("/9j/")) mime = "image/jpeg"
  else if (raw.startsWith("R0lGOD")) mime = "image/gif"
  else if (raw.startsWith("UklGR")) mime = "image/webp"
  else if (raw.startsWith("PHN2Zy") || raw.startsWith("PD94bWw") || raw.startsWith("PHN2ZyA")) mime = "image/svg+xml"
  return `data:${mime};base64,${raw}`
}

// Verilen schemaName'ler (agent.agentId) için { schemaName → dataURI } haritası.
// Önce app'in kendi ortamı, sonra (opsiyonel) VITE_COPILOT_DATAVERSE_URL override,
// sonra Global Discovery ile bulunan tüm ortamlar denenir; ilk eşleşen kazanır.
// Tamamen best-effort: hiçbir ortamda bulunamaz/erişilemezse {} döner.
export async function fetchBotIcons(schemaNames) {
  const names = [...new Set((schemaNames || []).filter((s) => s && s !== "agent-id"))]
  if (!names.length) return {}

  const candidates = [DATAVERSE_URL]
  const override = import.meta.env.VITE_COPILOT_DATAVERSE_URL
  if (override) candidates.push(override)
  try {
    candidates.push(...(await discoverOrgUrls()))
  } catch (err) {
    console.warn("[Dataverse] ortam keşfi (global discovery) başarısız:", err.message)
  }

  // Tüm ortamlarda ara, sonuçları birleştir: agent'lar farklı ortamlarda olabilir.
  // Her ortamda yalnızca HÂLÂ eksik olan schemaName'leri sorgula; hepsi bulununca dur.
  const found = {}
  const seen = new Set()
  for (const raw of candidates) {
    const baseUrl = String(raw || "").replace(/\/$/, "")
    if (!baseUrl || seen.has(baseUrl)) continue
    seen.add(baseUrl)
    const remaining = names.filter((n) => !found[n])
    if (!remaining.length) break
    try {
      Object.assign(found, await fetchBotIconsFromOrg(baseUrl, remaining))
    } catch (err) {
      console.warn(`[Dataverse] ${baseUrl} sorgulanamadı:`, err.message)
    }
  }
  const missing = names.filter((n) => !found[n])
  if (missing.length) {
    console.info(
      "[Dataverse] ikonu bulunamayan agent'lar (agentId hiçbir bot.schemaname ile eşleşmiyor):",
      missing,
    )
  }
  return found
}

export async function createItem(collection, item) {
  const type = COLLECTION_TO_TYPE[collection]
  const row = collection === "agents" ? agentToRow(item) : appToRow(item, type)
  const created = await api(`/${TABLE}`, {
    method: "POST",
    body: JSON.stringify(row),
    headers: { Prefer: "return=representation" },
  })
  const mapped = collection === "agents" ? rowToAgent(created) : rowToApp(created)
  // tyro_logo is a Dataverse *file* column and can't be written via the entity JSON,
  // so the server row always comes back with logo:null. Carry the client's uploaded
  // logo forward so it survives in local state + cache (see ConfigProvider merge).
  return { ...mapped, logo: item.logo ?? null }
}

export async function updateItem(collection, item) {
  const type = COLLECTION_TO_TYPE[collection]
  const row = collection === "agents" ? agentToRow(item) : appToRow(item, type)
  const updated = await api(`/${TABLE}(${item.id})`, {
    method: "PATCH",
    body: JSON.stringify(row),
    headers: { Prefer: "return=representation" },
  })
  // Return authoritative server fields when the PATCH echoed the row; fall back to
  // the local item if the server answered 204. Either way preserve the client logo
  // (tyro_logo is a file column the entity JSON can't set — see createItem).
  if (!updated) return { ...item }
  const mapped = collection === "agents" ? rowToAgent(updated) : rowToApp(updated)
  return { ...mapped, logo: item.logo ?? null }
}

export async function deleteItem(id) {
  await api(`/${TABLE}(${id})`, { method: "DELETE" })
}
