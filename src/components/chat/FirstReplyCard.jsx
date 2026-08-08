import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ZzzIcon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"

// Kartın alt kenarı ile başlık çizgisi arasındaki boşluk (px). Kart ASLA
// çizginin altına taşmaz; buradan yukarı doğru büyür.
const GAP_ABOVE_RULE = 6

/**
 * "İlk yanıt yavaş olabilir" kartı — sohbet başlığının ALT ÇİZGİSİNİN hemen
 * ÜSTÜNDE durur, gerekirse agent adının/açıklamasının üstüne biner.
 *
 * Neden portal + position:fixed: DashboardLayout'un `main`'i `overflow-hidden`
 * (bkz. DashboardLayout.jsx). Kart başlık bandından yukarı taştığı anda o
 * kırpma kartın TEPESİNİ kesiyordu — z-index bunu çözmez, çünkü sorun yığın
 * sırası değil kırpma. Portal ile kart body'ye taşınıyor: hiçbir ata onu
 * kırpamıyor ve gerçekten en üstte duruyor.
 *
 * Konum, çizgiyi taşıyan başlık elemanının ölçüsünden hesaplanır (`anchorRef`):
 *  - alt kenar  = başlığın alt kenarı (çizgi) − GAP_ABOVE_RULE  → altına taşmaz
 *  - yatay orta = başlığın ortası                              → sohbete göre ortalı
 * Pencere yeniden boyutlanırsa/kaydırılırsa yeniden ölçülür.
 *
 * `pointer-events-none`: kart görünürken altındaki başlık düğmeleri
 * (Yeni sohbet) ve mesajlar tıklanabilir kalır.
 *
 * @param {boolean} show Görünür mü (ChatScreen ilk mesajda açar, 5 sn sonra kapatır).
 * @param {{current: HTMLElement|null}} anchorRef Çizgiyi taşıyan başlık elemanı.
 */
export function FirstReplyCard({ show, anchorRef }) {
  const { t } = useLocale()
  const [box, setBox] = useState(null)

  useEffect(() => {
    if (!show) return
    let raf = 0
    let tries = 0
    const measure = () => {
      const el = anchorRef?.current
      if (!el) {
        // Çıpa henüz DOM'da olmayabilir: sohbet boş durumdan ilk mesaja
        // geçerken başlık aynı commit'te doğuyor ama bir kare gecikebilir.
        // Birkaç kare deneyip vazgeçiyoruz (sessizce; kart görünmez kalır).
        if (tries++ < 30) raf = requestAnimationFrame(measure)
        return
      }
      const r = el.getBoundingClientRect()
      setBox({
        // Görünüm alanının ALTINDAN ölçülen mesafe: kartın alt kenarı çizginin
        // hemen üstüne kilitlenir, kart yukarı doğru büyür.
        bottom: window.innerHeight - r.bottom + GAP_ABOVE_RULE,
        centerX: r.left + r.width / 2,
        maxWidth: r.width,
      })
    }
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [show, anchorRef])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence initial={false}>
      {show && box && (
        <motion.div
          key="first-reply-card"
          initial={{ opacity: 0, y: 8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 360, damping: 24, mass: 0.9 }}
          className="pointer-events-none fixed z-[60] -translate-x-1/2"
          style={{ bottom: box.bottom, left: box.centerX }}
        >
          <div
            className="flex w-[340px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-2xl ring-1 ring-brand/15"
            style={{ maxWidth: Math.min(340, box.maxWidth) }}
          >
            <motion.div
              initial={{ rotate: -25, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.06 }}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-md"
            >
              <HugeiconsIcon icon={ZzzIcon} size={18} strokeWidth={2} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">
                {t("chat.firstReply.title")}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {t("chat.firstReply.body")}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
