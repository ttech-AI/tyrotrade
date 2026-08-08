import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Edit02Icon,
  Delete02Icon,
  Refresh01Icon,
  Robot01Icon,
  AiBrain02Icon,
  Office365Icon,
  Settings02Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { EntityForm } from "./EntityForm"
import { GeneralTab } from "./GeneralTab"
import { useConfig } from "@/hooks/useConfig"
import { useLocale } from "@/hooks/useLocale"
import { useIsInGroup } from "@/hooks/useIsInGroup"
import { ADMIN_GROUP_ID } from "@/lib/constants"
import { cn } from "@/lib/utils"

// Admin tab visibility is gated on Entra ID group membership rather than a
// hardcoded UPN list. Membership check lives in useIsInGroup — see its
// docblock for the primary (idTokenClaims.groups) + Graph fallback strategy.

function IdChip({ label, value }) {
  const { t } = useLocale()
  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t("settings.field.copied").replace("{name}", label))
    } catch {
      toast.error(t("settings.field.copyFailed"))
    }
  }
  const short = value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`${label}: ${value}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] transition hover:border-brand/40 hover:bg-brand-soft/40 hover:text-brand-deep"
    >
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <code className="font-mono text-foreground/80">{short}</code>
      <HugeiconsIcon icon={Copy01Icon} className="size-3 text-muted-foreground" strokeWidth={1.8} />
    </button>
  )
}

function EntityRow({ item, kind, onEdit, onDelete }) {
  const tone =
    kind === "agent"
      ? "bg-gradient-to-br from-brand-from via-brand-via to-brand-to"
      : kind === "businessApp"
        ? "bg-brand-deep"
        : ""
  const style =
    kind === "aiApp"
      ? { background: "color-mix(in oklab, var(--brand-via) 60%, var(--brand-deep) 40%)" }
      : undefined
  const isAgent = kind === "agent"
  const hasAnyId = isAgent && (item.tenantId || item.clientId || item.agentId)
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-brand/40 hover:shadow-sm">
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-sm",
          tone,
        )}
        style={style}
      >
        <IconOrLogo
          iconName={item.iconName}
          logo={item.logo}
          className="size-5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold">{item.name}</h4>
          {item.logo && (
            <Badge variant="outline" className="h-5 border-brand/40 px-1.5 text-[10px] text-brand-deep">
              LOGO
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.description || (!isAgent ? item.url || "—" : "—")}
        </p>
        {hasAnyId && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tenantId && <IdChip label="Tenant" value={item.tenantId} />}
            {item.clientId && <IdChip label="Client" value={item.clientId} />}
            {item.agentId && <IdChip label="Agent" value={item.agentId} />}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="size-9 sm:size-8"
          onClick={() => onEdit(item)}
          aria-label="Edit"
        >
          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 text-muted-foreground hover:text-destructive sm:size-8"
          onClick={() => onDelete(item)}
          aria-label="Delete"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function EntitySection({ kind, items, headerIcon, onAdd, onEdit, onDelete, onReset, labels }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-deep">
            <HugeiconsIcon icon={headerIcon} className="size-4" strokeWidth={1.6} />
          </div>
          <div>
            <h3 className="text-base font-semibold">{labels.title}</h3>
            <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onReset}
          >
            <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
            {labels.reset}
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-9 gap-1.5 border-0 bg-brand text-white shadow-sm",
              "hover:bg-brand hover:brightness-110 hover:shadow-md hover:text-white",
            )}
            onClick={onAdd}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={2} />
            {labels.add}
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {labels.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((item) => (
            <EntityRow
              key={item.id}
              item={item}
              kind={kind}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const { t } = useLocale()
  const config = useConfig()
  // `undefined` (Graph fallback in flight) is treated as false so the admin
  // tabs never flash visible-then-hidden. Real admins see the tabs the
  // moment the check resolves — either synchronously from the ID-token
  // groups claim (no flash) or ~300-500 ms after a fresh login if the
  // claim isn't configured and we have to hit Graph.
  const isInAdminGroup = useIsInGroup(ADMIN_GROUP_ID)
  const showAdminTabs = isInAdminGroup === true
  const [tab, setTab] = useState("general")
  const [editing, setEditing] = useState(null) // { kind, value } | null
  const [deletePrompt, setDeletePrompt] = useState(null) // { kind, item } | null

  // Non-admin lands on /settings → force them onto the general tab. Without
  // this, if a non-admin's localStorage somehow had a stale "agents" value
  // they'd see an empty TabsContent (since the trigger is hidden).
  const safeTab = showAdminTabs || tab === "general" ? tab : "general"

  function openNew(kind) {
    setEditing({ kind, value: null })
  }
  function openEdit(kind, value) {
    setEditing({ kind, value })
  }
  function closeForm() {
    setEditing(null)
  }

  async function handleSave(saved) {
    if (!editing) return
    const { kind } = editing
    try {
      if (kind === "agent") await config.upsertAgent(saved)
      if (kind === "aiApp") await config.upsertAiApp(saved)
      if (kind === "businessApp") await config.upsertBusinessApp(saved)
      toast.success(t("settings.toast.saved").replace("{name}", saved.name))
      setEditing(null)
    } catch {
      // Remote write failed — keep the dialog open so the user can retry.
      toast.error(t("settings.toast.saveError").replace("{name}", saved.name))
    }
  }

  async function confirmDelete() {
    if (!deletePrompt) return
    const { kind, item } = deletePrompt
    try {
      if (kind === "agent") await config.removeAgent(item.id)
      if (kind === "aiApp") await config.removeAiApp(item.id)
      if (kind === "businessApp") await config.removeBusinessApp(item.id)
      toast.success(t("settings.toast.deleted").replace("{name}", item.name))
      setDeletePrompt(null)
    } catch {
      toast.error(t("settings.toast.deleteError").replace("{name}", item.name))
    }
  }

  function handleReset(collection, labelKey) {
    config.reset(collection)
    toast.success(t("settings.toast.reset").replace("{name}", t(labelKey)))
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 overflow-y-auto px-3 py-5 font-sans sm:gap-6 sm:px-4 sm:py-6 lg:px-6 lg:py-8" style={{ fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif' }}>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <Tabs value={safeTab} onValueChange={setTab} className="flex-1">
        <TabsList
          className={cn(
            // Recessed-track segmented-control (iOS/macOS). The track is a soft fill +
            // subtle inset shadow ONLY — no border — so the single visible frame is the
            // floating active thumb (see TabsTrigger). A track border here would compete
            // with the thumb and read as two clashing frames.
            //
            // py-2 px-0: vertical breathing room around the thumb but NO horizontal
            // padding, so the first/last tab sits flush with the track's outer ends.
            // Without this an inactive sliver of track was visible to the left of the
            // first tab and to the right of the last. The first/last trigger pick up
            // a matching rounded-l-3xl / rounded-r-3xl so the outer button corners
            // hug the track's rounded ends instead of poking out of the curve.
            "h-auto w-full rounded-3xl bg-muted/60 px-0 py-2",
            "shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
            "flex gap-1",
            "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:overflow-visible",
            "dark:bg-white/[0.04] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
          )}
        >
          {[
            { value: "general", icon: Settings02Icon, label: t("settings.tabs.general"), adminOnly: false },
            { value: "agents", icon: Robot01Icon, label: t("settings.tabs.agents"), adminOnly: true },
            { value: "aiApps", icon: AiBrain02Icon, label: t("settings.tabs.aiApps"), adminOnly: true },
            { value: "businessApps", icon: Office365Icon, label: t("settings.tabs.businessApps"), adminOnly: true },
          ]
            .filter((tabDef) => !tabDef.adminOnly || showAdminTabs)
            .map((tabDef) => (
            <TabsTrigger
              key={tabDef.value}
              value={tabDef.value}
              aria-label={tabDef.label}
              className={cn(
                // flex-1 makes each segment fill an equal share of the track. On
                // mobile the labels are HIDDEN — only the icon shows — so all 4
                // tabs fit at 375px without horizontal scroll. The active tab's
                // label appears below the track (see ActiveTabLabel) so the
                // user always sees which page they're on. sm:+ shows icon +
                // inline label like before.
                //
                // first:rounded-l-3xl / last:rounded-r-3xl — the first/last button's
                // outer corners match the track's outer corner (24 px) so the active
                // thumb fills the track's rounded "ear" cleanly with no gray sliver
                // between thumb and track edge. Middle tabs keep rounded-xl (12 px).
                "group relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl first:rounded-l-3xl last:rounded-r-3xl border-0 bg-transparent px-2 text-[13px] font-medium whitespace-nowrap sm:h-10 sm:px-3",
                "text-muted-foreground transition-all duration-200 ease-out",
                "hover:text-foreground hover:bg-foreground/[0.04]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-0",
                // Active = floating thumb on the recessed track. Separation is purely
                // fill + soft drop shadow — NO ring/border, so it never competes with
                // the track (that was the clashing double-frame). Tonal ladder:
                // page < track fill < thumb fill.
                "data-[state=active]:bg-background data-[state=active]:text-foreground",
                "data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.06)]",
                // Dark active thumb must be OPAQUE — a translucent white/0.12 let
                // the track's inset shadow bleed through and read as a line drawn
                // across the middle of the active button. neutral-800 (#262626) is
                // the opaque equivalent of white/0.12 over the dark page background.
                "dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white",
                "dark:data-[state=active]:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_2px_8px_rgba(0,0,0,0.45)]",
              )}
            >
              <HugeiconsIcon
                icon={tabDef.icon}
                className="size-[18px] shrink-0 opacity-70 transition group-data-[state=active]:opacity-100 sm:size-[15px]"
                strokeWidth={1.6}
              />
              <span className="hidden truncate sm:inline">{tabDef.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Mobile-only active-tab label below the icon-only track so users
            always see which page they're on. Hidden on sm+ where labels
            live inline in the tabs themselves. */}
        <p
          className="mt-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:hidden"
          aria-hidden="true"
        >
          {(() => {
            const labels = {
              general: t("settings.tabs.general"),
              agents: t("settings.tabs.agents"),
              aiApps: t("settings.tabs.aiApps"),
              businessApps: t("settings.tabs.businessApps"),
            }
            return labels[safeTab]
          })()}
        </p>

        <TabsContent value="general" className="mt-8">
          <GeneralTab />
        </TabsContent>

        <TabsContent value="agents" className="mt-8">
          <EntitySection
            kind="agent"
            headerIcon={Robot01Icon}
            // allAgents: bu sekme admin CRUD'u — görünürlük kuralına takılan
            // kısıtlı agent da yönetilebilir kalmalı (sekmenin kendisi zaten
            // ADMIN_GROUP_ID üyeliğiyle gizli).
            items={config.allAgents}
            onAdd={() => openNew("agent")}
            onEdit={(item) => openEdit("agent", item)}
            onDelete={(item) => setDeletePrompt({ kind: "agent", item })}
            onReset={() => handleReset("agents", "settings.tabs.agents")}
            labels={{
              title: t("settings.agent.sectionTitle"),
              subtitle: t("settings.agent.sectionSubtitle"),
              add: t("settings.agent.addAction"),
              reset: t("settings.action.reset"),
              empty: t("settings.agent.empty"),
            }}
          />
        </TabsContent>

        <TabsContent value="aiApps" className="mt-8">
          <EntitySection
            kind="aiApp"
            headerIcon={AiBrain02Icon}
            items={config.aiApps}
            onAdd={() => openNew("aiApp")}
            onEdit={(item) => openEdit("aiApp", item)}
            onDelete={(item) => setDeletePrompt({ kind: "aiApp", item })}
            onReset={() => handleReset("aiApps", "settings.tabs.aiApps")}
            labels={{
              title: t("settings.aiApp.sectionTitle"),
              subtitle: t("settings.aiApp.sectionSubtitle"),
              add: t("settings.aiApp.addAction"),
              reset: t("settings.action.reset"),
              empty: t("settings.aiApp.empty"),
            }}
          />
        </TabsContent>

        <TabsContent value="businessApps" className="mt-8">
          <EntitySection
            kind="businessApp"
            headerIcon={Office365Icon}
            items={config.businessApps}
            onAdd={() => openNew("businessApp")}
            onEdit={(item) => openEdit("businessApp", item)}
            onDelete={(item) => setDeletePrompt({ kind: "businessApp", item })}
            onReset={() => handleReset("businessApps", "settings.tabs.businessApps")}
            labels={{
              title: t("settings.businessApp.sectionTitle"),
              subtitle: t("settings.businessApp.sectionSubtitle"),
              add: t("settings.businessApp.addAction"),
              reset: t("settings.action.reset"),
              empty: t("settings.businessApp.empty"),
            }}
          />
        </TabsContent>
      </Tabs>

      <EntityForm
        kind={editing?.kind}
        open={Boolean(editing)}
        initialValue={editing?.value}
        onClose={closeForm}
        onSave={handleSave}
      />

      <Dialog
        open={Boolean(deletePrompt)}
        onOpenChange={(v) => !v && setDeletePrompt(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("settings.deletePrompt.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.deletePrompt.body").replace(
                "{name}",
                deletePrompt?.item?.name ?? "",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePrompt(null)}>
              {t("settings.action.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("settings.action.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
