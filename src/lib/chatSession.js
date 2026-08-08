// Sohbetin 24 saatlik kalıcılığı — agent başına, kullanıcı başına.
//
// Sürmesi gereken İKİ şey var ve bunlar farklı yerlerde yaşıyor:
//
//   1. Kullanıcının GÖRDÜĞÜ döküm. Copilot Studio geçmiş aktiviteleri okumak
//      için bir API vermiyor: bir konuşmayı ID ile devam ettirmek AJANIN
//      hatırladığını geri getirir, kullanıcının ekranda gördüğünü değil. Yani
//      baloncuklar burada saklanır ya da hiç saklanmaz.
//   2. Copilot Studio KONUŞMASI (konu durumu, değişkenler, önceki turlar) —
//      sunucu tarafında, `conversationId` ile adreslenir. ID'yi dökümün
//      yanında tutup bir sonraki açılışta geri veriyoruz. Sunucu tarafındaki
//      ömrü belgelenmiş değil (yayımlanan 30 dk / 60 dk / 100 tur rakamları
//      FATURALANAN oturumu tarif ediyor), bu yüzden devam ettirme "elimizden
//      geleni yaparız" seviyesinde: başarısız olursa döküm yine de geri gelir.
//
// Neden `localStorage`, `sessionStorage` değil: sessionStorage tek bir SEKMEYE
// bağlı. Sekme kapanınca — hatta uygulamayı ikinci bir sekmede açınca —
// konuşma çöpe gidiyordu; bu modülün var olma sebebi tam olarak o.
//
// GİZLİLİK: bu, mesajları sekme ömrünün ötesine taşır. İki koruma var —
// snapshot oturum açmış kullanıcıya (`userKey`) bağlıdır ve son mesajdan
// itibaren 24 saatlik kayan pencerede yaşar. Eşleşmeyen ya da süresi dolmuş
// bir snapshot yok sayılmaz, SİLİNİR: ortak kullanılan bir makinede bir
// kullanıcının dökümü diğerine açık kalmasın.

import { msalInstance } from "./msal"

/** Kayan pencere: konuşma son hareketinden 24 saat sonra ölür. */
export const CHAT_SESSION_TTL_MS = 24 * 60 * 60 * 1000

const STORAGE_PREFIX = "tyrotrade:chat:session:v1:"
/** Bu modülün yerini aldığı sekme-ömürlü anahtarlar — ilk yüklemede temizlenir. */
const LEGACY_PREFIX = "tyrotrade-chat-v1:"
const SCHEMA_VERSION = 1

/* Boyut sınırları. Uygulama zaten localStorage'ı profil fotoğrafı ve
   yapılandırma için kullanıyor; sohbet, origin kotasından bilinçli olarak
   küçük ve sınırlı bir dilim alır. */
const MAX_MESSAGES = 60
const MAX_TEXT_CHARS = 12_000
const MAX_PAYLOAD_CHARS = 300_000

/** Yazma gecikmesi (trailing edge) — yanıt token token akıyor ve her token
 *  aksi hâlde ana iş parçacığında tüm dökümün JSON.stringify + localStorage
 *  yazımı demek olurdu. */
const SAVE_DEBOUNCE_MS = 800

function storageKey(agentId) {
  return STORAGE_PREFIX + (agentId || "default")
}

/**
 * Oturum açmış kullanıcı için sabit anahtar. MSAL hesabından türetilir, böylece
 * aynı tarayıcıda oturum açan ikinci kişi başkasının dökümünü devralmaz.
 * `localAccountId` (dizin nesne kimliği) gizli olmayan bir GUID'dir — depoya
 * hiçbir token materyali yazılmaz.
 *
 * MSAL yapılandırılmamışsa (mock / geliştirme oturumu) sabit bir anahtara
 * düşeriz: orada zaten ayırt edilecek bir kimlik yok ve kalıcılığı tümden
 * kapatmak geliştirmede sohbeti her yenilemede sıfırlardı.
 */
