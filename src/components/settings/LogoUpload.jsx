import { useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon, Delete02Icon, UploadCircle01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/useLocale"
import { toast } from "sonner"

const MAX_BYTES = 256 * 1024 // 256 KB — keeps localStorage usage in check

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

export function LogoUpload({ value, onChange }) {
  const { t } = useLocale()
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.logo.errorType"))
      e.target.value = ""
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("settings.logo.errorSize"))
      e.target.value = ""
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      onChange?.(dataUrl)
    } catch {
      toast.error(t("settings.logo.errorRead"))
    } finally {
      e.target.value = ""
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <HugeiconsIcon
            icon={Image01Icon}
            className="size-5 text-muted-foreground/60"
            strokeWidth={1.4}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <HugeiconsIcon icon={UploadCircle01Icon} className="size-3.5" />
            {value ? t("settings.logo.replace") : t("settings.logo.upload")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => onChange?.(null)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              {t("settings.logo.remove")}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("settings.logo.hint")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
