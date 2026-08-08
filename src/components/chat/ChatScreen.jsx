import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon, ArrowDown01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"
import { ChatComposer } from "./ChatComposer"
import { ChatMessage } from "./ChatMessage"
import { QuickChips } from "./QuickChips"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMe } from "@/hooks/useMe"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import { loadChatSession, scheduleChatSessionSave, clearChatSession } from "@/lib/chatSession"
import { useAnswerNotification } from "@/hooks/useAnswerNotification"
import { onOpenChat, requestFocusComposer } from "@/lib/chatBus"
import { FirstReplyCard } from "@/components/chat/FirstReplyCard"
import { NotifyOptIn } from "@/components/chat/NotifyOptIn"
import { startConversation, resumeConversation, sendMessage, sendAction, resolveSuggestedAction, filesToAttachments, readConversationId } from "@/lib/copilot"
import { bcp47 } from "@/lib/intl-cache"
import { cn } from "@/lib/utils"

function extractSubmitActions(items) {
  if (!Array.isArray(items)) return []
  const actions = []
  for (const item of items) {
    if (item.type === "ActionSet" && item.actions) actions.push(...item.actions.filter((a) => a.type === "Action.Submit"))
    if (item.body) actions.push(...extractSubmitActions(item.body))
    if (item.columns) for (const col of item.columns) actions.push(...extractSubmitActions(col.items || []))
    if (item.items) actions.push(...extractSubmitActions(item.items))
  }
  return actions
}

// ── Work IQ (ve benzeri) bağlantı onay kartları ──────────────────────────
// Bot, bir MCP bağlantısı için izin isterken `name:"connectors/consentCard"`
// taşıyan bir adaptive card gönderir; içinde ActionSet'te data.action "Allow"
// / "Cancel" olan iki Action.Submit bulunur. Kartlar SIRAYLA gelir (birine
// Allow → sonraki açılır). Bunları yakalayıp kullanıcıya TEK özet kutuda onay
// sorup, "Evet" derse gelen tüm kartları otomatik "Allow"larız.

// attachments içinde bir consent adaptive-card varsa content'ini döndürür.
function findConsentCard(attachments) {
  for (const a of attachments || []) {
    if (a?.contentType !== "application/vnd.microsoft.card.adaptive") continue
    const actions = extractSubmitActions(a.content?.body || [])
    if (actions.some((x) => x?.data?.action === "Allow" || x?.data?.actionSubmitId === "Allow")) {
      return a.content
    }
  }
  return null
}

// Karttaki "Allow" / "Cancel" Action.Submit'inin data payload'unu döndürür
// (bota bu value ile message atınca butona basılmış gibi olur).
function consentActionData(cardContent, which) {
  const actions = extractSubmitActions(cardContent?.body || [])
  const a = actions.find((x) => x?.data?.action === which || x?.data?.actionSubmitId === which)
  return a?.data ?? {}
}

// Kart gövdesinden okunur bir bağlantı adı çıkarır ("Work IQ Mail MCP" gibi
// koyu başlık; yoksa "- Work IQ … (Preview)" satırı).
function consentName(cardContent) {
  const texts = []
  const walk = (items) => {
    for (const it of items || []) {
      if (it?.type === "TextBlock" && it.text) texts.push(String(it.text).trim())
      if (it?.body) walk(it.body)
      if (it?.columns) for (const c of it.columns) walk(c.items || [])
      if (it?.items) walk(it.items)
    }
  }
  walk(cardContent?.body || [])
  const mcp = texts.find((x) => /MCP\b/i.test(x))
  const line = texts.find((x) => /^-\s/.test(x))
  return mcp || (line ? line.replace(/^-\s*/, "").trim() : "Work IQ bağlantısı")
}

/**
 * Geri getirilen dökümün başına düşen ince ayraç.
 *
 * Kalıcılık olmadan ekrandaki her satır bu ziyarette söylenmişti. Artık dünkü
 * bir yanıt en üstte duruyor olabilir — damgasız bırakmak onu az önce gelmiş
 * gibi okutur, ki mesajlaşma uygulamalarının gün başlıkları tam da bunun için
 * var.
 */
function EarlierConversationDivider({ at }) {
  const { t, locale } = useLocale()
  const stamp = (() => {
    if (!at) return null
    const date = at instanceof Date ? at : new Date(at)
    if (Number.isNaN(date.getTime())) return null
    const tag = bcp47(locale)
    const time = date.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })
    const isToday = new Date().toDateString() === date.toDateString()
    if (isToday) return `${t("chat.session.today", "Bugün")} ${time}`
    return `${date.toLocaleDateString(tag, { day: "numeric", month: "short" })} ${time}`
  })()

  return (
    <div className="flex items-center gap-2.5 px-1 pb-1" role="separator">
      <span className="h-px flex-1 bg-border/60" />
      <span className="whitespace-nowrap text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {t("chat.session.earlier", "Önceki konuşma")}
        {stamp ? ` · ${stamp}` : ""}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  )
}

function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "chat.greeting.morning"
  if (hour >= 12 && hour < 18) return "chat.greeting.afternoon"
  if (hour >= 18 && hour < 22) return "chat.greeting.evening"
  return "chat.greeting.night"
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now()) + Math.random().toString(36).slice(2, 8)
}

// Distance from the bottom (in px) below which we treat the user as "pinned
// to the latest" and auto-scroll on new messages. Above the threshold we
// show a floating "↓ N new" pill instead. 120 px is the value ChatGPT /
// Claude / Gemini all converge on.
const NEAR_BOTTOM_THRESHOLD_PX = 120

// "Asistan yeni uyandı" kartının ekranda kalma süresi. 5 sn kısa geliyordu:
// kullanıcı mesajı gönderdikten sonra gözü kendi baloncuğunda oluyor, karta
// ancak bir saniye sonra bakıyor — 7 sn okumak için gerçek bir pay bırakıyor.
const FIRST_REPLY_NOTICE_MS = 7000

// Empty-state welcome reveal — matches the dashboard hero (AppLauncher.jsx)
// so the app speaks in one motion vocabulary. Each word fades + rises +
// un-blurs in sequence under a small parent-driven stagger.
const wordVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}
const greetingLineVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } },
}
const subtitleLineVariants = {
  hidden: {},
  // Subtitle starts after the greeting line is largely revealed so it
  // feels like one continuous wave instead of two parallel runs.
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.95 } },
}

/**
 * @param onScreen - false while the user is on another route. The component
 *   stays MOUNTED either way (App.jsx keeps it alive so a slow answer isn't
 *   killed by navigating to the dashboard); this only says whether the user
 *   can currently see it, which is what decides whether a finished answer
 *   needs announcing.
 */
