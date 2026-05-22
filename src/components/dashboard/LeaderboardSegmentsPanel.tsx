import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LaurelWreathFirst01Icon,
  Wallet01Icon,
  ChartDownIcon,
  ChartUpIcon,
  DashboardCircleIcon,
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
  aggregateBySegment,
  type SegmentRollup,
} from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

// Yan yana 2-kolon layout'a uygun cap — eskiden 10 satırlık liste
// panel'i ezikleştiriyordu, 5 zarif ve hızlı okunur kalıyor.
const TOP_N = 5;

interface LeaderboardSegmentsPanelProps {
  projects: Project[];
}

type BoardKey =
  | "top-sales"
  | "top-expense"
  | "lowest-margin"
  | "highest-margin";

interface ChartRow {
  segment: string;
  label: string;
  /** The numeric quantity the bar visualises. */
  value: number;
  projectCount: number;
  /** Optional companion stats for the tooltip. */
  pl?: number;
  marginPct?: number | null;
  salesEstimate?: number;
}

interface BoardConfig {
  key: BoardKey;
  label: string;
  icon: typeof LaurelWreathFirst01Icon;
  iconColor: string;
  emptyMessage: string;
  build: (rollups: SegmentRollup[]) => ChartRow[];
  formatValue: (n: number, row: ChartRow) => string;
  formatTick: (n: number) => string;
}

const BOARDS: BoardConfig[] = [
  {
    key: "top-sales",
    label: "Satış Liderleri | Gerçekleşen",
    icon: LaurelWreathFirst01Icon,
    iconColor: "#e0ad3e",
    emptyMessage: "Bu filtrede faturalı segment yok.",
    build: (rollups) =>
      rollups
        .filter((r) => r.salesActualUsd > 0)
        .sort((a, b) => b.salesActualUsd - a.salesActualUsd)
        .slice(0, TOP_N)
        .map((r) => ({
          segment: r.segment,
          label: r.segment,
          value: r.salesActualUsd,
          projectCount: r.projectCount,
        })),
    formatValue: (n) => formatCompactCurrency(n, "USD"),
    formatTick: (n) => formatCompactCurrency(n, "USD"),
  },
  {
    key: "top-expense",
    label: "El Yakanlar | Tahmini",
    icon: Wallet01Icon,
    iconColor: "#f43f5e",
    emptyMessage: "Bu filtrede gider tahmini olan segment yok.",
    build: (rollups) =>
      rollups
        .filter((r) => r.expenseEstimateUsd > 0)
        .sort((a, b) => b.expenseEstimateUsd - a.expenseEstimateUsd)
        .slice(0, TOP_N)
        .map((r) => ({
          segment: r.segment,
          label: r.segment,
          value: r.expenseEstimateUsd,
          projectCount: r.projectCount,
        })),
    formatValue: (n) => formatCompactCurrency(n, "USD"),
    formatTick: (n) => formatCompactCurrency(n, "USD"),
  },
  {
    key: "lowest-margin",
    label: "En Düşük Marj | Tahmini",
    icon: ChartDownIcon,
    iconColor: "#f43f5e",
    emptyMessage: "Bu filtrede marj hesaplanabilir segment yok.",
    build: (rollups) =>
      rollups
        .filter((r) => r.marginPct !== null && r.salesEstimateUsd > 0)
        .sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))
        .slice(0, TOP_N)
        .map((r) => ({
          segment: r.segment,
          label: r.segment,
          value: r.marginPct ?? 0,
          projectCount: r.projectCount,
          pl: r.pl,
          marginPct: r.marginPct,
          salesEstimate: r.salesEstimateUsd,
        })),
    formatValue: (n) => `${n.toFixed(1)}%`,
    formatTick: (n) => `${n.toFixed(0)}%`,
  },
  {
    key: "highest-margin",
    label: "En Yüksek Marj | Tahmini",
    icon: ChartUpIcon,
    iconColor: "#10b981",
    emptyMessage: "Bu filtrede marj hesaplanabilir segment yok.",
    build: (rollups) =>
      rollups
        .filter((r) => r.marginPct !== null && r.salesEstimateUsd > 0)
        .sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0))
        .slice(0, TOP_N)
        .map((r) => ({
          segment: r.segment,
          label: r.segment,
          value: r.marginPct ?? 0,
          projectCount: r.projectCount,
          pl: r.pl,
          marginPct: r.marginPct,
          salesEstimate: r.salesEstimateUsd,
        })),
    formatValue: (n) => `${n.toFixed(1)}%`,
    formatTick: (n) => `${n.toFixed(0)}%`,
  },
];