export function currentUserKey() {
  try {
    const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
    return account?.localAccountId || account?.homeAccountId || account?.username || "anon"
  } catch {
    return "anon"
  }
}

/* ─── Okuma ─────────────────────────────────────────────────────────────── */

/**
 * `agentId` için snapshot'ı geri getirir, kullanılabilir bir şey yoksa null.
 *
 * Reddettiğini siler: yanlış kullanıcıya ait, yanlış sürümlü ya da süresi
 * dolmuş bir payload'ın gelecekteki değeri yoktur ve bırakmak bir kullanıcının
 * konuşmasını ortak makinede okunabilir tutar.
 */
export function loadChatSession(agentId) {
  purgeLegacy()
  if (typeof window === "undefined" || !agentId) return null
  let raw
  try {
    raw = window.localStorage.getItem(storageKey(agentId))
  } catch {
    return null // depo kapalı (gizli sekme / politika) — durumsuz çalış
  }
  if (!raw) return null

  const userKey = currentUserKey()
  try {
    const parsed = JSON.parse(raw)
    const valid =
      parsed?.v === SCHEMA_VERSION &&
      parsed.userKey === userKey &&
      Array.isArray(parsed.messages) &&
      typeof parsed.updatedAt === "number"
    if (!valid || Date.now() - parsed.updatedAt > CHAT_SESSION_TTL_MS) {
      clearChatSession(agentId)
      return null
    }
    const messages = parsed.messages.filter(isRenderableMessage).map(rehydrate)
    if (messages.length === 0) {
      clearChatSession(agentId)
      return null
    }
    return {
      conversationId: parsed.conversationId ?? null,
      messages,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    clearChatSession(agentId)
    return null
  }
}

function isRenderableMessage(m) {
  return (
    !!m &&
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  )
}

/** Depodaki epoch damgasını ChatMessage'ın beklediği Date'e çevirir. */
function rehydrate(m) {
  return { ...m, time: m.at ? new Date(m.at) : new Date() }
}

/* ─── Yazma ─────────────────────────────────────────────────────────────── */

let pendingTimer = null
let pendingWrite = null
let flushHookInstalled = false

/**
 * Bir kayıt sıraya alır. {@link SAVE_DEBOUNCE_MS} içindeki tekrar çağrılar tek
 * yazmaya iner; `pagehide` boşaltması ise debounce hâlâ beklerken bile son
 * durumun diske ulaşmasını garanti eder — ki bu tam olarak önemli olan an,
 * çünkü sekme kapanıyordur.
 */
export function scheduleChatSessionSave(agentId, snapshot) {
  if (typeof window === "undefined" || !agentId) return
  pendingWrite = { agentId, snapshot }
  installFlushHook()
  if (pendingTimer !== null) return
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null
    flushChatSessionSave()
  }, SAVE_DEBOUNCE_MS)
}

/** Sırada bekleyen snapshot'ı hemen yaz. */
export function flushChatSessionSave() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
  const queued = pendingWrite
  pendingWrite = null
  if (!queued) return
  writeSnapshot(queued.agentId, queued.snapshot)
}

function installFlushHook() {
  if (flushHookInstalled || typeof window === "undefined") return
  flushHookInstalled = true
  // `beforeunload` değil `pagehide`: mobilde sekme değiştirmede ve sayfa
  // önbelleğinden atılmada da tetiklenir, `beforeunload` tetiklenmez.
  window.addEventListener("pagehide", flushChatSessionSave)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushChatSessionSave()
  })
}

