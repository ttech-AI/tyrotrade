import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Refresh01Icon,
  Sun01Icon,
  ColorsIcon,
  GlobalIcon,
  Database02Icon,
  HardDriveIcon,
  Notification03Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  getPermission,
  notificationsSupported,
  requestNotificationPermission,
  showNotification,
} from "@/lib/notify/browserNotify"
import { osNotificationSettings } from "@/lib/notify/osSettings"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { usePalette } from "@/hooks/usePalette"
import { useConfig } from "@/hooks/useConfig"
import { appMeta, localStorageRegistry } from "@/data/appMeta"
import { cn } from "@/lib/utils"

const ENTRY_ICON = {
  "tyrotrade-theme": Sun01Icon,
  "tyrotrade-palette": ColorsIcon,
  "tyrotrade-locale": GlobalIcon,
  "tyrotrade-config-v1": Database02Icon,
}

function byteSize(str) {
  if (!str) return 0
  if (typeof Blob !== "undefined") return new Blob([str]).size
  return new TextEncoder().encode(str).length
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function GeneralTab() {
  const { t } = useLocale()
  const { theme } = useTheme()
  const { palette } = usePalette()
  const { locale } = useLocale()
  const config = useConfig()
  const [bump, setBump] = useState(0)

  const summaries = useMemo(
    () => ({
      "tyrotrade-theme": theme,
      "tyrotrade-palette": palette,
      "tyrotrade-locale": locale,
      // allAgents: bu satır localStorage cache'inin İÇERİĞİNİ özetliyor,
      // kullanıcıya görünen listeyi değil — cache her zaman tam listeyi tutar.
      "tyrotrade-config-v1": `${config.allAgents.length} agent · ${config.aiApps.length} AI · ${config.businessApps.length} iş`,
    }),
    [theme, palette, locale, config.allAgents.length, config.aiApps.length, config.businessApps.length],
  )

  const entries = useMemo(() => {
    void bump
    return localStorageRegistry.map((entry) => {
      const raw = window.localStorage.getItem(entry.key)
      return {
        ...entry,
        raw,
        size: byteSize(raw),
        present: raw !== null,
        summary: summaries[entry.key] ?? "—",
      }
    })
  }, [summaries, bump])

  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
  const presentCount = entries.filter((e) => e.present).length

  function handleRefresh() {
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.refreshed"))
  }

  function handleClearKey(key) {
    window.localStorage.removeItem(key)
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.cleared").replace("{key}", key))
  }

  function handleClearAll() {
    for (const entry of localStorageRegistry) {
      window.localStorage.removeItem(entry.key)
    }
    setBump((b) => b + 1)
    toast.success(t("settings.general.toast.clearedAll"))
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="space-y-10">
      {/* App identity */}
      <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="grid size-24 shrink-0 place-items-center">
          <TyroLogo size={64} className="size-16" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{appMeta.name}</h2>
            <span className="font-mono text-xs text-muted-foreground">v{appMeta.version}</span>
          </div>
          <p className="text-sm text-muted-foreground">{appMeta.brand}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground/70">
            {appMeta.stack.map((tech, i) => (
              <span key={tech} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/30">·</span>}
                <span>{tech}</span>
              </span>
            ))}
          </p>
          <p className="pt-1 text-[11px] text-muted-foreground/60">
            © {appMeta.releaseDate} {appMeta.parent}
          </p>
        </div>
      </section>

      <NotificationSection />

      {/* Storage section */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {t("settings.general.storage.sectionTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.storage.sectionSubtitle")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.general.storage.refresh")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClearAll}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              {t("settings.general.storage.clearAll")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card">
          {entries.map((entry, i) => {
            const Icon = ENTRY_ICON[entry.key] ?? Database02Icon
            return (
              <div
                key={entry.key}
                className={cn(
                  "group flex items-center gap-4 px-5 py-4 transition",
                  i > 0 && "border-t border-border/60",
                  !entry.present && "opacity-60",
                )}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft/50 text-brand-deep">
                  <HugeiconsIcon icon={Icon} className="size-4" strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">{t(entry.labelKey)}</p>
                    <code className="font-mono text-[10px] text-muted-foreground/70">
                      {entry.key}
                    </code>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.present
                      ? entry.summary
                      : t("settings.general.storage.empty")}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatSize(entry.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-9 shrink-0 text-muted-foreground/60 transition hover:text-destructive sm:size-8",
                    // Always visible on touch; hover-reveal on hover-capable
                    // devices only. Pure `opacity-0 group-hover:opacity-100`
                    // would hide the button on mobile where hover never fires.
                    "md:opacity-0 md:group-hover:opacity-100",
                    !entry.present && "pointer-events-none",
                  )}
                  disabled={!entry.present}
                  onClick={() => handleClearKey(entry.key)}
                  title={t("settings.general.storage.clearEntry")}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </Button>
              </div>
            )
          })}

          {/* Footer summary */}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-3 text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <HugeiconsIcon icon={HardDriveIcon} className="size-3.5" strokeWidth={1.6} />
              {presentCount} / {entries.length}{" "}
              <span className="text-muted-foreground/60">·</span>{" "}
              {t("settings.general.storage.total").toLowerCase()}
            </span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatSize(totalSize)}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          {t("settings.general.storage.note")}
        </p>
      </section>
    </div>
  )
}

