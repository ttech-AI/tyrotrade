import * as React from "react";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Crown02Icon,
  LaurelWreathFirst01Icon,
  Wallet01Icon,
  ChartDownIcon,
  ChartUpIcon,
} from "@hugeicons/core-free-icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactCurrency } from "@/lib/format";
import {
  topBySalesActual,
  topByExpense,
  topByMargin,
} from "@/lib/selectors/aggregate";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Project } from "@/lib/dataverse/entities";

// Dashboard 2-kolon layout'ta panel daha dar — 10 satır taşıyordu,
// 5 yeterli ve nefes alabilir. Drawer (KPI detay) için ayrı listeler
// kendi cap'lerini kullanıyor.
const TOP_N = 5;

interface LeaderboardPanelProps {
  projects: Project[];
}

type BoardKey =
  | "top-sales"
  | "top-expense"
  | "lowest-margin"
  | "highest-margin";

interface BoardConfig {
  key: BoardKey;
  /** i18n key for the tab label — resolved via `t()` at render. */
  labelKey: string;
  icon: typeof LaurelWreathFirst01Icon;
  iconColor: string;
  /** i18n key for the empty-state message. */
  emptyKey: string;
  /** Returns the top-N rows for this board, given a period-filtered set. */
  build: (filtered: Project[]) => ChartRow[];
  /** Tooltip & axis formatter for the bar value. */
  formatValue: (n: number, row: ChartRow) => string;
  /** X-axis tick label formatter. */
  formatTick: (n: number) => string;
}

interface ChartRow {
  projectNo: string;
  label: string;
  fullLabel: string;
  /** The numeric quantity the bar visualises (sales, expense, or margin). */
  value: number;
  /** Optional secondary string (currency, group). */
  currency?: string;
  group?: string;
  vesselName?: string;
  /** For margin-based boards we also surface the underlying P&L for tooltip. */
  pl?: number;
  marginPct?: number;
  salesTotal?: number;
}

const BOARDS: BoardConfig[] = [
  {
    key: "top-sales",
    labelKey: "dash.leaderboard.board.topSales",
    icon: LaurelWreathFirst01Icon,
    iconColor: "#e0ad3e",
    emptyKey: "dash.leaderboard.projects.emptySales",
    build: (filtered) =>
      topBySalesActual(filtered, TOP_N).map((p) => ({
        projectNo: p.projectNo,
        label: `${p.projectNo}␟${p.projectName}`,
        fullLabel: `${p.projectNo}  ${p.projectName}`,
        value: p.salesActualUsd,
        currency: p.currency,
        group: p.projectGroup,
        vesselName: p.vesselPlan?.vesselName,
      })),
    formatValue: (n) => formatCompactCurrency(n, "USD"),
    formatTick: (n) => formatCompactCurrency(n, "USD"),
  },
  {
    key: "top-expense",
    labelKey: "dash.leaderboard.board.topExpense",
    icon: Wallet01Icon,
    iconColor: "#f43f5e",
    emptyKey: "dash.leaderboard.projects.emptyExpense",
    build: (filtered) =>
      topByExpense(filtered, TOP_N).map((p) => ({
        projectNo: p.projectNo,
        label: `${p.projectNo}␟${p.projectName}`,
        fullLabel: `${p.projectNo}  ${p.projectName}`,
        value: p.expenseTotalUsd,
        currency: "USD",
        group: p.projectGroup,
        vesselName: p.vesselPlan?.vesselName,
      })),
    formatValue: (n) => formatCompactCurrency(n, "USD"),
    formatTick: (n) => formatCompactCurrency(n, "USD"),
  },
  {
    key: "lowest-margin",
    labelKey: "dash.leaderboard.board.lowestMargin",
    icon: ChartDownIcon,
    iconColor: "#f43f5e",
    emptyKey: "dash.leaderboard.projects.emptyMargin",
    build: (filtered) =>
      topByMargin(filtered, TOP_N, "asc").map((p) => ({
        projectNo: p.projectNo,
        label: `${p.projectNo}␟${p.projectName}`,
        fullLabel: `${p.projectNo}  ${p.projectName}`,
        value: p.marginPct,
        currency: p.currency,
        group: p.projectGroup,
        vesselName: p.vesselPlan?.vesselName,
        pl: p.pl,
        marginPct: p.marginPct,
        salesTotal: p.salesTotal,
      })),
    formatValue: (n) => `${n.toFixed(1)}%`,
    formatTick: (n) => `${n.toFixed(0)}%`,
  },
  {
    key: "highest-margin",
    labelKey: "dash.leaderboard.board.highestMargin",
    icon: ChartUpIcon,
    iconColor: "#10b981",
    emptyKey: "dash.leaderboard.projects.emptyMargin",
    build: (filtered) =>
      topByMargin(filtered, TOP_N, "desc").map((p) => ({
        projectNo: p.projectNo,
        label: `${p.projectNo}␟${p.projectName}`,
        fullLabel: `${p.projectNo}  ${p.projectName}`,
        value: p.marginPct,
        currency: p.currency,
        group: p.projectGroup,
        vesselName: p.vesselPlan?.vesselName,
        pl: p.pl,
        marginPct: p.marginPct,
        salesTotal: p.salesTotal,
      })),
    formatValue: (n) => `${n.toFixed(1)}%`,
    formatTick: (n) => `${n.toFixed(0)}%`,
  },
];


