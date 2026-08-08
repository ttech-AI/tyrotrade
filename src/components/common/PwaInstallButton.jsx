import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

function readStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  )
}

export function PwaInstallButton({ className }) {
  const { t } = useLocale()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(readStandalone)

  useEffect(() => {
    if (installed) return

    function onBefore(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", onBefore)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [installed])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } catch {
      /* user dismissed */
    }
    setDeferredPrompt(null)
  }

  if (installed || !deferredPrompt) return null

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={handleInstall}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 hover:border-brand/40 hover:shadow-lg",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-sm">
            <HugeiconsIcon icon={Download01Icon} className="size-5" strokeWidth={1.6} />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold leading-tight">{t("pwa.install.title")}</p>
            <p className="text-xs text-muted-foreground">{t("pwa.install.subtitle")}</p>
          </div>
        </div>
        <span className="text-xs font-medium text-brand-deep">{t("pwa.install.cta")}</span>
      </motion.button>
    </AnimatePresence>
  )
}