const chartConfig: ChartConfig = {
  value: { label: "Değer", color: "#6366f1" },
};

/* ─────────── Bar palette per board ─────────── */

const RANK_COLORS_INDIGO = [
  "#3730a3",
  "#4338ca",
  "#4f46e5",
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#c7d2fe",
  "#ddd6fe",
  "#e0e7ff",
  "#eef2ff",
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
      ? RANK_COLORS_INDIGO
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
  const { x = 0, y = 0, width = 0, height = 0, fill = "#6366f1" } = props;
  if (width <= 0 || height <= 0) return null;
  const stripeW = 4;
  const gap = 3;
  const step = stripeW + gap;
  const count = Math.max(1, Math.floor(width / step));
  const used = count * step - gap;
  const offset = Math.max(0, (width - used) / 2);
  return (
    <g>
      {/* Invisible hit target — keeps the full bar clickable for
          parity with the project-level leaderboard. */}
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

/* ─────────── Y-axis tick ─────────── */

function SegmentTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const { x = 0, y = 0, payload } = props;
  const value = String(payload?.value ?? "");
  const safeLeft = 4;
  const safeRight = 12;
  const foX = safeLeft;
  const foWidth = Math.max(0, x - safeLeft - safeRight);
  const blockHeight = 36;
  return (
    <foreignObject
      x={foX}
      y={y - blockHeight / 2}
      width={foWidth}
      height={blockHeight}
      style={{ overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          color: "var(--foreground)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </foreignObject>
  );
}

/* ─────────── Component ─────────── */

/**
 * Segment-level executive leaderboard. Same 4-board taxonomy as the
 * project-level "Kral Projeler" panel, but rows roll up by `segment`.
 * Project counts ride along in the tooltip so the user can see how
 * many projects feed each segment row.
 *
 * Period scope is inherited from the dashboard top-right Filtre —
 * `projects` arrives already scoped, then we group by segment.
 */
export function LeaderboardSegmentsPanel({
  projects,
}: LeaderboardSegmentsPanelProps) {
  const [board, setBoard] = React.useState<BoardKey>("top-sales");
  const config = BOARDS.find((b) => b.key === board) ?? BOARDS[0];

  const data: ChartRow[] = React.useMemo(() => {
    const rollups = aggregateBySegment(projects);
    return config.build(rollups);
  }, [projects, config]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <HugeiconsIcon
            icon={DashboardCircleIcon}
            size={20}
            strokeWidth={1.75}
            className="shrink-0"
            style={{ color: "#6366f1" }}
          />
          Kral Segmentler
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
                <span className="truncate">{b.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {config.emptyMessage}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: Math.max(280, data.length * 44) }}
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
                width={200}
                interval={0}
                tick={<SegmentTick />}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    nameKey="value"
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as ChartRow | undefined;
                      if (!row) return "";
                      return row.segment;
                    }}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as ChartRow | undefined;
                      if (!row) return [String(value), ""];
                      return [
                        config.formatValue(Number(value), row),
                        `${row.projectCount} proje`,
                      ];
                    }}
                  />
                }
              />
              <Bar dataKey="value" shape={<StripedBar />}>
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