/* ─────────── Bar ranks ─────────── */

const RANK_COLORS_NAVY = [
  "#1e3a8a",
  "#1e40af",
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#7dd3fc",
  "#93c5fd",
  "#bae6fd",
  "#cffafe",
  "#e0f2fe",
];
const RANK_COLORS_ROSE = [
  "#9f1239",
  "#be123c",
  "#e11d48",
  "#f43f5e",
  "#fb7185",
  "#fda4af",
  "#fecaca",
  "#fee2e2",
  "#ffe4e6",
  "#fff1f2",
];
const RANK_COLORS_EMERALD = [
  "#064e3b",
  "#065f46",
  "#047857",
  "#059669",
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#a7f3d0",
  "#bbf7d0",
  "#d1fae5",
];

function rankColor(board: BoardKey, idx: number): string {
  const palette =
    board === "top-sales"
      ? RANK_COLORS_NAVY
      : board === "top-expense" || board === "lowest-margin"
        ? RANK_COLORS_ROSE
        : RANK_COLORS_EMERALD;
  return palette[Math.min(idx, palette.length - 1)] ?? "#cbd5e1";
}

/* ─────────── Bar shape (vertical stripes) ─────────── */

function StripedBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#3b82f6" } = props;
  if (width <= 0 || height <= 0) return null;
  const stripeW = 4;
  const gap = 3;
  const step = stripeW + gap;
  const count = Math.max(1, Math.floor(width / step));
  const used = count * step - gap;
  const offset = Math.max(0, (width - used) / 2);
  return (
    <g style={{ cursor: "pointer" }}>
      {/* Invisible hit target — covers the full bar bounds so clicks
          register on the recharts Bar wrapper regardless of whether
          they land on a stripe or in the gap between stripes.
          Without this, custom-shape bars look clickable (recharts
          renders the focus frame on hover) but `onClick` on `<Bar>`
          never fires — the SVG transparent gaps swallow the event. */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        pointerEvents="all"
      />
      {Array.from({ length: count }).map((_, i) => (
        <rect
          key={i}
          x={x + offset + i * step}
          y={y}
          width={stripeW}
          height={height}
          rx={1.5}
          fill={fill}
          pointerEvents="none"
        />
      ))}
    </g>
  );
}

/* ─────────── Y-axis tick (code + name) ─────────── */

function LeftAlignedTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  onProjectClick?: (projectNo: string) => void;
}) {
  const { x = 0, y = 0, payload, onProjectClick } = props;
  const value = String(payload?.value ?? "");
  const sepIdx = value.indexOf("␟");
  const code = sepIdx > 0 ? value.slice(0, sepIdx) : value;
  const name = sepIdx > 0 ? value.slice(sepIdx + 1) : "";
  const safeLeft = 4;
  const safeRight = 12;
  const foX = safeLeft;
  const foWidth = Math.max(0, x - safeLeft - safeRight);
  const blockHeight = 48;
  const handleClick = onProjectClick && code ? () => onProjectClick(code) : undefined;
  return (
    <foreignObject
      x={foX}
      y={y - blockHeight / 2}
      width={foWidth}
      height={blockHeight}
      style={{ overflow: "hidden" }}
    >
      <div
        onClick={handleClick}
        role={handleClick ? "button" : undefined}
        tabIndex={handleClick ? 0 : undefined}
        onKeyDown={
          handleClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          gap: 2,
          overflow: "hidden",
          color: "var(--foreground)",
          cursor: handleClick ? "pointer" : undefined,
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.02em",
            opacity: 0.6,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {code}
        </span>
        {name && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {name}
          </span>
        )}
      </div>
    </foreignObject>
  );
}

