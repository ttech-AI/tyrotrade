import { useEffect, useState } from "react"
import { useMsal } from "@azure/msal-react"
import { ensureMsalInitialized, isMsalConfigured } from "@/lib/msal"

/**
 * Oturum açmış kullanıcının Entra ID yönetici zincirinde verilen
 * kişilerden herhangi birinin bulunup bulunmadığını döndürür.
 *
 * Neden Graph, neden grup değil: Entra dinamik grup kuralları manager
 * hiyerarşisini ifade edemiyor, statik grup ise her işe alım/terfide elle
 * bakım isterdi. Hiyerarşiyi doğrudan okumak kuralı kendi kendine güncel
 * tutar.
 *
 * Neden AŞAĞI değil YUKARI yürüyoruz: Graph'ın `transitiveReports` ilişkisi
 * yalnızca `$count` destekliyor, üyeleri listelemiyor. Kullanıcıdan köke
 * doğru tek istekle çıkmak hem mümkün hem O(1):
 *
 *   GET /v1.0/me?$select=id,userPrincipalName,mail
 *       &$expand=manager($levels=max;$select=id,displayName,userPrincipalName,mail)
 *   ConsistencyLevel: eventual
 *
 * `$levels` yalnızca tek-kullanıcı endpoint'inde (`/me`, `/users/{id}`)
 * çalışır ve **ConsistencyLevel: eventual** başlığı ZORUNLUDUR — başlık
 * olmadan Graph 400 döner. Yanıt iç içe `manager.manager…` olarak gelir.
 *
 * İzin: zincirin üstündeki kişiler "başka kullanıcı" olduğu için tenant
 * çapında okuma gerekir; `User.Read` yalnızca kullanıcının KENDİ bir seviye
 * yukarısını (`/me/manager`) görmeye yeter, çok seviyeli zincire yetmez.
 * Graph dokümantasyonu "List manager" için en az yetkili delegated izni
 * **User.Read.All** olarak veriyor ve `User.ReadBasic.All`'ı tabloda hiç
 * saymıyor — ama tyro app registration'ında onaylı olan ReadBasic.All, o
 * yüzden gerçekten yetip yetmediği SCOPE_LADDER ile çalışma anında ölçülüyor
 * (dışarıdan test edilemedi: Azure CLI istemcisi bu scope'u Graph'tan
 * isteyemiyor, AADSTS65002 preauthorization hatası veriyor).
 *
 * Hiçbir basamak tutmazsa hook fail-closed davranır (false) — ve bu, "agent
 * herkeste kilitli" arızasının tek sebebidir: token yoksa zincir okunamaz,
 * kurala uyan kullanıcılar da kilitli kalır. Teşhis: `?authdebug=1`.
 *
 * Zincir, hesap başına modül seviyesinde cache'lenir; cache'lenen şey
 * VERDICT değil zincirin kendisi, böylece ileride ikinci bir yönetici kuralı
 * eklenirse aynı zincir yeniden kullanılır. Logout'ta
 * `clearManagerChainCache()` çağrılır (src/lib/msal.js event callback).
 *
 * @param {string[]} targetKeys Aranan kişilerin objectId ve/veya UPN'leri
 *   (küçük harf normalize edilmiş — bkz. TRADER_MANAGER_KEYS).
 * @returns {boolean | undefined}
 *   - true      → zincirde (veya kullanıcının kendisi) eşleşme var
 *   - false     → eşleşme yok / MSAL oturumu yok / Graph başarısız (fail-closed)
 *   - undefined → hâlâ çözülüyor (ilk Graph turu)
 */

const GRAPH_ME_CHAIN =
  "https://graph.microsoft.com/v1.0/me" +
  "?$select=id,userPrincipalName,mail" +
  "&$expand=manager($levels=max;$select=id,displayName,userPrincipalName,mail)"

