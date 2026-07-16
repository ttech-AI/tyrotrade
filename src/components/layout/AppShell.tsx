import * as React from "react";
import { Outlet, useLocation, useMatch } from "react-router-dom";
import { Menu, Ship, Database, Search, Settings, X, Trash2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Home01Icon, HotPriceIcon, Robot01Icon, PieChartIcon, ChartLineData01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TyroChatButton, TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import { NotificationButton } from "@/components/layout/NotificationButton";
import { TyroChatDrawer } from "@/components/chat/TyroChatDrawer";
import { ProjectWebChat, type ProjectContext, type UserContext } from "@/components/chat/ProjectWebChat";
import { useChatWidth } from "@/components/chat/useChatWidth";
import { useMsal } from "@azure/msal-react";
import { useProjects } from "@/hooks/useProjects";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { DataverseLoginAutoRefresh } from "@/components/auth/DataverseLoginAutoRefresh";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/command/CommandPalette";
import { CommandPaletteTrigger } from "@/components/command/CommandPaletteTrigger";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useThemeAccent } from "./theme-accent";
import { shouldUseMock } from "@/lib/dataverse";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/LanguageProvider";

// pathname → i18n title key (resolved via t()). Only used as the fallback
// title for paths without a PAGE_TITLE_CONFIGS entry.
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "title.dashboard",
  "/overview": "title.overview",
  "/projects": "title.projects",
  "/price-tracking": "title.priceTracking",
  "/data": "title.dataManagement",
  "/settings": "title.settings",
};

export function AppShell() {
  return (
    <SidebarProvider>
      <ShellInner />
    </SidebarProvider>
  );
}

function ShellInner() {
  const isMobile = useIsMobile();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const location = useLocation();
  const t = useT();
  const titleKey =
    PAGE_TITLE_KEYS[location.pathname] ||
    (location.pathname.startsWith("/projects") ? "title.projects" : "title.app");
  const title = t(titleKey);

  const { accounts, instance } = useMsal();
  const msalAccount = accounts[0] ?? instance.getActiveAccount() ?? null;
  const userContext: UserContext | undefined = msalAccount
    ? { name: msalAccount.name ?? "", email: msalAccount.username ?? "" }
    : undefined;

  // Chat state lifted here so desktop panel is a flex sibling (push layout)
  // rather than a portal overlay.
  const [chatOpen, setChatOpen] = React.useState(() => {
    if (sessionStorage.getItem("tyro:openChatAfterAuth")) {
      sessionStorage.removeItem("tyro:openChatAfterAuth");
      return true;
    }
    return false;
  });

  // Whether the OPEN chat session is scoped to the active project.
  // Only the left-rail quick-ask (`tyro:askInChat`) opens in project scope;
  // the topbar TYRO Chat button always opens a GENERAL chat (like every
  // other page), even while a project detail page is on screen. Seeded from
  // a pending quick-ask so a re-auth redirect mid-quick-ask stays scoped.
  const [chatProjectScoped, setChatProjectScoped] = React.useState(
    () => !!sessionStorage.getItem("tyro:chat:pendingAsk")
  );

  // Open chat when a quick-ask is fired from project right-click — this is
  // the ONLY entry point that binds the chat to the current project.
  React.useEffect(() => {
    function handler() {
      setChatProjectScoped(true);
      setChatOpen(true);
    }
    window.addEventListener("tyro:askInChat", handler);
    return () => window.removeEventListener("tyro:askInChat", handler);
  }, []);

  // Topbar button toggle: opening from here is always a general chat, so
  // drop project scope on open. Closing leaves scope untouched.
  const toggleChatFromTopbar = React.useCallback(() => {
    setChatOpen((wasOpen) => {
      if (!wasOpen) setChatProjectScoped(false);
      return !wasOpen;
    });
  }, []);

  // Project context resolved here so both desktop panel and mobile drawer share it.
  const projectMatch = useMatch("/projects/:projectId");
  const activeProjectId = projectMatch?.params.projectId;
  const { projects } = useProjects();
  const activeProject = activeProjectId
    ? projects.find((p) => p.projectNo === activeProjectId)
    : undefined;
  const projectContext: ProjectContext | undefined = activeProjectId
    ? {
        projectId: activeProjectId,
        projectName: activeProject?.projectName ?? activeProjectId,
      }
    : undefined;

  // The chat only receives project context when it was opened project-scoped
  // (left-rail quick-ask). Opened from the topbar it's general, even on a
  // project page — so it behaves the same as on every other page.
  const effectiveProjectContext = chatProjectScoped ? projectContext : undefined;

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {!isMobile && <DesktopSidebarSlot />}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="p-3 max-w-[280px] sm:max-w-[280px]"
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <AppSidebar
              embedded
              onItemClick={() => setMobileOpen(false)}
              />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          title={title}
          pathname={location.pathname}
          chatOpen={chatOpen}
          onOpenChat={toggleChatFromTopbar}
        />
        <div className="flex-1 overflow-hidden p-3 pt-0">
          <Outlet />
        </div>
      </main>

      {/* Desktop: inline push panel — content shifts left, no overlay */}
      {!isMobile && (
        <DesktopChatSlot
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          projectContext={effectiveProjectContext}
          userContext={userContext}
        />
      )}

      {/* Mobile: sheet drawer overlay */}
      {isMobile && (
        <TyroChatDrawer
          open={chatOpen}
          onOpenChange={setChatOpen}
          projectContext={effectiveProjectContext}
          userContext={userContext}
        />
      )}

      <DataverseLoginAutoRefresh />
    </div>
  );
}

