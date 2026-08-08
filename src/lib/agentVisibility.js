import { TRADER_AGENT_ALIASES } from "@/lib/constants"

// Launcher öğelerinin iş anahtarı normalizasyonu — ConfigProvider'daki
// `nameKey` ile aynı kural (server tarafındaki tyro_NameTypeKey alternate
// key'inin ad yarısı).
const norm = (v) => (v ?? "").trim().toLowerCase()

/**
 * Agent, manager-hiyerarşisi kuralına tabi olan "TYRO Trader" mı?
 * Ad (normalize) veya id üzerinden eşleşir — bkz. TRADER_AGENT_ALIASES
 * docblock'undaki ortam-kararlılığı gerekçesi.
 */
export function isTraderAgent(agent) {
  const name = norm(agent?.name)
  const id = norm(agent?.id)
  return TRADER_AGENT_ALIASES.some((alias) => alias === name || alias === id)
}

/**
 * Agent listesini `locked` bayrağıyla işaretler — LİSTEDEN ÇIKARMAZ.
 *
 * Ürün kararı: kısıtlı agent herkese görünür kalır (dashboard kartı + chat
 * agent dropdown'ı), tıklanınca açıklayıcı bir toast çıkar. Gizlemek yerine
 * kilitli göstermek keşfedilebilirliği korur: kullanıcı asistanın var
 * olduğunu bilir ve neden açılmadığını öğrenir, "bende çıkmıyor" tipi
 * destek trafiği oluşmaz.
 *
 * `canSeeTrader` KATI olarak `true` olmalı: hook henüz çözülmediyse
 * (`undefined`) veya Graph çağrısı başarısızsa (`false`) agent KİLİTLİ
 * sayılır — fail-closed. Yetkili kullanıcıda kilit, Graph yanıtı gelince
 * (~300-500 ms) düşer; bu yönde titreme zararsız (kapalıdan açığa), tersi
 * yönde asla olmaz.
 *
 * Saf fonksiyon: aynı girdi → aynı çıktı, yan etkisi yok. Yeni dizi ve yeni
 * objeler üretir, bu yüzden çağıran tarafta useMemo ile sarılmalı. Kısıtlı
 * agent hiç yoksa (Dataverse'te adı değişmiş olabilir) DEV'de uyarır, çünkü
 * bu durumda kural sessizce fail-OPEN olur.
 */
export function markAgentAccess(agents, { canSeeTrader }) {
  const list = Array.isArray(agents) ? agents : []
  if (import.meta.env.DEV && list.length && !list.some(isTraderAgent)) {
    console.warn(
      "[agentVisibility] Kısıtlı agent bulunamadı — Dataverse'teki adı" +
        " TRADER_AGENT_ALIASES ile eşleşmiyor olabilir. Kural uygulanmıyor.",
    )
  }
  const locked = canSeeTrader !== true
  return list.map((a) => (isTraderAgent(a) ? { ...a, locked } : a))
}
