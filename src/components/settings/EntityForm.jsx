import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconPicker } from "./IconPicker"
import { LogoUpload } from "./LogoUpload"
import { useLocale } from "@/hooks/useLocale"
import { cn, isAllowedUrl, safeExternalUrl } from "@/lib/utils"

function IdField({ id, label, value, placeholder, onChange }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(t("settings.field.copied").replace("{name}", label))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t("settings.field.copyFailed"))
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-xs"
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          aria-label={t("settings.field.copy")}
          title={t("settings.field.copy")}
          className={cn(
            "absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md",
            "text-muted-foreground transition hover:bg-muted hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          )}
        >
          <HugeiconsIcon
            icon={copied ? Tick01Icon : Copy01Icon}
            className={cn("size-3.5", copied && "text-brand-via")}
            strokeWidth={1.8}
          />
        </button>
      </div>
    </div>
  )
}

function emptyState(kind) {
  if (kind === "agent") {
    return {
      name: "",
      description: "",
      tenantId: "",
      clientId: "",
      agentId: "",
      iconName: "Robot01Icon",
      logo: null,
    }
  }
  return {
    name: "",
    description: "",
    url: "",
    iconName: "AppsIcon",
    logo: null,
  }
}

export function EntityForm({ kind, open, initialValue, onClose, onSave }) {
  if (!open) return null
  return (
    <EntityFormInner
      key={initialValue?.id ?? `new-${kind}`}
      kind={kind}
      initialValue={initialValue}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function EntityFormInner({ kind, initialValue, onClose, onSave }) {
  const { t } = useLocale()
  const [form, setForm] = useState(() => initialValue ?? emptyState(kind))
  const isAgent = kind === "agent"
  const isEditing = Boolean(initialValue?.id)

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    // Reject non-http(s)/mailto URLs (incl. javascript:, data:, vbscript:) AND
    // relative/bare-hostname inputs — the value persists to Dataverse and is
    // replayed to every signed-in user, so an unsafe scheme here is a stored-
    // XSS vector and a bare "www.x.com" would silently produce a broken link.
    if (!isAgent && !isAllowedUrl(form.url)) {
      toast.error(t("settings.field.urlInvalid"))
      return
    }
    // Defense-in-depth: persist the canonical form (lowercase scheme, encoded
    // host, etc.) so any future render path that reads url directly is still
    // safe. Preserves empty / "#" as-is.
    const trimmed = String(form.url ?? "").trim()
    const url = isAgent || !trimmed || trimmed === "#" ? form.url : safeExternalUrl(form.url)
    onSave?.({ ...form, name: form.name.trim(), url })
  }

  const titleKey = isAgent
    ? isEditing
      ? "settings.agent.editTitle"
      : "settings.agent.newTitle"
    : kind === "aiApp"
      ? isEditing
        ? "settings.aiApp.editTitle"
        : "settings.aiApp.newTitle"
      : isEditing
        ? "settings.businessApp.editTitle"
        : "settings.businessApp.newTitle"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t(titleKey)}</DialogTitle>
            <DialogDescription>{t("settings.form.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="entity-name">{t("settings.field.name")}</Label>
              <Input
                id="entity-name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={isAgent ? "TYRO HR" : "tyroSign"}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="entity-desc">{t("settings.field.description")}</Label>
              <Textarea
                id="entity-desc"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t("settings.field.descriptionPlaceholder")}
                rows={2}
              />
            </div>

            {isAgent ? (
              <div className="grid grid-cols-1 gap-3">
                <IdField
                  id="entity-tenant"
                  label={t("settings.field.tenantId")}
                  value={form.tenantId}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  onChange={(v) => update({ tenantId: v })}
                />
                <IdField
                  id="entity-client"
                  label={t("settings.field.clientId")}
                  value={form.clientId}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  onChange={(v) => update({ clientId: v })}
                />
                <IdField
                  id="entity-agent"
                  label={t("settings.field.agentId")}
                  value={form.agentId}
                  placeholder="agent-id"
                  onChange={(v) => update({ agentId: v })}
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="entity-url">{t("settings.field.url")}</Label>
                <Input
                  id="entity-url"
                  type="text"
                  inputMode="url"
                  value={form.url}
                  onChange={(e) => update({ url: e.target.value })}
                  placeholder="https://"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>{t("settings.field.icon")}</Label>
              <IconPicker
                value={form.iconName}
                onChange={(name) => update({ iconName: name })}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("settings.field.logo")}</Label>
              <LogoUpload value={form.logo} onChange={(logo) => update({ logo })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("settings.action.cancel")}
            </Button>
            <Button type="submit" disabled={!form.name.trim()}>
              {isEditing ? t("settings.action.save") : t("settings.action.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
