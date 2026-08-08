import { toast } from "sonner"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SquareLock02Icon } from "@hugeicons/core-free-icons"

// Tek sabit id: kullanıcı kilitli agent'a üst üste tıklarsa toast'lar
// yığılmaz, aynı bildirim yerinde tazelenir.
const TOAST_ID = "agent-no-access"

/**
 * "Bu asistana yetkiniz yok" bildirimi.
 *
 * Sidebar.jsx'teki `showComingSoon` ile aynı kart dilini paylaşır (aynı
 * ölçüler, spring animasyonu, yüzey, marka gradyanlı ikon kutusu); ayrımı
 * ikon ve metin taşır, renk değil. Tek aksiyon metnin ALTINDA ve sona yaslı
 * solid bir buton — snackbar deseninin standardı.
 *
 * Tüm renkler palet token'larından gelir (`brand-from/via/to`, `brand-deep`,
 * `brand`): sabit bir amber deneyip geri alındı — paletten bağımsız durduğu
 * için her temada yabancı kalıyordu. Kırmızı/destructive de BİLEREK
 * kullanılmadı: kullanıcı hata yapmadı, sadece bir kapı kapalı; kırmızı
 * gereksiz alarm duygusu yaratır.
 *
 * @param {string} agentName Kilitli asistanın adı (veri değeri, çevrilmez).
 * @param {(key: string) => string} t useLocale()'den gelen çevirici.
 */
export function showAgentNoAccess(agentName, t) {
  toast.custom(
    (id) => (
      <motion.div
        initial={{ opacity: 0, y: 56, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 22, mass: 0.9 }}
        className="pointer-events-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-2xl ring-1 ring-brand/15 sm:p-5"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <motion.div
            initial={{ rotate: -25, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.06 }}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-md"
          >
            <HugeiconsIcon icon={SquareLock02Icon} size={22} strokeWidth={2} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">
              {t("access.agent.title")}
            </p>
            <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
              {t("access.agent.body").replace("{label}", agentName)}
            </p>
          </div>
        </div>
        {/* Tek aksiyon, metnin ALTINDA ve sona yaslı — snackbar deseninin
            standardı. Başlıkla aynı satırda duran metin-buton, okuma akışını
            kesiyor ve dokunma hedefi olarak da zayıf kalıyordu. `justify-end`
            (mantıksal hizalama) RTL'de kendiliğinden ters döner. */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => toast.dismiss(id)}
            className="inline-flex h-9 items-center rounded-lg bg-brand-deep px-4 text-sm font-semibold text-white shadow-sm outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brand-via/40 active:scale-[0.98]"
          >
            {t("access.dismiss")}
          </button>
        </div>
      </motion.div>
    ),
    { id: TOAST_ID, duration: 5500 },
  )
}
