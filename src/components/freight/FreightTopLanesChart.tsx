import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatFreightRate, formatNumber } from "@/lib/format";
import type { FreightLane } from "@/lib/selectors/freight";
import { useT } from "@/lib/i18n/LanguageProvider";
import { Header } from "./FreightTrendChart";

const CHART_CONFIG: ChartConfig = { value: { label: "Güncel Navlun" } };

interface LaneDatum {
  key: string;
  name: string;
  ship: string;
  cargo: string;
  value: number;
  currency: string;
}

/**
 * Hat Bazında Güncel Navlun — horizontal bars of the priciest lanes by
 * current rate (mirrors the actual Power BI's "Top 10"). Bars are
 * clickable: selecting one opens that lane's detail panel.
 */
export function FreightTopLanesChart({
  lanes,
  onSelectLane,
}: {
  lanes: FreightLane[];
  onSelectLane?: (laneKey: string) => void;
}) {
  const t = useT();
  const accent = useThemeAccent();
  const data: LaneDatum[] = lanes.map((l) => ({
    key: l.laneKey,
    name: l.routeLabel,
    ship: l.shipSizeCategory,
    cargo: l.cargoGood,
    value: Number((l.currentPrice ?? 0).toFixed(2)),
    currency: l.currency,
  }));
  // Tallness scales with row count so 10 bars don't squash into 3 lanes.
  const rowH = 30;

  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <Header
        title={t("ft.chart.topLanes")}
        sub={`${t("ft.chart.topLanes.subA")} ${data.length} ${t("ft.chart.topLanes.subB")}`}
        solid={accent.solid}
      />
      <div className="flex-1 min-h-0 px-2 pb-2 overflow-hidden">
        {data.length === 0 ? (
          <div className="h-full min-h-[160px] grid place-items-center">
            <p className="text-[12.5px] text-muted-foreground">
              {t("ft.chart.noLanes")}
            </p>
          </div>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="w-full aspect-auto"
            style={{ height: Math.max(160, data.length * rowH + 24) }}
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 52, bottom: 4, left: 4 }}
              barCategoryGap={6}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={148}
                tickLine={false}
                axisLine={false}
                tick={<TruncTick />}
                interval={0}
              />
              <RTooltip
                cursor={{ fill: "rgba(15,23,42,0.04)" }}
                content={<LaneTooltip />}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 4, 4]}
                maxBarSize={18}
                onClick={(d) => {
                  const datum = d as unknown as { key?: string };
                  if (datum.key && onSelectLane) onSelectLane(datum.key);
                }}
                className={onSelectLane ? "cursor-pointer" : undefined}
              >
                {data.map((d, i) => (
                  <Cell
                    key={d.key}
                    fill={accent.stops[i % 2 === 0 ? 1 : 0]}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  className="fill-foreground"
                  fontSize={11}
                  fontWeight={700}
                  formatter={(value) => {
                    const n = Number(value);
                    return formatNumber(
                      Number.isFinite(n) ? n : 0,
                      n % 1 ? 1 : 0
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </GlassPanel>
  );
}

/** Y-axis tick that truncates long route labels to fit the gutter. */
function TruncTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, payload } = props;
  const raw = payload?.value ?? "";
  const text = raw.length > 22 ? `${raw.slice(0, 21)}…` : raw;
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="end"
      fontSize={10.5}
      className="fill-foreground/80"
    >
      {text}
    </text>
  );
}

function LaneTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LaneDatum }>;
}) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-white px-2.5 py-2 text-[11.5px] shadow-xl min-w-44">
      <div className="font-semibold text-foreground">{d.name}</div>
      <div className="text-[10.5px] text-muted-foreground mb-1">
        {[d.ship, d.cargo].filter(Boolean).join(" · ") || "—"}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("ft.chart.current")}</span>
        <span className="tabular-nums font-bold text-foreground">
          {formatFreightRate(d.value, d.currency)}
        </span>
      </div>
    </div>
  );
}