/* ─────────── Component ─────────── */

/**
 * Multi-board executive leaderboard.
 *
 *   - **En Çok Faturalı**: realised invoiced sales (`salesActualUsd`)
 *   - **El Yakanlar**: highest estimated expense (`costEstimate.totalUsd`)
 *   - **En Düşük Marj**: smallest (most negative) P&L margin %
 *   - **En Yüksek Marj**: largest P&L margin %
 *
 * Period scope is inherited from the dashboard top-right Filtre — this
 * panel doesn't keep its own period selector so the whole dashboard
 * stays in sync with one filter source. `projects` arrives already
 * scoped by `applyDashboardFilters`, so we just feed it straight to
 * the board's `build` function.
 */
export function LeaderboardPanel({ projects }: LeaderboardPanelProps) {
  const navigate = useNavigate();
  const t = useT();
  const [board, setBoard] = React.useState<BoardKey>("top-sales");

  const config = BOARDS.find((b) => b.key === board) ?? BOARDS[0];

  const chartConfig: ChartConfig = {
    value: { label: t("dash.leaderboard.valueLabel"), color: "#3b82f6" },
  };

  const data: ChartRow[] = React.useMemo(
    () => config.build(projects),
    [projects, config]
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          {/* Header icon stays a crown regardless of which board the
              user picks — the panel itself is "Kral Projeler" so it
              should always read as a crown, not the active tab's
              icon. Per-tab icons still appear inside the TabsTrigger
              row below. */}
          <HugeiconsIcon
            icon={Crown02Icon}
            size={20}
            strokeWidth={1.75}
            className="shrink-0"
            style={{ color: "#e0ad3e" }}
          />
          {t("dash.leaderboard.projects.title")}
        </CardTitle>
        {/* Board selector */}
        <Tabs
          value={board}
          onValueChange={(v) => setBoard(v as BoardKey)}
          className="w-full"
        >
          <TabsList className="h-9 w-full grid grid-cols-4 gap-1">
            {BOARDS.map((b) => (
              <TabsTrigger
                key={b.key}
                value={b.key}
                className="text-[11px] px-2 h-7 gap-1.5"
              >
                <HugeiconsIcon
                  icon={b.icon}
                  size={13}
                  strokeWidth={1.75}
                  style={{ color: b.iconColor }}
                  className="shrink-0"
                />
                <span className="truncate">{t(b.labelKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t(config.emptyKey)}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: Math.max(420, data.length * 60) }}
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 80, top: 4, bottom: 4 }}
              barCategoryGap="35%"
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={config.formatTick}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                width={300}
                interval={0}
                tick={
                  <LeftAlignedTick
                    onProjectClick={(no) => navigate(`/projects/${no}`)}
                  />
                }
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    nameKey="value"
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as ChartRow | undefined;
                      if (!row) return "";
                      return row.fullLabel;
                    }}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as ChartRow | undefined;
                      if (!row) return [String(value), ""];
                      return [
                        config.formatValue(Number(value), row),
                        `${row.projectNo} · ${row.group ?? ""}`,
                      ];
                    }}
                  />
                }
              />
              <Bar
                dataKey="value"
                shape={<StripedBar />}
                cursor="pointer"
                onClick={(payload) => {
                  // recharts hands the row's payload directly — far
                  // more reliable than BarChart-level activePayload
                  // sniffing when a custom `shape` is in play.
                  const row = payload as unknown as ChartRow | undefined;
                  if (row?.projectNo) {
                    navigate(`/projects/${row.projectNo}`);
                  }
                }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={rankColor(board, i)} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  className="fill-foreground"
                  formatter={(v) =>
                    typeof v === "number"
                      ? config.formatTick(v)
                      : String(v ?? "")
                  }
                  style={{ fontSize: 10, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