function writeSnapshot(agentId, snapshot) {
  let messages = sanitizeMessages(snapshot.messages)
  if (messages.length === 0) {
    clearChatSession(agentId)
    return
  }

  // TTL saati en yeni MESAJ, en yeni yazma değil. Aksi hâlde uygulamayı açmak
  // pencereyi uzatır ve bir haftalık konuşma dünkü gibi geri gelebilirdi.
  const updatedAt =
    messages.reduce((newest, m) => (m.at && m.at > newest ? m.at : newest), 0) || Date.now()

  // Payload sığana kadar en eskiden başlayarak kırp; sonra kota hatası bir kez
  // daha kırpsın — origin'in kalan alanı diğer önbelleklere bağlı olduğu için
  // sabit bir bütçe tek başına yazmanın gerçekleşeceğini garanti edemez.
  for (let attempt = 0; attempt < 4; attempt++) {
    const payload = {
      v: SCHEMA_VERSION,
      userKey: currentUserKey(),
      agentId,
      conversationId: snapshot.conversationId ?? null,
      messages,
      updatedAt,
    }
    let serialized
    try {
      serialized = JSON.stringify(payload)
    } catch {
      return // serileştirilemeyen snapshot — yapılacak makul bir şey kalmadı
    }
    if (serialized.length > MAX_PAYLOAD_CHARS && messages.length > 2) {
      messages = messages.slice(Math.ceil(messages.length / 2))
      continue
    }
    try {
      window.localStorage.setItem(storageKey(agentId), serialized)
      return
    } catch {
      if (messages.length <= 2) return // yer yok — kaydı sessizce düşür
      messages = messages.slice(Math.ceil(messages.length / 2))
    }
  }
}

/**
 * Dökümü yeniden yüklemeye değer olana indirger.
 *
 * `time` (Date) epoch `at`'e çevrilir; base64 data-URI'ler atılır — tek bir
 * gömülü PDF depo bütçesini kendi başına patlatır. Adaptive Card içerikleri
 * KALIR: menü kartları tyro'da gezinmenin kendisi, onlarsız geri gelen döküm
 * yarım olur.
 */
function sanitizeMessages(messages) {
  const recent = (messages || []).slice(-MAX_MESSAGES)
  const out = []
  for (const m of recent) {
    const content = m.content ?? ""
    const attachments = slimAttachments(m.attachments)
    const suggested = m.suggestedActions || []
    // İçeriği olmayan baloncuk saf UI gürültüsü — yalnızca "yarıda kesildi"
    // işaretlisi anlam taşır (Tekrar dene için).
    if (!content && !attachments.length && !suggested.length && !m.incomplete) continue
    const at = m.at ?? (m.time ? new Date(m.time).getTime() : Date.now())
    out.push({
      id: m.id,
      role: m.role,
      ...(m.agent ? { agent: m.agent } : {}),
      content: content.length > MAX_TEXT_CHARS ? `${content.slice(0, MAX_TEXT_CHARS)}…` : content,
      ...(attachments.length ? { attachments } : {}),
      ...(suggested.length ? { suggestedActions: suggested } : {}),
      ...(m.incomplete ? { incomplete: true, ...(m.retry ? { retry: m.retry } : {}) } : {}),
      at: Number.isFinite(at) ? at : Date.now(),
    })
  }
  return out
}

/** data-URI taşıyan eklentilerden yalnızca görüntüleme metasını bırakır. */
function slimAttachments(attachments) {
  return (attachments || []).map((att) => {
    if (typeof att?.contentUrl === "string" && att.contentUrl.startsWith("data:")) {
      const { contentUrl, ...rest } = att // eslint-disable-line no-unused-vars
      return rest
    }
    return att
  })
}

/* ─── Temizleme ─────────────────────────────────────────────────────────── */

/** Saklanan konuşmayı düşür — başlıktaki "yeni sohbet" ve
 *  {@link loadChatSession} içindeki her reddetme yolu. */
export function clearChatSession(agentId) {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
  pendingWrite = null
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(agentId))
  } catch {
    /* depo kapalı — temizlenecek bir şey yok */
  }
}

let legacyPurged = false

/** Sekme-ömürlü eski kayıtları at. Bir kez, ilk okumada. */
function purgeLegacy() {
  if (legacyPurged || typeof window === "undefined") return
  legacyPurged = true
  try {
    const doomed = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k?.startsWith(LEGACY_PREFIX)) doomed.push(k)
    }
    for (const k of doomed) window.sessionStorage.removeItem(k)
  } catch {
    /* depo kapalı */
  }
}