/**
 * Bildirim durumu + test.
 *
 * Var olma sebebi teşhis: "hiç bildirim gelmiyor" en az üç farklı arızanın
 * ortak görüntüsü — site izni verilmemiş, tarayıcı engellemiş, ya da işletim
 * sistemi tarayıcının bildirimlerini tümden kapatmış (macOS'te çok yaygın:
 * Chrome'un site izni "granted" olsa bile Sistem Ayarları kapalıysa hiçbir şey
 * görünmez, ve bunu JS'ten anlamanın bir yolu yok).
 *
 * Test düğmesi bu üçünü ayırıyor: sohbetin koşullarını (sekme arkada mı, panel
 * kapalı mı) tamamen atlayıp doğrudan bir bildirim gösteriyor. Görünürse OS
 * tarafı sağlam demektir; görünmezse arıza tarayıcının dışında.
 *
 * Ayrıca gerçek bir boşluğu kapatıyor: composer üstündeki teklif şeridi bir kez
 * kapatılınca bir daha çıkmıyordu, yani izni sonradan açmanın arayüzde hiçbir
 * yolu yoktu.
 */
function NotificationSection() {
  const { t } = useLocale()
  const [permission, setPermission] = useState(getPermission)
  const [testing, setTesting] = useState(false)
  // null → sorulmadı · "ask" → "göründü mü?" · "help" → görünmedi, tarif göster
  const [verify, setVerify] = useState(null)
  const osTarget = osNotificationSettings()

  const supported = notificationsSupported()

  const statusLabel = {
    granted: t("settings.notify.status.granted", "İzin verildi"),
    default: t("settings.notify.status.default", "İzin istenmedi"),
    denied: t("settings.notify.status.denied", "Tarayıcı engelledi"),
    unsupported: t("settings.notify.status.unsupported", "Bu tarayıcı desteklemiyor"),
  }[supported ? permission : "unsupported"]

  async function handleAllow() {
    const next = await requestNotificationPermission()
    setPermission(next)
    if (next === "granted") toast.success(t("chat.notify.enabled", "Bildirimler açıldı"))
  }

  async function handleTest() {
    setTesting(true)
    setVerify(null)
    try {
      const shown = await showNotification({
        title: t("settings.notify.testTitle", "tyroTrade test bildirimi"),
        body: t("settings.notify.testBody", "Bunu görüyorsanız bildirimler doğru çalışıyor."),
        tag: "tyrotrade-notify-test",
      })
      // shown:true yalnızca "tarayıcı kabul etti" demek — işletim sistemi onu
      // sessizce yutmuş olabilir ve bunu okumanın yolu yok. O yüzden cevabı
      // kullanıcıdan alıyoruz.
      setVerify(shown ? "ask" : "help")
      if (!shown) toast.error(t("settings.notify.testFailed", "Bildirim gösterilemedi."))
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {t("settings.notify.sectionTitle", "Bildirimler")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.notify.sectionSubtitle", "Yanıt geldiğinde haber alın")}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <HugeiconsIcon icon={Notification03Icon} className="size-4.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("settings.notify.rowTitle", "Yanıt bildirimleri")}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  permission === "granted" && supported ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              {statusLabel}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {supported && permission === "default" && (
              <Button type="button" size="sm" onClick={handleAllow}>
                {t("chat.notify.allow", "İzin ver")}
              </Button>
            )}
            {supported && permission === "granted" && (
              <Button type="button" variant="outline" size="sm" disabled={testing} onClick={handleTest}>
                {t("settings.notify.test", "Test bildirimi gönder")}
              </Button>
            )}
          </div>
        </div>

        {permission === "denied" && (
          <p className="mt-3 border-t border-border/50 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "settings.notify.deniedHelp",
              "Tarayıcı bu site için bildirimleri engelledi. Adres çubuğundaki kilit simgesinden izni geri açabilirsiniz.",
            )}
          </p>
        )}

        {/* Testten sonra cevabı kullanıcıdan alıyoruz: bildirimi işletim
            sisteminin gerçekten gösterip göstermediğini JS'ten okumak mümkün
            değil. Bu, izni çoktan vermiş olan kullanıcının da doğrulamayı
            istediği zaman tekrar çalıştırabildiği tek yer — composer üstündeki
            şerit bir kez kapatılınca geri gelmiyor. */}
        {verify === "ask" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <span className="min-w-0 flex-1 text-[11.5px] text-foreground/80">
              {t("chat.notify.verify.q", "Deneme bildirimi gönderdik — ekranınızda göründü mü?")}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => {
                setVerify(null)
                toast.success(t("chat.notify.enabled", "Bildirimler açıldı"))
              }}
            >
              {t("chat.notify.verify.yes", "Göründü")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setVerify("help")}
            >
              {t("chat.notify.verify.no", "Görünmedi")}
            </Button>
          </div>
        )}

        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          <p
            className={cn(
              "text-[11px] leading-relaxed",
              verify === "help" ? "text-foreground/90" : "text-muted-foreground/80",
            )}
          >
            {t(osTarget.hintKey, t("settings.notify.osHint", ""))}
          </p>
          {osTarget.url && (
            // Doğrudan doğru panele götürür. Şema resmî olarak belgelenmiş
            // değil ve tarayıcı onay ister — bu yüzden yazılı tarif üstte
            // duruyor, düğme tek yol değil.
            <a
              href={osTarget.url}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand hover:underline"
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-3.5" strokeWidth={2} />
              {t("chat.notify.help.open", "Bildirim ayarlarını aç")}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
