import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon, Cancel01Icon, Settings02Icon } from "@hugeicons/core-free-icons"
import {
  getPermission,
  notificationsSupported,
  requestNotificationPermission,
  showNotification,
} from "@/lib/notify/browserNotify"
import { osNotificationSettings } from "@/lib/notify/osSettings"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "tyrotrade-notify-optin-dismissed"

/**
 * Composer'ın üstündeki tek satırlık bildirim akışı — üç adımlı.
 *
 * ZAMANLAMA: sayfa açılışında izin istemek bir origin'i kalıcı olarak
 * engelletmenin en hızlı yolu, Safari de kullanıcı jesti olmadan prompt'u
 * tümden reddediyor. İlk soru gönderildikten sonra sormak ise kullanıcının tam
 * o an hissettiği ihtiyaca cevap veriyor ve tıklamanın kendisi gereken jest
 * oluyor.
 *
 * DOĞRULAMA: asıl mesele izin vermek değil, iznin İŞE YARADIĞINI bilmek. Site
 * izni ile işletim sisteminin tarayıcıya verdiği izin ayrı şeyler; macOS'te
 * Chrome "granted" görünürken Sistem Ayarları her bildirimi sessizce yutabilir
 * ve bunu JS'ten anlamak mümkün değil. O yüzden izin verilir verilmez GERÇEK
 * bir bildirim gönderip "geldi mi?" diye soruyoruz: kullanıcı hâlâ ekrana
 * bakıyorken, saatler sonra sessizliği fark etmek yerine. Gelmediyse doğru
 * panele tek tıkla götürüyoruz.
 *
 * Reddetmek ücretsiz: izin gerektirmeyen ipuçları (sekme başlığı, favicon,
 * kenar çubuğu rozeti, dönüşte toast) her hâlükârda çalışıyor.
 */
export function NotifyOptIn({ visible }) {
  const { t } = useLocale()
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem(DISMISS_KEY),
  )
  const [permission, setPermission] = useState(getPermission)
  // "offer" → "verify" (test bildirimi yolda) → "help" (gelmedi, tarif göster)
  const [step, setStep] = useState("offer")

  const os = osNotificationSettings()

  function remember() {
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // gizli sekme — en kötü ihtimalle gelecek oturumda tekrar sorarız
    }
    setDismissed(true)
  }

  async function handleAllow() {
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === "denied") {
      remember()
      toast.message(t("chat.notify.blocked", "Tarayıcı bildirimleri engelledi."))
      return
    }
    if (result !== "granted") return // kullanıcı prompt'u kapattı — teklif dursun

    // Hemen gerçek bir bildirim: kullanıcı şu an bakıyor, çalışıp çalışmadığını
    // şimdi öğrensin.
    const shown = await showNotification({
      title: t("chat.notify.confirmTitle", "Bildirimler açıldı"),
      body: t("chat.notify.confirmBody", "Yanıtınız hazır olduğunda böyle haber vereceğiz."),
      tag: "tyrotrade-notify-confirm",
    })
    setStep(shown ? "verify" : "help")
  }

  const eligible = visible && !dismissed && notificationsSupported()
  // İzin verildikten sonra da görünmeye devam ediyor: doğrulama adımı bitene
  // kadar şerit kapanmamalı.
  const shouldShow = eligible && (permission === "default" || step !== "offer")
  if (!shouldShow) return null

  return (
    <div className="mb-2 rounded-xl border border-brand/25 bg-brand/5 px-3 py-2">
      {step === "offer" && (
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Notification03Icon}
            className="size-4 shrink-0 text-brand"
            strokeWidth={1.8}
          />
          <span className="min-w-0 flex-1 text-xs leading-snug text-foreground/80">
            {t(
              "chat.notify.prompt",
              "Yanıt gelince haber verelim mi? Başka sekmedeyken de bildirim alırsınız.",
            )}
          </span>
          <button
            type="button"
            onClick={handleAllow}
            className="shrink-0 rounded-full bg-brand-deep px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 active:scale-95"
          >
            {t("chat.notify.allow", "İzin ver")}
          </button>
          <button
            type="button"
            onClick={remember}
            aria-label={t("chat.notify.dismiss", "Şimdi değil")}
            title={t("chat.notify.dismiss", "Şimdi değil")}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {step === "verify" && (
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Notification03Icon}
            className="size-4 shrink-0 text-brand"
            strokeWidth={1.8}
          />
          <span className="min-w-0 flex-1 text-xs leading-snug text-foreground/80">
            {t("chat.notify.verify.q", "Deneme bildirimi gönderdik — ekranınızda göründü mü?")}
          </span>
          <button
            type="button"
            onClick={() => {
              remember()
              toast.success(t("chat.notify.enabled", "Bildirimler açıldı"))
            }}
            className="shrink-0 rounded-full bg-brand-deep px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 active:scale-95"
          >
            {t("chat.notify.verify.yes", "Göründü")}
          </button>
          <button
            type="button"
            onClick={() => setStep("help")}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium transition hover:bg-foreground/5"
          >
            {t("chat.notify.verify.no", "Görünmedi")}
          </button>
        </div>
      )}

      {step === "help" && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-foreground/80">
            {t(
              os.hintKey,
              "İşletim sisteminizin bildirim ayarlarından tarayıcınıza izin verildiğinden emin olun.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {os.url && (
              // Şema resmî olarak belgelenmiş değil ve tarayıcı bir onay
              // penceresi gösterir — bu yüzden yukarıdaki yazılı tarif her zaman
              // duruyor, düğme tek yol değil.
              <a
                href={os.url}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-brand-deep px-2.5 py-1",
                  "text-[11px] font-semibold text-white transition hover:opacity-90",
                )}
              >
                <HugeiconsIcon icon={Settings02Icon} className="size-3.5" strokeWidth={2} />
                {t("chat.notify.help.open", "Bildirim ayarlarını aç")}
              </a>
            )}
            <button
              type="button"
              onClick={remember}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium transition hover:bg-foreground/5"
            >
              {t("chat.notify.help.done", "Tamam")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