export function ChatScreen({ onReset, initialAgent, onScreen = true }) {
  const { t, locale } = useLocale()
  const { agents, getAgent } = useConfig()
  const isMobile = useIsMobile()
  const defaultAgentId = agents[0]?.id ?? null
  const [agent, setAgent] = useState(initialAgent || defaultAgentId)
  // Konuşmayı bırakıldığı yerden getir — kapanan sekme, sayfa yenileme ve
  // ikinci bir sekme boyunca, son mesajdan itibaren 24 saat (bkz. chatSession.js).
  // İlk render'da okunur; agent değişiminde init effect'i o agent'ın kendi
  // snapshot'ını yükler. `?reset=` URL parametresi bu bileşeni (key ile)
  // remount ettiği için orada tasarım gereği temiz bir başlangıç alırız.
  const [restored] = useState(() => loadChatSession(initialAgent || defaultAgentId))
  const [messages, setMessages] = useState(() => restored?.messages ?? [])
  // Ekrandaki satırların kaçı depodan geri geldi — bundan sonrası bu ziyarette
  // söylendi. Geri gelen baloncukların canlı bir yanıt gibi okunmasını
  // engelleyen tek seferlik ayracı besler.
  const [restoredCount, setRestoredCount] = useState(() => restored?.messages.length ?? 0)
  const [orbState, setOrbState] = useState("idle")
  // Composer'ı yalnızca bot GERÇEKTEN yanıt üretirken kilitler. orbState
  // "thinking" kullanıcı yazarken de tetiklendiği için (kozmetik orb), Enter'ı
  // ona bağlamak yazma sonrası gereksiz bekleme yaratıyordu — bunun yerine busy.
  const [busy, setBusy] = useState(false)
  // Header "yeni sohbet" butonu bunu artırır → init effect yeniden çalışır
  // (Copilot konuşmasını SIFIRDAN başlatır + greeting'i tekrar getirir).
  // Sidebar "Yeni sohbet" tüm komponenti remount ettiği için ayrı; bu, aynı
  // mount içindeki sıfırlama için.
  const [resetNonce, setResetNonce] = useState(0)
  // Aktif agent + schema adı render'da hesaplanır. schemaName init effect'in
  // bağımlılığıdır: agents (ConfigProvider) ASENKRON yüklenir; agent zaten HR
  // olsa bile ilk render'da getAgent() undefined dönebilir → init erken çıkar.
  // schemaName deps'te olduğu için agents yüklenince init kendiliğinden çalışır.
  const activeAgent = getAgent(agent)
  const schemaName = activeAgent?.agentId
  const [input, setInput] = useState("")
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const { isSpeaking: ttsSpeaking, speak, cancel: cancelTts } = useSpeechSynthesis()
  // Debounce timer for typing → thinking → idle transitions.
  const typingTimerRef = useRef(null)
  const copilotClientRef = useRef(null)
  // Şu an oynayan Copilot Studio konuşması. Dökümle birlikte saklanır ki bir
  // sonraki ziyaret yalnızca baloncukları yeniden çizmesin, AJANIN bağlamını
  // da devam ettirsin.
  const conversationIdRef = useRef(restored?.conversationId ?? null)
  // Kimlik bir ref'te yaşıyor (akışlar onu React dışından okuyor); ref tek
  // başına yeni kurulan bir konuşmanın bir sonraki mesaja kadar kaydedilmemesi
  // demek olurdu — o da bir sonraki ziyaretin ölü olduğunu bildiğimiz bir
  // kimliği denemesi. Bu sayaç, kimlik değişince kayıt effect'ini tetikler.
  const [conversationTick, setConversationTick] = useState(0)
  // Bu tur saklanan bir konuşmanın üstüne mi bindi? Kimliğin sunucudaki ömrü
  // belgelenmemiş: sabah devam ettirilebilen bir konuşma öğleden sonra ölmüş
  // olabilir. Ölü kimliği elimizde tutarsak sonraki HER soru aynı şekilde
  // düşer ve tek çıkış "yeni sohbet" olurdu — bu ikisi tek seferlik kurtarmayı
  // yönetiyor (bkz. recoverFromDeadConversation).
  const resumedRef = useRef(false)
  const recoveringRef = useRef(false)
  const abortGenRef = useRef(0)
  // "İlk yanıt yavaş olabilir" bildirimi bu konuşmada gösterildi mi? Konuşma
  // her sıfırdan başladığında (agent değişimi / yeni sohbet / reload) init
  // içinde false'a döner, çünkü Copilot konuşması da o anda yeniden kurulur —
  // yani yavaş ilk tur yeniden yaşanır.
  const firstReplyNoticeRef = useRef(false)
  const firstReplyTimerRef = useRef(null)
  // Kartın konum çıpası: çizgiyi taşıyan başlık elemanı.
  const headerRef = useRef(null)
  const [firstReplyNotice, setFirstReplyNotice] = useState(false)
  // Konuşma hazır-kapısı: init akışı (startConversation + greeting auto-submit)
  // TAMAMEN bitene kadar resolve OLMAZ. handleSend bunu bekleyerek aynı sunucu
  // konuşmasına ikinci bir turun çakışmasını (→ "Sohbet durduruldu") önler.
  const conversationReadyRef = useRef(Promise.resolve())
  // Scroll-trap state — auto-scroll only when isNearBottom; otherwise count
  // unseen messages and surface a pill.
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef(null)
  // ── Work IQ bağlantı onayı ──────────────────────────────────────────────
  // consentPrompt: ilk consent kartı gelince açılan özet-onay kutusu
  //   ({ name, card, gen } | null). consentWait: otomatik onaylanırken
  //   gösterilen "izinler tamamlanıyor" overlay'i. autoConsentRef: bu
  //   konuşmadaki karar — null (sorulmadı) / true (hepsine izin) / false (ret).
  const [consentPrompt, setConsentPrompt] = useState(null)
  const [consentWait, setConsentWait] = useState(false)
  const autoConsentRef = useRef(null)
  const greetHour = new Date().getHours()
  const me = useMe()
  const firstName = me.name || ""
  // Announces a finished answer when the user isn't looking at it — see
  // useAnswerNotification for the channel-selection table.
  const notifier = useAnswerNotification(onScreen)

  // Speaking-mode level oscillation for the orb.
  useEffect(() => {
    if (orbState !== "speaking") return
    const id = setInterval(() => {
      setSpeakingLevel(0.22 + Math.random() * 0.78)
    }, 95)
    return () => clearInterval(id)
  }, [orbState])

  const effectiveLevel = orbState === "speaking" ? speakingLevel : 0

  // Dökümü + devam ettirilecek konuşmayı sakla. Her mesaj değişiminde çalışır,
  // böylece geri gezinme (hatta kenar çubuğuyla gezinme) taze bir ChatScreen'i
  // aynı konuşmayla doldurur — ve sekme kapansa bile 24 saat boyunca öyle kalır.
  useEffect(() => {
    scheduleChatSessionSave(agent, {
      conversationId: conversationIdRef.current,
      messages,
    })
  }, [messages, agent, conversationTick])

  // isNearBottom'u ref'te de tut: ResizeObserver geri-çağrısı bunu yeniden
  // abone olmadan okuyabilsin.
  const isNearBottomRef = useRef(true)
  useEffect(() => {
    isNearBottomRef.current = isNearBottom
  }, [isNearBottom])

  // İçerik yüksekliği değiştikçe (Adaptive Card'lar DOM'a ASENKRON eklenir,
  // "yazıyor" → metin geçişi yüksekliği büyütür) dibe sabit kal. Tek seferlik
  // messages-effect scroll'u kart render'ından önce çalıştığı için yetmiyordu.
  //
  // KRİTİK: content node'u sabit `[]` bağımlılıklı bir effect ile DEĞİL,
  // CALLBACK ref ile gözlüyoruz. Boş-durum (orb karşılama) ekranında scroller
  // ve content DOM'da YOK; greeting + menü kartı gelip isEmpty false olunca
  // chat layout MOUNT olur. `[]` effect yalnızca ilk mount'ta (o an refler
  // null iken) çalıştığı için ResizeObserver hiç kurulmuyordu → ilk konuşmada
  // asenkron büyüyen Adaptive Card'lar dibe çekmiyordu (özellikle mobil/PWA'da
  // kart viewport'tan uzun olunca dibi composer'ın altında kalıyordu). Callback
  // ref node tam mount olunca tetiklenir ve her reset→boş→dolu döngüsünde
  // observer'ı yeniden bağlar.
  const contentRef = useRef(null)
  const resizeObsRef = useRef(null)
  const attachContentRef = useCallback((node) => {
    contentRef.current = node
    if (resizeObsRef.current) {
      resizeObsRef.current.disconnect()
      resizeObsRef.current = null
    }
    if (node && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        // scroller'ı tembel oku: callback ref child (content) parent
        // (scroller) ref'inden ÖNCE bağlanabilir; RO ateşlendiğinde ikisi de hazır.
        const scroller = scrollRef.current
        if (scroller && isNearBottomRef.current) scroller.scrollTop = scroller.scrollHeight
      })
      ro.observe(node)
      resizeObsRef.current = ro
    }
  }, [])

  // Auto-scroll trap: snap to bottom if the user was already near it; else
  // surface a "new message" pill. We track everything in refs to avoid
  // setState inside a layout effect (cascading-render risk). The pill's
  // displayed count is derived from messages.length - lastSeenLengthRef.
  const lastSeenLengthRef = useRef(messages.length)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
      lastSeenLengthRef.current = messages.length
      if (unread !== 0) setUnread(0) // eslint-disable-line react-hooks/set-state-in-effect
    } else if (messages.length > 0) {
      const last = messages[messages.length - 1]
      // Don't count user's own message as "unread" — the user just sent it.
      if (last?.role !== "user") {
        const next = messages.length - lastSeenLengthRef.current
        if (next !== unread) setUnread(next) // eslint-disable-line react-hooks/set-state-in-effect
      } else {
        lastSeenLengthRef.current = messages.length
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Sohbet yeniden ekrana gelince (başka sayfadan dönüş / bildirime tıklama)
  // en alta çek: yokken gelen yanıt listenin dibindedir ve gizliyken (display:
  // none) scrollHeight 0 olduğu için otomatik kaydırma iş görmez.
  useEffect(() => {
    if (!onScreen) return
    const el = scrollRef.current
    if (!el || !isNearBottomRef.current) return
    // İki kare bekle: display:none → contents geçişinde layout ilk karede
    // henüz ölçülmemiş oluyor.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = scrollRef.current
        if (node) node.scrollTop = node.scrollHeight
      })
    })
    return () => cancelAnimationFrame(id)
  }, [onScreen])

  // Bildirim/toast "Görüntüle" → sohbet açılır; kullanıcı yukarı kaydırmış
  // olsa bile yeni yanıta indir.
  useEffect(() => {
    return onOpenChat(({ focusComposer } = {}) => {
      setIsNearBottom(true)
      isNearBottomRef.current = true
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
        // Bildirimdeki "Yanıtla" → kullanıcı yazmak istiyor; imleci hazırla.
        // Bir kare sonra, sohbet görünür hâle geldikten sonra iste.
        if (focusComposer) requestAnimationFrame(requestFocusComposer)
      })
    })
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const near = distance < NEAR_BOTTOM_THRESHOLD_PX
    setIsNearBottom(near)
    if (near) {
      setUnread(0)
      lastSeenLengthRef.current = messages.length
    }
  }

  function scrollToBottom() {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    setUnread(0)
    setIsNearBottom(true)
    lastSeenLengthRef.current = messages.length
  }

  // Orb click → speak the greeting line (the static text under the orb,
  // with the user's name woven in) in the current locale. While speaking,
  // an effect below forces orb into "speaking" mode. Click again to cancel.
  // No-op while the mic is listening (Web Speech in & out collide on iOS).
  function handleOrbClick() {
    if (orbState === "listening") return
    if (ttsSpeaking) {
      cancelTts()
      return
    }
    const greeting = t(greetingKey(greetHour))
    const lead = t("chat.subtitle.lead")
    const highlight = t("chat.subtitle.highlight")
    const fullText = `${greeting}, ${firstName}. ${lead} ${highlight}`
    const lang = bcp47(locale)
    // rate 1.1 — slightly faster than default (1.0) so the greeting sounds
    // brisk and confident instead of plodding. Cloud / neural voices handle
    // it cleanly; if the user is on a slow bundled OS voice the engine will
    // still keep up — most older voices clip more at low rates than high.
    speak(fullText, { lang, rate: 1.1 })
  }

  // The composer drives the recognizer; we only need to mirror its boolean
  // listening flag into orbState. Listening always wins over any other mode.
  function handleMicToggle(nextListening) {
    if (nextListening) setOrbState("listening")
    else setOrbState((s) => (s === "listening" ? "idle" : s))
  }

  function handleChip(prefix) {
    setInput((v) => prefix + v.replace(/^([^:]+:\s*)/, ""))
  }

  // User-typing → "thinking" with a 600 ms idle debounce. Mic listening and
  // TTS speaking both outrank typing — don't flap them.
  function handleInputChange(next) {
    setInput(next)
    if (orbState === "listening" || orbState === "speaking" || ttsSpeaking) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (next.trim()) {
      if (orbState !== "thinking") setOrbState("thinking")
      typingTimerRef.current = setTimeout(() => {
        setOrbState((s) => (s === "thinking" ? "idle" : s))
      }, 600)
    } else {
      setOrbState((s) => (s === "thinking" ? "idle" : s))
    }
  }

  // Force orb into "speaking" while the TTS engine is playing the greeting,
  // revert to "idle" when it finishes (unless something else has claimed
  // the orb in the meantime). This is a legitimate external-signal-to-state
  // mirror (the speechSynthesis engine fires onstart/onend through the hook
  // and we need to reflect that in the orb's visual mode).
  useEffect(() => {
    if (ttsSpeaking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrbState("speaking")
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrbState((s) => (s === "speaking" ? "idle" : s))
    }
  }, [ttsSpeaking])

  // Tear down the typing debounce + first-reply notice timer on unmount.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (firstReplyTimerRef.current) clearTimeout(firstReplyTimerRef.current)
    }
  }, [])

  // Agent değişince (veya ilk yüklemede) Copilot konuşmasını başlat ve selamlamayı göster.
  // Bu sayede kullanıcı ilk mesajını gönderdiğinde bot zaten hazır olur.
  useEffect(() => {
    if (!schemaName || schemaName === "agent-id") return

    copilotClientRef.current = null
    const gen = ++abortGenRef.current
    // Yeni bir hazır-kapısı kur; init tamamen bitince (finally) resolve edilir.
    let resolveReady
    conversationReadyRef.current = new Promise((r) => { resolveReady = r })

    async function initConversation() {
      const greetingId = makeId()
      // Yeni konuşmada Work IQ onay kararını ve overlay'leri sıfırla.
      autoConsentRef.current = null
      firstReplyNoticeRef.current = false
      if (firstReplyTimerRef.current) clearTimeout(firstReplyTimerRef.current)
      setFirstReplyNotice(false)
      setConsentPrompt(null)
      setConsentWait(false)
      // Init (greeting + auto-submit) boyunca composer'ı KİLİTLE. Aksi halde
      // kullanıcı network beklerken yazıp gönderebiliyor ve init'in yanıtı onun
      // mesajından sonra listeye eklenip "sanki bu cevap geldi" karmaşası yaratıyor.
      setBusy(true)
      setOrbState("thinking")

      // Bu agent'ın son 24 saatteki dökümü. Agent DEĞİŞİMİNDE de okunur:
      // ilk render'daki hidrasyon yalnızca açılış agent'ını kapsar, her
      // agent kendi konuşmasını taşır.
      const saved = loadChatSession(agent)
      const hadPriorSession = !!saved?.messages.length
      // Ölü konuşmadan kurtarma turu: kimliği YOK SAY (yoksa aynı ölü konuşmaya
      // geri bağlanır ve sonraki her soru da düşer) ve ekrandaki mesajlara
      // DOKUNMA — depodaki snapshot debounce yüzünden az önceki soruyu ve hata
      // baloncuğunu henüz içermeyebilir, onları geri yazmak kullanıcının
      // gözünün önünde satır silmek olurdu.
      const recovering = recoveringRef.current
      recoveringRef.current = false
      const resumeId = recovering ? null : (saved?.conversationId ?? null)
      conversationIdRef.current = resumeId
      setConversationTick((n) => n + 1)
      if (recovering) {
        // ekrandaki döküm olduğu gibi kalır
      } else if (hadPriorSession) {
        setRestoredCount(saved.messages.length)
        setMessages(saved.messages)
      } else {
        setRestoredCount(0)
        // Sıfırdan başlıyoruz: eski (ölü) mesajları temizle ve tek bir
        // selamlama baloncuğu göster — yığılmayı önler.
        setMessages([{ id: greetingId, role: "assistant", agent, content: "", attachments: [], time: new Date() }])
      }

      let greetingText = ""
      let greetingAttachments = []
      let greetingSuggested = []
      let copilotClient = null
      try {
        // Önce kaldığı yerden devam etmeyi dene. Başarılıysa ajan dünkü
        // konuşmayı hatırlar; selamlama da otomatik menü turu da atlanır —
        // ikisi de var olan bir dökümün altına ikinci bir "merhaba" basardı.
        let resumed = false
        if (resumeId) {
          try {
            copilotClient = await resumeConversation(schemaName, resumeId)
            if (abortGenRef.current !== gen) return
            copilotClientRef.current = { client: copilotClient, agentId: agent }
            resumed = true
          } catch (err) {
            // Bağlanmanın kendisi ağ isteği yapmıyor; buraya ancak token
            // alınamazsa düşeriz. Kimliği düşür, aşağıda sıfırdan kur.
            console.debug("Copilot resume failed, starting fresh:", err)
            conversationIdRef.current = null
            setConversationTick((n) => n + 1)
          }
          if (abortGenRef.current !== gen) return
        }
        resumedRef.current = resumed

        // Devam ettirilemedi → yeni konuşma. Döküm geri geldiyse selamlamayı
        // GÖSTERME: kullanıcı geçmişini görüyor, altına bir karşılama mesajı
        // düşmek onu canlı bir yanıt gibi okuturdu. Handshake yine de tüketilir.
        const showGreeting = !hadPriorSession && !recovering
        if (!resumed) {
          for await (const chunk of startConversation(schemaName)) {
            if (abortGenRef.current !== gen) return
            if (chunk.done) {
              copilotClient = chunk.client
              copilotClientRef.current = { client: copilotClient, agentId: agent }
              conversationIdRef.current = chunk.conversationId ?? readConversationId(copilotClient)
              setConversationTick((n) => n + 1)
              break
            }
            // Geçici "Processing…"/informative güncellemesini selamlamaya basma.
            if (chunk.transient) continue
            greetingText = chunk.text
            greetingAttachments = chunk.attachments || []
            greetingSuggested = chunk.suggestedActions || []
            if (!showGreeting) continue
            setMessages((m) => m.map((msg) => msg.id === greetingId ? { ...msg, content: greetingText, attachments: greetingAttachments, suggestedActions: greetingSuggested } : msg))
          }
          if (abortGenRef.current !== gen) return
          if (showGreeting && !greetingText && !greetingAttachments.length && !greetingSuggested.length) {
            setMessages((m) => m.filter((msg) => msg.id !== greetingId))
          }
        }

        // Selamlama kartındaki ilk Action.Submit'i otomatik gönder ve YANITI
        // GÖRÜNÜR yap (menüyü göster). Bu tur init'in içinde, kullanıcı turundan
        // ÖNCE bitmeli — handleSend hazır-kapısını beklediği için çakışmaz.
        if (showGreeting && !resumed && copilotClient && greetingAttachments.length) {
          const firstCard = greetingAttachments.find((a) => a.contentType === "application/vnd.microsoft.card.adaptive")
          if (firstCard?.content) {
            const actions = extractSubmitActions(firstCard.content.body || [])
            const firstAction = actions.find((a) => a.style === "positive") || actions[0]
            if (firstAction) {
              await streamReply(sendAction(copilotClient, firstAction.data ?? {}), gen)
            }
          }
        }
      } catch (err) {
        console.error("Copilot init error:", err)
      } finally {
        // Init ne olursa olsun (başarı / abort / hata) kapıyı aç ki handleSend
        // sonsuza kadar beklemesin. Yalnızca hâlâ güncel tur isek composer'ı aç.
        resolveReady()
        if (abortGenRef.current === gen) {
          setBusy(false)
          setOrbState((s) => (s === "thinking" ? "idle" : s))
        }
      }
    }

    initConversation()
  // schemaName: agents async yüklenince init'in tetiklenmesi için şart.
  // resetNonce: header "yeni sohbet" ile aynı mount'ta yeniden başlatma.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, schemaName, resetNonce])

  // Bir Copilot generator'ını tüketir, tek bir assistant baloncuğunu
  // streaming boyunca günceller (text + kartlar + suggestedActions).
  // İçerik gelmezse baloncuğu kaldırır. Abort olursa { aborted:true } döner.
  async function streamReply(generator, gen) {
    const replyId = makeId()
    setMessages((m) => [...m, { id: replyId, role: "assistant", agent, content: "", attachments: [], suggestedActions: [], time: new Date() }])
    let fullText = ""
    let fullAttachments = []
    let fullSuggested = []
    // Tamamlanmış "message" aktivitesi gördük mü? Görmeden akış biterse
    // (iOS PWA'da bağlantı kopması) yanıt yarıda kalmış demektir.
    let sawFinal = false
    // Geçici "Processing…"/informative güncellemesi gördük mü? Bunları balona
    // basmıyoruz ama akış SADECE bunları görüp final gelmeden biterse, balonu
    // "yarıda kesildi" sayıp Tekrar dene sunabilmek için izliyoruz.
    let sawTransient = false
    for await (const chunk of generator) {
      if (abortGenRef.current !== gen) return { aborted: true }
      if (chunk.done) break
      // Geçici durum güncellemesi: içeriği balona UYGULAMA — "yazıyor"
      // göstergesi gerçek yanıt gelene kadar kalsın (Teams davranışı).
      if (chunk.transient) { sawTransient = true; continue }
      if (chunk.final) sawFinal = true
      fullText = chunk.text
      fullAttachments = chunk.attachments || []
      fullSuggested = chunk.suggestedActions || []
      setMessages((m) => m.map((msg) => msg.id === replyId ? { ...msg, content: fullText, attachments: fullAttachments, suggestedActions: fullSuggested } : msg))
    }
    const hasContent = Boolean(fullText) || fullAttachments.length > 0 || fullSuggested.length > 0
    // İçerik geldi (ya da yalnızca geçici güncelleme görüldü) ama final mesaj
    // gelmediyse: akış erken kesilmiş.
    const incomplete = (hasContent || sawTransient) && !sawFinal
    // Boş balonu yalnızca eksik DE değilse kaldır (eksikse Tekrar dene için kalsın).
    if (!hasContent && !incomplete) {
      setMessages((m) => m.filter((msg) => msg.id !== replyId))
    }
    return { fullText, fullAttachments, fullSuggested, incomplete, replyId }
  }

  // Akış bittikten sonra ortak son-iş: yarıda kesildiyse baloncuğu "eksik"
  // işaretle (Tekrar dene butonu için retry tarifini sakla), yoksa orb'u
  // kısa süre "speaking"e al. retryDescriptor: { kind:"message", text } veya
  // { kind:"action", actionData } — retryTurn aynı turu yeniden gönderir.
  function finishStream(res, retryDescriptor) {
    // Single funnel for every completed turn — so "tell me when it's done"
    // can't drift between send / suggested-action / card-action / retry.
    // Turns the user didn't start (greeting, auto-submit) were never armed
    // and are ignored inside the notifier.
    notifier.resolveTurn({ answer: res.fullText, failed: !!res.incomplete })
    if (res.incomplete) {
      setMessages((m) => m.map((msg) => (msg.id === res.replyId ? { ...msg, incomplete: true, retry: retryDescriptor } : msg)))
      setOrbState("idle")
    } else {
      setOrbState("speaking")
      setTimeout(() => setOrbState("idle"), 2400)
    }
  }

  // ── Work IQ bağlantı onay akışı ────────────────────────────────────────
  // Bir streamReply sonucu consent kartıysa ele alır. true dönerse çağıran
  // finishStream'i ATLAMALI (akışı biz devraldık).
  async function maybeHandleConsent(res, gen) {
    const card = findConsentCard(res?.fullAttachments)
    if (!card) return false
    // Ham consent baloncuğunu gizle — kendi kutumuz/otomatik akışımız yönetecek.
    if (res.replyId) setMessages((m) => m.filter((msg) => msg.id !== res.replyId))
    const client = copilotClientRef.current?.client
    if (!client) return true
    if (autoConsentRef.current === true) {
      await runConsentLoop(client, card, gen)
    } else if (autoConsentRef.current === false) {
      // Daha önce reddedildi → sessizce iptal et. Sessiz iptal duyurulacak bir
      // yanıt değil; bekleyen turu düşür ki sonraki turun bildirimine karışmasın.
      notifier.cancelTurn()
      await streamReply(sendAction(client, consentActionData(card, "Cancel")), gen)
    } else {
      // Karar verilmedi → özet-onay kutusunu aç (Evet/Hayır kullanıcıdan gelir).
      setConsentPrompt({ name: consentName(card), card, gen })
    }
    return true
  }

  // Onaydan sonra: gelen HER consent kartını otomatik "Allow"lar; consent
  // olmayan nihai yanıt gelince onun baloncuğunu bırakıp döngüyü bitirir.
  async function runConsentLoop(client, firstCard, gen) {
    setConsentWait(true)
    setBusy(true)
    try {
      let card = firstCard
      let lastRes = null
      while (card) {
        const res = await streamReply(sendAction(client, consentActionData(card, "Allow")), gen)
        if (res.aborted) {
          notifier.cancelTurn()
          return
        }
        lastRes = res
        const next = findConsentCard(res.fullAttachments)
        if (next) {
          // Ara consent baloncuğunu gizle, döngüye devam et.
          if (res.replyId) setMessages((m) => m.filter((msg) => msg.id !== res.replyId))
          card = next
        } else {
          card = null // nihai (consent-olmayan) yanıt — baloncuğu bırak
        }
      }
      if (lastRes) finishStream(lastRes, { kind: "action", actionData: {} })
    } finally {
      setConsentWait(false)
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  // Özet kutu: "Evet, hepsine izin ver" → tüm consent kartlarını otomatik onayla.
  async function approveConsent() {
    const p = consentPrompt
    setConsentPrompt(null)
    if (!p) return
    autoConsentRef.current = true
    const client = copilotClientRef.current?.client
    if (client) await runConsentLoop(client, p.card, p.gen)
  }

  // Özet kutu: "Hayır" → bu bağlantıyı iptal et, otomatik onayı kapat.
  async function rejectConsent() {
    const p = consentPrompt
    setConsentPrompt(null)
    if (!p) return
    autoConsentRef.current = false
    const client = copilotClientRef.current?.client
    if (!client) return
    const gen = ++abortGenRef.current
    setBusy(true)
    try {
      const res = await streamReply(sendAction(client, consentActionData(p.card, "Cancel")), gen)
      if (!res.aborted) finishStream(res, { kind: "action", actionData: {} })
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  // "Tekrar dene" → onaylanınca aynı turu yeniden gönderir. Eski yarım
  // baloncuğu kaldırıp temiz bir akış başlatır (tek nihai yanıt kalsın).
  async function handleRetry(message) {
    if (!message?.retry) return
    await conversationReadyRef.current
    const client = copilotClientRef.current?.client
    if (!client) return
    setMessages((m) => m.filter((msg) => msg.id !== message.id))
    setIsNearBottom(true)
    setOrbState("thinking")
    setBusy(true)
    const gen = ++abortGenRef.current
    try {
      const r = message.retry
      const generator =
        r.kind === "action"
          ? sendAction(client, r.actionData ?? {})
          : sendMessage(client, String(r.text ?? ""))
      notifier.armTurn(r.kind === "message" ? r.text : "")
      const res = await streamReply(generator, gen)
      if (res.aborted) {
        notifier.cancelTurn()
        return
      }
      if (await maybeHandleConsent(res, gen)) return
      finishStream(res, r)
    } catch (err) {
      console.error("Retry error:", err)
      notifier.resolveTurn({ failed: true })
      setOrbState("idle")
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  // suggestedActions chip'ine tıklanınca: imBack/messageBack → mesaj gönder,
  // postBack → action gönder, openUrl → yeni sekme.
  async function handleSuggestedAction(action) {
    const { kind, payload } = resolveSuggestedAction(action)
    if (kind === "url") {
      if (payload) window.open(payload, "_blank", "noopener,noreferrer")
      return
    }
    await conversationReadyRef.current
    const client = copilotClientRef.current?.client
    if (!client) return
    // Kullanıcının seçimini kendi baloncuğu olarak göster
    setIsNearBottom(true)
    setMessages((m) => [...m, { id: makeId(), role: "user", content: action.title, time: new Date() }])
    setOrbState("thinking")
    setBusy(true)
    const gen = ++abortGenRef.current
    try {
      const actionData = typeof payload === "object" ? payload : { value: payload }
      const generator = kind === "action"
        ? sendAction(client, actionData)
        : sendMessage(client, String(payload))
      notifier.armTurn(action.title)
      const res = await streamReply(generator, gen)
      if (res.aborted) {
        notifier.cancelTurn()
        return
      }
      if (await maybeHandleConsent(res, gen)) return
      finishStream(res, kind === "action" ? { kind: "action", actionData } : { kind: "message", text: String(payload) })
    } catch (err) {
      console.error("Suggested action error:", err)
      notifier.resolveTurn({ failed: true })
      setOrbState("idle")
      recoverFromDeadConversation()
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  async function handleSend(picked = []) {
    const text = input.trim()
    if (!text && picked.length === 0) return

    // Baloncukta YALNIZCA görüntüleme metası tutulur (ad/boyut/tip). base64
    // data-URI'leri buraya koymuyoruz: mesajlar chatSession ile localStorage'a
    // mirror'lanıyor ve büyük dosyalar quota'yı patlatır.
    const displayAttachments = picked.map((a) => ({
      name: a.name,
      size: a.size,
      contentType: a.type,
    }))
    const userMsg = { id: makeId(), role: "user", content: text, attachments: displayAttachments, time: new Date() }
    setIsNearBottom(true)
    setMessages((m) => [...m, userMsg])
    setInput("")
    setOrbState("thinking")
    setBusy(true)

    // Sohbetin İLK kullanıcı mesajı: Copilot konuşması bu tur sırasında
    // kuruluyor, yani ilk yanıt sonrakilerden belirgin şekilde yavaş geliyor ve
    // kullanıcı tarafında "takıldı" gibi görünüyor. Bir kez, kendiliğinden
    // kapanan bir bildirimle söylüyoruz. Agent'ı yapılandırılmamış (mock)
    // sohbette gerek yok — orada yanıt zaten anında geliyor.
    if (!firstReplyNoticeRef.current && schemaName && schemaName !== "agent-id") {
      firstReplyNoticeRef.current = true
      setFirstReplyNotice(true)
      if (firstReplyTimerRef.current) clearTimeout(firstReplyTimerRef.current)
      firstReplyTimerRef.current = setTimeout(() => setFirstReplyNotice(false), FIRST_REPLY_NOTICE_MS)
    }

    // KRİTİK: init akışı (greeting + auto-submit) tamamen bitene kadar bekle.
    // gen'i bundan ÖNCE artırmıyoruz; yoksa init'in turunu yarıda kesip aynı
    // konuşmaya çakışan ikinci tur göndererek "Sohbet durduruldu" hatasını
    // tetikleriz.
    await conversationReadyRef.current

    const gen = ++abortGenRef.current
    try {
      const activeAgent = getAgent(agent)
      const schemaName = activeAgent?.agentId

      if (!schemaName || schemaName === "agent-id") {
        // Agent henüz yapılandırılmamış — mock fallback
        await new Promise((r) => setTimeout(r, 1000))
        if (abortGenRef.current !== gen) return
        const replyText = activeAgent?.description?.trim() || `${activeAgent?.name ?? "Agent"} — ${t("chat.subtitle.lead")} ${t("chat.subtitle.highlight")}`
        setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: replyText, time: new Date() }])
        setOrbState("speaking")
        setTimeout(() => setOrbState("idle"), 2400)
        return
      }

      // Bot hazır değilse bekle (startConversation hâlâ çalışıyor olabilir)
      if (!copilotClientRef.current || copilotClientRef.current.agentId !== agent) {
        setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: t("chat.error") || "Agent bağlanıyor, lütfen bir saniye bekleyin.", attachments: [], time: new Date() }])
        setOrbState("idle")
        return
      }

      const client = copilotClientRef.current.client
      // Dosyaları gönderim anında base64 data-URI attachment'larına çevir
      // (kalıcı değil — yalnızca bu activity için). Bot tarafında
      // System.Activity.Attachments üzerinden .Name / .Content okunur.
      const wireAttachments = picked.length ? await filesToAttachments(picked.map((a) => a.file)) : []
      // Turdan hemen önce işaretle: yukarıdaki erken çıkışlarda (mock agent,
      // client hazır değil) bekleyen tur bırakmayalım.
      notifier.armTurn(text)
      const res = await streamReply(sendMessage(client, text, wireAttachments), gen)
      if (res.aborted) {
        notifier.cancelTurn()
        return
      }
      if (await maybeHandleConsent(res, gen)) return
      // Retry tarifi yalnızca metin: base64 dosyalar kalıcı tutulmadığı için
      // (sessionStorage quota) eklenti yeniden gönderilemez — metinle tekrar dener.
      finishStream(res, { kind: "message", text })
    } catch (err) {
      if (abortGenRef.current !== gen) return
      console.error("Copilot Studio error:", err)
      notifier.resolveTurn({ failed: true })
      setMessages((m) => [...m, { id: makeId(), role: "assistant", agent, content: t("chat.error") || "Bağlantı hatası oluştu.", attachments: [], time: new Date() }])
      setOrbState("idle")
      recoverFromDeadConversation()
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  /**
   * Devam ettirilen bir konuşma üzerindeki tur düştüğünde bir kez çalışır:
   * kimliği at ve sıfırdan el sıkış. Sessiz bir yeniden gönderim DEĞİL — ajan
   * akış kopmadan önce bir işlem yapmış olabilir ve bir turu tekrarlamak bizim
   * kararımız değil; kullanıcı sorusunu tekrar sorduğunda artık canlı bir
   * konuşmaya düşer.
   */
  function recoverFromDeadConversation() {
    if (!resumedRef.current) return
    resumedRef.current = false
    recoveringRef.current = true
    conversationIdRef.current = null
    setConversationTick((n) => n + 1)
    setResetNonce((n) => n + 1)
  }

  async function handleCardAction(actionData) {
    await conversationReadyRef.current
    const client = copilotClientRef.current?.client
    if (!client) return
    const gen = ++abortGenRef.current
    setOrbState("thinking")
    setBusy(true)
    try {
      notifier.armTurn("")
      const res = await streamReply(sendAction(client, actionData), gen)
      if (res.aborted) {
        notifier.cancelTurn()
        return
      }
      if (await maybeHandleConsent(res, gen)) return
      finishStream(res, { kind: "action", actionData })
    } catch (err) {
      console.error("Card action error:", err)
      notifier.resolveTurn({ failed: true })
      setOrbState("idle")
      recoverFromDeadConversation()
    } finally {
      if (abortGenRef.current === gen) setBusy(false)
    }
  }

  function handleResetLocal() {
    // Saklanan dökümü VE konuşma kimliğini birlikte at: kimlik kalsaydı init
    // effect'i temizlenen sohbeti hemen ajanın hafızasına geri bağlardı.
    clearChatSession(agent)
    conversationIdRef.current = null
    setRestoredCount(0)
    setOrbState("idle")
    setInput("")
    setUnread(0)
    setIsNearBottom(true)
    // Copilot konuşmasını sıfırdan başlat: init effect'i resetNonce ile yeniden
    // tetikle (eski client/mesajları temizleyip yeni greeting'i getirir).
    setResetNonce((n) => n + 1)
    onReset?.()
  }

  // "Boş" = gösterilecek GERÇEK içerik yok. init effect'i ağ beklemesi
  // başlarken içeriği boş bir placeholder assistant balonu ekliyor; bunu
  // "dolu" saymak orb karşılama ekranını anında tam chat layout'una atlatıp
  // boş bir "yazıyor" balonu flash'liyordu. İçeriksiz balonları yok sayarak
  // greeting (metin/kart/suggested) GERÇEKTEN gelene kadar orb ekranında
  // kalıyoruz — orb'un "thinking" animasyonu zaten yükleniyor göstergesi.
  const hasRenderableContent = (m) =>
    Boolean(m.content) || m.attachments?.length > 0 || m.suggestedActions?.length > 0 || m.incomplete
  const isEmpty = !messages.some(hasRenderableContent)

  if (isEmpty) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-6 sm:py-10">
        <PastelVoiceOrb
          state={orbState}
          level={effectiveLevel}
          size={isMobile ? 110 : 150}
          onClick={handleOrbClick}
        />
        {(() => {
          // Pre-split per-render so the locale toggle re-renders the right
          // tokens. Each word becomes its own motion.span with wordVariants
          // and the parent's stagger drives the wave.
          const greetingWords = t(greetingKey(greetHour)).split(" ")
          const leadWords = t("chat.subtitle.lead").split(" ")
          return (
            <div className="mt-6 space-y-1 text-center sm:mt-10">
              <motion.h1
                initial="hidden"
                animate="visible"
                variants={greetingLineVariants}
                className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl md:text-4xl"
                aria-label={`${t(greetingKey(greetHour))}, ${firstName}`}
              >
                {greetingWords.map((word, i) => (
                  <Fragment key={`g-${i}`}>
                    <motion.span variants={wordVariants} className="inline-block">
                      {word}
                    </motion.span>
                    {i < greetingWords.length - 1 ? " " : null}
                  </Fragment>
                ))}
                <motion.span variants={wordVariants} className="inline-block">
                  ,&nbsp;
                </motion.span>
                <motion.span
                  variants={wordVariants}
                  className="inline-block bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-transparent"
                >
                  {firstName}
                </motion.span>
              </motion.h1>

              <motion.p
                initial="hidden"
                animate="visible"
                variants={subtitleLineVariants}
                className="text-xl tracking-tight text-foreground/90 sm:text-2xl md:text-3xl"
                aria-label={`${t("chat.subtitle.lead")} ${t("chat.subtitle.highlight")}`}
              >
                {leadWords.map((word, i) => (
                  <Fragment key={`l-${i}`}>
                    <motion.span variants={wordVariants} className="inline-block">
                      {word}
                    </motion.span>
                    {" "}
                  </Fragment>
                ))}
                <motion.span
                  variants={wordVariants}
                  className="inline-block bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-transparent"
                >
                  {t("chat.subtitle.highlight")}
                </motion.span>
              </motion.p>
            </div>
          )
        })()}
        <ChatComposer
          value={input}
          onChange={handleInputChange}
          onSend={handleSend}
          agent={agent}
          onAgentChange={(id) => setAgent(id)}
          onMicToggle={handleMicToggle}
          micActive={orbState === "listening"}
          disabled={busy}
          className="mt-8 w-full max-w-3xl sm:mt-12"
        />
        <div className="mt-4 sm:mt-5">
          <QuickChips onChip={handleChip} />
        </div>
      </div>
    )
  }

  // Canonical 3-row chat layout:
  //   row 1: header  (auto)
  //   row 2: scroll  (flex-1 min-h-0 overflow-y-auto overscroll-contain)
  //   row 3: composer (auto, pb-safe)
  // min-h-0 on the scroller is non-negotiable — without it flex children
  // can't shrink below their content height, so the scroller would push the
  // composer off-screen. Composer is NOT sticky — the 3-row flex naturally
  // pins it. Sticky inside a transformed/overflow-hidden ancestor is fragile
  // on iOS Safari. Root uses h-full to inherit from DashboardLayout's main,
  // which itself is flex-1 of the viewport.
  return (
    // min-h-0 + h-full lock the chat shell to its parent's height so the
    // flex-1 scroller below cannot grow taller than the viewport. Without
    // min-h-0, 10+ messages push this column past 100dvh and the WHOLE
    // page starts scrolling — the chat header and composer disappear.
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-3 pt-2 sm:px-4 sm:pt-3">
      {/* Row 1 — header. Mini orb on the left mirrors the modes the big
          orb plays (idle / listening / thinking / speaking) so the user
          gets a visual "agent state" cue. Below the agent name we show
          the agent's description by default, swapping in "Yazıyor…" when
          the orb is in thinking mode so the user gets a clear in-progress
          signal. */}
      <div ref={headerRef} className="relative shrink-0 border-b border-border/60 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <PastelVoiceOrb
              state={orbState}
              level={effectiveLevel}
              size={30}
              onClick={handleOrbClick}
            />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium leading-4">{activeAgent?.name}</span>
              {orbState === "thinking" ? (
                <span className="truncate text-[11px] font-medium text-brand-deep">
                  {t("chat.status.thinking")}
                </span>
              ) : activeAgent?.description ? (
                <span className="truncate text-[11px] text-muted-foreground">
                  {activeAgent.description}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetLocal}
            className="h-8 w-8 shrink-0 gap-1.5 p-0 text-xs text-muted-foreground hover:text-foreground sm:w-auto sm:px-3"
            aria-label={t("chat.reset")}
          >
            <HugeiconsIcon icon={Refresh01Icon} className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">{t("chat.reset")}</span>
          </Button>
        </div>

      </div>

      {/* Kart, başlık çizgisinin ÜSTÜnde durur ve gerekirse başlık yazısının
          üstüne biner. Portal ile body'ye render edilir — `main`'in
          overflow-hidden'ı yoksa tepesini kırpıyordu. */}
      {/* `onScreen` şart: kart body'ye PORTAL ile çiziliyor, yani sohbet
          display:none olduğunda onunla birlikte gizlenmez. Kullanıcı mesajı
          gönderip hemen dashboard'a geçerse başlık çıpası ölçülemez hâle gelir
          ve kart ekranın köşesinde asılı kalırdı. */}
      <FirstReplyCard show={firstReplyNotice && onScreen} anchorRef={headerRef} />

      {/* Row 2 — message scroller. overscroll-contain blocks Android PTR +
          iOS rubber-band from bubbling to the page. onTouchStart blurs the
          textarea so the soft keyboard dismisses when the user taps an
          older message — matches ChatGPT/Claude mobile behavior. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }}
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-3"
      >
        <div ref={attachContentRef} className="space-y-4">
          {/* Geri gelen satırlar tarihlenir: aksi hâlde dünkü bir yanıt bu
              ziyaretin ilk mesajıymış gibi okunuyor. */}
          {restoredCount > 0 && <EarlierConversationDivider at={messages[0]?.time ?? null} />}
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onCardAction={handleCardAction} onSuggestedAction={handleSuggestedAction} onRetry={handleRetry} />
          ))}
        </div>
      </div>

      {/* Floating new-message pill — appears above the composer when the user
          has scrolled up and a new assistant message arrives. */}
      <div className="pointer-events-none relative z-10 -mb-2 flex justify-center">
        <AnimatePresence>
          {unread > 0 && !isNearBottom && (
            <motion.button
              key="new-msg-pill"
              type="button"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={scrollToBottom}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-3 py-1.5",
                "text-xs font-medium text-foreground shadow-lg backdrop-blur",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              )}
              aria-label={t("chat.scrollToLatest")}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" strokeWidth={2} />
              <span>{t("chat.newMessagePill").replace("{count}", String(unread))}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Row 3 — composer. Symmetric py only: the safe-area-inset-bottom
          is ALREADY applied one level up by SidebarInset
          (pb-[env(safe-area-inset-bottom)] in DashboardLayout). Adding env()
          here too would double the home-indicator gutter (~68 px on iOS PWA)
          and leave a tall bg-background band above the indicator — the
          "white gap" regression. Solid bg keeps the indicator from bleeding
          through the gradient. */}
      <div className="shrink-0 bg-background py-2 pwa:pb-5 sm:py-3">
        {/* Yalnızca kullanıcı gerçekten bir soru sorduktan sonra çıkar — o an
            "bu ne kadar sürecek?" sorusu zaten akılda, teklif oraya oturuyor. */}
        <NotifyOptIn visible={messages.some((m) => m.role === "user")} />
        <ChatComposer
          value={input}
          onChange={handleInputChange}
          onSend={handleSend}
          agent={agent}
          onAgentChange={(id) => setAgent(id)}
          onMicToggle={handleMicToggle}
          micActive={orbState === "listening"}
          disabled={busy}
        />
      </div>

      {/* Work IQ bağlantı izinleri — TEK özet onay kutusu. Bot art arda birçok
          "Connect to continue" kartı gönderiyor; kullanıcı burada bir kez onay
          verince hepsini otomatik "Allow"luyoruz (aşağıdaki bekle-overlay). */}
      <AnimatePresence>
        {consentPrompt && (
          <motion.div
            key="consent-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
            >
              {/* marka aksan şeridi */}
              <div className="h-1.5 w-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to" />
              <div className="p-7">
                <div className="flex items-start gap-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-sm">
                    <HugeiconsIcon icon={LinkSquare02Icon} className="size-6" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-foreground">Bağlantı izni gerekiyor</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">Microsoft 365 hesabınız</p>
                  </div>
                </div>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Asistanın isteğinizi yanıtlayabilmesi için Microsoft 365 hesabınıza bağlanması
                  gerekiyor. <span className="font-medium text-foreground">İzin vermek ister misiniz?</span>
                </p>
                <div className="mt-6 flex justify-end gap-2.5">
                  <Button variant="ghost" onClick={rejectConsent}>
                    Vazgeç
                  </Button>
                  <Button
                    onClick={approveConsent}
                    className="bg-brand-deep text-white shadow-sm hover:bg-brand-deep hover:opacity-90"
                  >
                    İzin ver
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Otomatik onaylanırken bekleme overlay'i */}
      <AnimatePresence>
        {consentWait && (
          <motion.div
            key="consent-wait"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/75 backdrop-blur-sm"
          >
            <PastelVoiceOrb state="thinking" level={0.4} size={90} />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Bağlantılar hazırlanıyor</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sizin adınıza gerekli izinler veriliyor, lütfen bekleyin…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