/**
 * Denenecek Graph izinleri, sırayla. İlki dokümantasyonun manager ilişkisi
 * için istediği ve app registration'a 2026-08-03'te eklenen izin; onunla
 * başlıyoruz ki normal durumda tek istek yetsin.
 *
 * İkincisi fallback: `User.ReadBasic.All` app'te ayrıca onaylı. Manager
 * ilişkisi için dokümantasyonda sayılmıyor, yani muhtemelen 403 verir — ama
 * dışarıdan test edilemedi (Azure CLI istemcisi bu scope'u Graph'tan
 * isteyemiyor, AADSTS65002) ve Read.All ileride kaldırılırsa özelliğin sessizce
 * ölmesi yerine bir şansı daha olsun.
 *
 * Maliyet: yalnızca başarısız basamak başına bir token denemesi + bir istek,
 * ve zincir hesap başına cache'lendiği için oturumda bir kez ödenir.
 */
const SCOPE_LADDER = ["User.Read.All", "User.ReadBasic.All"]

/**
 * Zinciri okumayı sırayla her izinle dener. İlk 200 kazanır.
 * @returns {{me?: object, scope?: string, error?: string}}
 */
async function fetchChainWithAnyScope(instance, account, debug) {
  let lastError = "hiçbir izin denenemedi"
  for (const scope of SCOPE_LADDER) {
    let token
    try {
      const resp = await instance.acquireTokenSilent({ scopes: [scope], account })
      token = resp.accessToken
    } catch (err) {
      // Consent yok / etkileşim gerekiyor → sonraki basamak.
      lastError = `${scope}: token alınamadı (${err?.errorCode ?? err?.name ?? "hata"})`
      if (debug) console.warn(`[useIsUnderManager] ${lastError}`)
      continue
    }
    const res = await fetch(GRAPH_ME_CHAIN, {
      headers: {
        Authorization: `Bearer ${token}`,
        // $levels ile ZORUNLU — yoksa 400.
        ConsistencyLevel: "eventual",
      },
    })
    if (res.ok) {
      if (debug) console.info(`[useIsUnderManager] zincir okundu — izin: ${scope}`)
      return { me: await res.json(), scope }
    }
    // 403 = token var ama bu izin yetmiyor → bir üst basamağı dene.
    const body = await res.text().catch(() => "")
    lastError = `${scope}: Graph ${res.status} ${body.slice(0, 200)}`
    if (debug) console.warn(`[useIsUnderManager] ${lastError}`)
  }
  return { error: lastError }
}

// Zincir derinliği emniyet freni: Entra'da döngüsel manager ataması normalde
// engellenir ama bozuk bir veri seti sonsuz döngüye sokmasın.
const MAX_DEPTH = 25

const chainCache = new Map() // homeAccountId -> Set<string>

export function clearManagerChainCache() {
  chainCache.clear()
}

// Teşhis anahtarı. DEV'de her zaman açık; canlıda `?authdebug=1` ile açılır
// (sessionStorage'a yazılır, `?authdebug=0` kapatır) — çünkü "agent bende
// kilitli, neden?" sorusu YALNIZCA production'da soruluyor ve DEV'e kapatılmış
// bir log orada hiç yardım etmiyordu. Basılan tek veri kullanıcının kendi
// yönetici zinciri, kendi konsolunda: başka birinin verisi görünmez.
function authDebugEnabled() {
  if (import.meta.env.DEV) return true
  if (typeof window === "undefined") return false
  const param = new URLSearchParams(window.location.search).get("authdebug")
  if (param === "1") window.sessionStorage.setItem("tyrotrade-auth-debug", "1")
  if (param === "0") window.sessionStorage.removeItem("tyrotrade-auth-debug")
  return window.sessionStorage.getItem("tyrotrade-auth-debug") === "1"
}

