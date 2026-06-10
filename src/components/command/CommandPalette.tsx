import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  ArrowRight01Icon,
  Home01Icon,
  PieChartIcon,
  ShipmentTrackingIcon,
  DatabaseIcon,
  Settings01Icon,
  HelpCircleIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { hasUsableShipPlan } from "@/lib/selectors/project";
import type { Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";

/* ─────────── Types ─────────── */

type Category = "Sayfalar" | "Projeler" | "Limanlar" | "Gemiler";

interface BaseItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: IconSvgElement;
  category: Category;
}

interface PageItem extends BaseItem {
  type: "page";
  path: string;
  icon: IconSvgElement;
}

interface ProjectItem extends BaseItem {
  type: "project";
  path: string;
  status?: string;
}

type ResultItem = PageItem | ProjectItem;

/* ─────────── Static page index ─────────── */

const PAGES: Omit<PageItem, "category">[] = [
  {
    id: "page-dashboard",
    type: "page",
    label: "Dashboard",
    sublabel: "Ana panel · KPI'lar · Kral Projeler",
    path: "/",
    icon: Home01Icon,
  },
  {
    id: "page-overview",
    type: "page",
    label: "Genel Bakış",
    sublabel: "Grup & segment özeti · bekleyen gemiler",
    path: "/overview",
    icon: PieChartIcon,
  },
  {
    id: "page-projects",
    type: "page",
    label: "Projeler",
    sublabel: "Proje listesi · harita · detay",
    path: "/projects",
    icon: ShipmentTrackingIcon,
  },
  {
    id: "page-data",
    type: "page",
    label: "Veri Yönetimi",
    sublabel: "CRUD · D365 senkron",
    path: "/data",
    icon: DatabaseIcon,
  },
  {
    id: "page-settings",
    type: "page",
    label: "Ayarlar",
    path: "/settings",
    icon: Settings01Icon,
  },
  {
    id: "page-help",
    type: "page",
    label: "Yardım",
    path: "/help",
    icon: HelpCircleIcon,
  },
];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  "To Be Nominated": { bg: "rgba(245, 158, 11, 0.15)", fg: "#b45309" },
  Nominated: { bg: "rgba(14, 165, 233, 0.15)", fg: "#0369a1" },
  Commenced: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
  Completed: { bg: "rgba(16, 185, 129, 0.15)", fg: "#047857" },
  Open: { bg: "rgba(14, 165, 233, 0.15)", fg: "#0369a1" },
  Closed: { bg: "rgba(148, 163, 184, 0.15)", fg: "#475569" },
};
const FALLBACK_STATUS_TONE = {
  bg: "rgba(148, 163, 184, 0.15)",
  fg: "#475569",
};

/* ─────────── Hook (open + cmd-k binding) ─────────── */

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}

/* ─────────── Search ─────────── */