/* ─── Desktop inline chat panel ──────────────────────────────────────────── */

function DesktopChatSlot({
  open,
  onClose,
  projectContext,
  userContext,
}: {
  open: boolean;
  onClose: () => void;
  projectContext?: ProjectContext;
  userContext?: UserContext;
}) {
  const [hasOpened, setHasOpened] = React.useState(false);
  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  const [chatKey, setChatKey] = React.useState(0);
  const clearChat = React.useCallback(() => {
    sessionStorage.removeItem("tyro:chat:session");
    setChatKey((k) => k + 1);
  }, []);

  // Drag-to-resize width (shared with the mobile drawer via localStorage).
  const { width, reset: resetWidth, startResize, dragging } = useChatWidth();

  return (
    <div
      style={{ width: open ? width : 0 }}
      className={cn(
        "relative shrink-0 flex flex-col overflow-hidden",
        "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
        // Animate width on open/close, but not mid-drag (would lag the pointer).
        dragging ? "" : "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open
          ? "border-l border-border/60 rounded-l-3xl shadow-[-30px_0_80px_-16px_rgba(15,23,42,0.12)]"
          : ""
      )}
    >
      {open && (
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Sohbet genişliğini ayarla"
          className="group absolute left-0 top-0 z-30 h-full w-2 cursor-col-resize"
        >
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-border/70 transition-colors group-hover:bg-[#6366f1]"
          />
        </div>
      )}
      {hasOpened && (
        <>
          {/* Top accent bar */}
          <div
            aria-hidden
            className="h-1 w-full shrink-0"
            style={{ background: TYRO_CHAT_TONE.gradient }}
          />

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0 border-b border-border/40">
            <span
              className="size-10 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
              style={{
                background: TYRO_CHAT_TONE.gradient,
                boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              {/* Match the topbar TyroChatButton's icon (Robot01) so
                  the desktop chat panel header reads as "same glyph
                  expanded", not a different bubble that just happens
                  to share the gradient. Mobile drawer
                  (`TyroChatDrawer.tsx`) does the same. */}
              <HugeiconsIcon icon={Robot01Icon} size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold tracking-tight leading-tight">
                TYRO Chat
              </p>
              <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">
                {projectContext ? projectContext.projectName : "Uluslararası ticaret asistanı"}
              </p>
            </div>
            <button
              type="button"
              onClick={clearChat}
              title="Sohbeti temizle"
              className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Sohbeti temizle"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Chat body */}
          <div className="flex-1 min-h-0 bg-white">
            <ProjectWebChat key={chatKey} projectContext={projectContext} userContext={userContext} />
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Desktop sidebar slot ───────────────────────────────────────────────── */

function DesktopSidebarSlot() {
  const { expanded, setHovering } = useSidebar();
  const closeTimer = React.useRef<number | null>(null);

  const handleEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setHovering(true);
  };

  const handleLeave = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovering(false), 180);
  };

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={cn(
        "shrink-0 p-3 transition-[width] duration-200 ease-out",
        expanded ? "w-[272px]" : "w-[92px]"
      )}
    >
      <AppSidebar />
    </div>
  );
}

/* ─── Top bar ────────────────────────────────────────────────────────────── */

function TopBar({
  title,
  pathname,
  chatOpen,
  onOpenChat,
}: {
  title: string;
  pathname: string;
  chatOpen: boolean;
  onOpenChat: () => void;
}) {
  const isMobile = useIsMobile();
  const { setMobileOpen } = useSidebar();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  return (
    <>
      <div className="px-3 pt-3 pb-3">
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="flex items-center gap-3 px-4 h-14">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                aria-label="Menüyü aç"
              >
                <Menu />
              </Button>
            )}
            <PageTitleSlot title={title} pathname={pathname} />
            <CommandPaletteTrigger
              onOpen={() => setCmdOpen(true)}
              className="hidden md:inline-flex"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCmdOpen(true)}
              aria-label="Ara"
              className="md:hidden text-muted-foreground"
            >
              <Search />
            </Button>
            <NotificationButton />
            {/* Mobile: icon-only (the labeled pill is too wide for a phone
                topbar) but VISIBLE — was `hidden sm:inline-flex`, which left
                phones with no way to open the chat drawer. */}
            <TyroChatButton
              compact={isMobile}
              active={chatOpen}
              onClick={onOpenChat}
            />
          </div>
        </GlassPanel>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}

/* ─── Page title slot ────────────────────────────────────────────────────── */

interface PageTitleConfig {
  renderIcon: () => React.ReactNode;
  /** i18n keys (translations.ts) — resolved via t() in PageTitleSlot. */
  labelKey: string;
  titleKey: string;
}

const PAGE_TITLE_CONFIGS: Array<{
  match: (path: string) => boolean;
  config: PageTitleConfig;
}> = [
  {
    match: (p) => p === "/dashboard",
    config: {
      renderIcon: () => (
        <HugeiconsIcon icon={Home01Icon} size={16} strokeWidth={2} />
      ),
      labelKey: "eyebrow.dashboard",
      titleKey: "title.dashboard",
    },
  },
  {
    // H1 deliberately differs from the sidebar label so the two pages
    // (Overview vs Dashboard) don't share a topbar headline.
    match: (p) => p === "/overview",
    config: {
      renderIcon: () => (
        <HugeiconsIcon icon={PieChartIcon} size={16} strokeWidth={2} />
      ),
      labelKey: "eyebrow.overview",
      titleKey: "title.overview",
    },
  },
  {
    match: (p) => p === "/projects" || p.startsWith("/projects/"),
    config: {
      renderIcon: () => <Ship className="size-4" strokeWidth={2} />,
      labelKey: "eyebrow.projects",
      titleKey: "title.projects",
    },
  },
  {
    match: (p) => p === "/pl-cost",
    config: {
      renderIcon: () => (
        <HugeiconsIcon icon={HotPriceIcon} size={16} strokeWidth={2} />
      ),
      labelKey: "eyebrow.tradeCost",
      titleKey: "title.tradeCost",
    },
  },
  {
    match: (p) => p === "/price-tracking",
    config: {
      renderIcon: () => (
        <HugeiconsIcon icon={ChartLineData01Icon} size={16} strokeWidth={2} />
      ),
      labelKey: "eyebrow.priceTracking",
      titleKey: "title.priceTracking",
    },
  },
  {
    match: (p) => p === "/data",
    config: {
      renderIcon: () => <Database className="size-4" strokeWidth={2} />,
      labelKey: "eyebrow.dataManagement",
      titleKey: "title.dataManagement",
    },
  },
  {
    match: (p) => p === "/settings",
    config: {
      renderIcon: () => <Settings className="size-4" strokeWidth={2} />,
      labelKey: "eyebrow.settings",
      titleKey: "title.settings",
    },
  },
];

function PageTitleSlot({
  title,
  pathname,
}: {
  title: string;
  pathname: string;
}) {
  const accent = useThemeAccent();
  const t = useT();
  const mock = shouldUseMock();
  const matched = PAGE_TITLE_CONFIGS.find((c) => c.match(pathname))?.config;
  const isDataInspector = pathname === "/data";

  if (!matched) {
    return (
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold truncate">{title}</h1>
        <p className="text-[11px] text-muted-foreground truncate">
          {t("app.tagline")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 flex items-center gap-2.5">
      <span
        className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm"
        style={{
          background: accent.gradient,
          color: "white",
          boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
        }}
      >
        {matched.renderIcon()}
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-2 leading-tight">
          {t(matched.labelKey)}
          {isDataInspector && (
            <span
              className={cn(
                "inline-flex items-center gap-1 h-4 px-1.5 rounded text-[9.5px] font-semibold uppercase tracking-wide",
                mock
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-emerald-500/15 text-emerald-700"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  mock ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
              {mock ? "MOCK" : "CANLI"}
            </span>
          )}
        </div>
        <h1 className="text-[15px] font-semibold tracking-tight leading-tight truncate">
          {t(matched.titleKey)}
        </h1>
      </div>
    </div>
  );
}