/** Kullanıcının kendisi + tüm üst yöneticilerinin id/UPN/mail anahtar kümesi. */
function collectChainKeys(me) {
  const keys = new Set()
  const add = (u) => {
    for (const v of [u?.id, u?.userPrincipalName, u?.mail]) {
      if (typeof v === "string" && v.trim()) keys.add(v.trim().toLowerCase())
    }
  }
  // Kullanıcının KENDİSİ de kümeye girer: iki yöneticinin agent'ı kendilerinin
  // de görmesi gerekiyor, onlar ise kendi zincirlerinde yer almaz.
  add(me)
  let node = me?.manager
  let depth = 0
  while (node && depth < MAX_DEPTH) {
    add(node)
    node = node.manager
    depth += 1
  }
  return keys
}

export function useIsUnderManager(targetKeys) {
  const { accounts, instance } = useMsal()
  const account = accounts[0]
  // Dizi referansı çağrı yerinden sabit gelse de (modül sabiti), effect
  // bağımlılığını içeriğe bağlamak daha güvenli.
  const targetSig = (targetKeys ?? []).join(",")

  const [result, setResult] = useState(() => {
    if (!isMsalConfigured || !account) return false
    const cached = chainCache.get(account.homeAccountId)
    if (!cached) return undefined
    return (targetKeys ?? []).some((k) => cached.has(k))
  })

  useEffect(() => {
    if (!isMsalConfigured || !account) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(false)
      return
    }
    const keys = targetSig ? targetSig.split(",") : []
    // Hiç hedef tanımlanmamışsa (constants henüz doldurulmadı) kimse geçmez.
    if (!keys.length) {
      setResult(false)
      return
    }
    const cached = chainCache.get(account.homeAccountId)
    if (cached) {
      setResult(keys.some((k) => cached.has(k)))
      return
    }

    let cancelled = false
    const debug = authDebugEnabled()
    ;(async () => {
      try {
        await ensureMsalInitialized()
        const { me, error } = await fetchChainWithAnyScope(instance, account, debug)
        if (cancelled) return
        if (error) {
          // Hiçbir izin tutmadı. Fail-closed ama cache'LEME — izin sonradan
          // verilirse bir sonraki mount yeniden denesin.
          if (debug) {
            console.warn(
              "[useIsUnderManager] yönetici zinciri okunamadı — agent herkeste" +
                " kilitli kalır. Graph izinlerini kontrol et" +
                ` (${SCOPE_LADDER.join(" / ")}). Son hata: ${error}`,
            )
          }
          setResult(false)
          return
        }
        const chain = collectChainKeys(me)
        chainCache.set(account.homeAccountId, chain)
        const matched = keys.some((k) => chain.has(k))
        if (debug) {
          // Hedefleri de basıyoruz: eşleşme olmadığında suçlu genellikle
          // constants.js'teki UPN tahmini oluyor ve iki listeyi yan yana
          // görmeden bunu anlamak mümkün değil.
          console.info("[useIsUnderManager] eşleşme:", matched)
          console.info("[useIsUnderManager] aranan (constants.js):", keys)
          console.info("[useIsUnderManager] zincirim:", [...chain])
          console.info(
            "[useIsUnderManager] yönetici sırası:",
            (function names(u, out = []) {
              let n = u?.manager
              while (n && out.length < MAX_DEPTH) {
                out.push(`${n.displayName ?? "?"} <${n.userPrincipalName ?? n.mail ?? "?"}>`)
                n = n.manager
              }
              return out
            })(me),
          )
        }
        setResult(matched)
      } catch (err) {
        // Ağ hatası / beklenmeyen istisna — fail-closed, cache yok.
        // (Token ve 403 durumları merdivenin içinde ele alınıyor.)
        if (debug) {
          console.warn(
            "[useIsUnderManager] beklenmeyen hata — fail-closed:",
            err?.errorCode ?? err?.name ?? err,
          )
        }
        if (!cancelled) setResult(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId, targetSig])

  return result
}