function searchProjects(q: string, projects: Project[]): ProjectItem[] {
  if (q.length < 2) return [];
  const lower = q.toLowerCase();
  const items: ProjectItem[] = [];
  for (const p of projects) {
    if (items.length >= 8) break;
    const haystack = [
      p.projectNo,
      p.projectName,
      p.vesselPlan?.vesselName,
      p.vesselPlan?.loadingPort?.name,
      p.vesselPlan?.dischargePort?.name,
      p.vesselPlan?.cargoProduct,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (haystack.includes(lower)) {
      const route = `${p.vesselPlan?.loadingPort?.name ?? ""} → ${
        p.vesselPlan?.dischargePort?.name ?? "—"
      }`;
      items.push({
        id: `project-${p.projectNo}`,
        type: "project",
        label: p.projectName,
        sublabel: `${p.projectNo} · ${route}`,
        category: "Projeler",
        path: `/projects/${p.projectNo}`,
        // Vessel voyage status when set, otherwise project Open/Closed.
        status: p.vesselPlan?.vesselStatus ?? p.status,
        icon: Tag01Icon,
      });
    }
  }
  return items;
}

/* ─────────── Component ─────────── */

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const accent = useThemeAccent();
  const { projects: rawProjects } = useProjects();
  // Same default as Projects/Dashboard pages: only show projects with a
  // usable ship plan in the search results.
  const projects = React.useMemo(
    () => rawProjects.filter(hasUsableShipPlan),
    [rawProjects]
  );
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc closes
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Build results
  const results = React.useMemo<ResultItem[]>(() => {
    const q = query.toLowerCase().trim();
    const items: ResultItem[] = [];

    // Pages — always shown when no query, filtered when query present
    for (const p of PAGES) {
      if (
        !q ||
        p.label.toLowerCase().includes(q) ||
        (p.sublabel && p.sublabel.toLowerCase().includes(q))
      ) {
        items.push({ ...p, category: "Sayfalar" });
      }
    }

    // Projects (only when 2+ chars)
    items.push(...searchProjects(q, projects));

    return items;
  }, [query, projects]);

  // Reset selection on query change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep selection in view
  React.useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = (item: ResultItem) => {
    navigate(item.path);
    onClose();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  // Group by category for rendering
  let lastCategory: Category | null = null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[9998]"
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="cmd-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed top-[14%] left-1/2 -translate-x-1/2 z-[9999]",
              "w-[min(calc(100vw-32px),580px)]",
              "rounded-2xl overflow-hidden",
              // Frosted glass shell
              "glass glass-strong shadow-glass",
              "ring-1 ring-white/55",
              "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.5)]"
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Komut paleti"
          >
            {/* Specular hairline */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent z-10"
            />

            {/* Search input row */}
            <div className="relative z-[1] flex items-center gap-3 px-4 py-3 border-b border-white/30">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                strokeWidth={2}
                className="shrink-0 text-muted-foreground"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ara… sayfa, proje, gemi, liman"
                className="flex-1 bg-transparent border-0 outline-none text-[14px] text-foreground placeholder:text-muted-foreground/70"
                aria-label="Arama"
              />
              <kbd className="select-none rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground ring-1 ring-inset ring-border/70 bg-background/80">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="relative z-[1] max-h-[360px] overflow-y-auto p-2"
              role="listbox"
            >
              {results.length === 0 && (
                <div className="px-3 py-10 text-center text-[12.5px] text-muted-foreground">
                  {query ? "Sonuç bulunamadı" : "Aramaya başlayın…"}
                </div>
              )}

              {results.map((item, i) => {
                const showHeader = item.category !== lastCategory;
                lastCategory = item.category;
                const selected = i === selectedIndex;
                const statusCfg = item.type === "project" && item.status
                  ? STATUS_TONE[item.status] ?? FALLBACK_STATUS_TONE
                  : null;

                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {item.category}
                      </div>
                    )}
                    <button
                      type="button"
                      data-index={i}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                        "outline-none"
                      )}
                      style={
                        selected
                          ? { backgroundColor: accent.tint }
                          : undefined
                      }
                      role="option"
                      aria-selected={selected}
                    >
                      {item.icon && (
                        <span
                          className="size-4 grid place-items-center shrink-0 transition-colors"
                          style={{
                            color: selected
                              ? accent.solid
                              : "var(--muted-foreground, #64748b)",
                          }}
                        >
                          <HugeiconsIcon
                            icon={item.icon}
                            size={16}
                            strokeWidth={1.85}
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-foreground truncate">
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                      {statusCfg && item.type === "project" && item.status && (
                        <span
                          className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums shrink-0"
                          style={{
                            backgroundColor: statusCfg.bg,
                            color: statusCfg.fg,
                          }}
                        >
                          {item.status}
                        </span>
                      )}
                      {item.type === "page" && (
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          size={14}
                          strokeWidth={2}
                          className={cn(
                            "shrink-0 transition-opacity",
                            selected ? "opacity-100" : "opacity-40"
                          )}
                          style={{
                            color: selected ? accent.solid : undefined,
                          }}
                        />
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Footer */}
            <div className="relative z-[1] flex items-center gap-3 px-4 py-2.5 border-t border-white/30 text-[10.5px] text-muted-foreground bg-white/30 backdrop-blur-md">
              <span className="inline-flex items-center gap-1">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/70 ring-1 ring-border/60">
                  ↑↓
                </kbd>
                gezin
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/70 ring-1 ring-border/60">
                  ↵
                </kbd>
                seç
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/70 ring-1 ring-border/60">
                  ⌘K
                </kbd>
                aç / kapat
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
