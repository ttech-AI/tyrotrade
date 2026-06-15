import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { TONE_EXPENSE } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import { formatCompactCurrency } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedExpenseTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

type BucketKey = "freight" | "opex" | "other";

interface BucketStat {
  key: BucketKey;
  label: string;
  /** Distinct stop colour from the live theme palette — three values
   *  so the three buckets can read as separate segments. */
  color: string;
  value: number;
}

/**
 * Tahmini Gider tile — sums `costEstimateLines.totalUsd` across the same
 * project subset the K&Z tile uses (projects with priced lines on either
 * side). Both tiles share scope so the totals reconcile to the cent.
 * Expenses are always denoted in USD per the F&O entity model
 * (`mserp_expamountusdd`), so no FX conversion is needed here.
 *
 * Three executive buckets:
 *   - **Freight** — names matching "freight" / "navlun"
 *   - **Opex**    — names matching "opex" / "operasyonel"
 *   - **Other**   — everything else (insurance, customs, port charges, …)
 *
 * Domain colour: rose (cost / drag on margin).
 */
export function EstimatedExpenseTile({
  projects,
  span,
  rowSpan,
  onClick,
}: EstimatedExpenseTileProps) {
  const reduce = useReducedMotion();
  const accent = useThemeAccent();
  const t = useT();
  const { buckets, contributingCount } = React.useMemo(() => {
    let freight = 0;
    let opex = 0;
    let other = 0;
    let contributingCount = 0;
    for (const p of projects) {
      const pl = selectProjectPL(p);
      // Same scope as aggregateEstimatedPL — projects with at least one
      // priced line. Currency doesn't matter because expenses are
      // already stored in USD by the composer.
      if (pl.salesTotal <= 0 && pl.purchaseTotal <= 0) continue;
      const lines = p.costEstimateLines;
      if (!lines) continue;
      contributingCount++;
      for (const l of lines) {
        if (!l.totalUsd) continue;
        const n = (l.name ?? "").toLowerCase();
        if (n.includes("freight") || n.includes("navlun")) {
          freight += l.totalUsd;
        } else if (n.includes("opex") || n.includes("operasyonel")) {
          opex += l.totalUsd;
        } else {
          other += l.totalUsd;
        }
      }
    }
    // Each bucket pulls a distinct stop from the live theme palette —
    // light sky / mid blue / deep navy in light mode, light/mid/deep
    // gold in navy mode, etc. Three real colours instead of one tone
    // with stepped opacity, so freight/opex/other read as visibly
    // different segments while still belonging to the same theme.
    const buckets: BucketStat[] = [
      {
        key: "freight",
        label: "Freight",
        color: accent.stops[2], // deepest — matches the heaviest bucket
        value: freight,
      },
      {
        key: "opex",
        label: "Opex",
        color: accent.stops[1], // mid
        value: opex,
      },
      {
        key: "other",
        label: "Other",
        color: accent.stops[0], // lightest
        value: other,
      },
    ];
    return { buckets, contributingCount };
  }, [projects, accent.stops]);

  const total = buckets.reduce((s, b) => s + b.value, 0);

  return (
    <BentoTile
      title={t("dash.tile.expense.title")}
      subtitle={t("dash.tile.expense.subtitle").replace(
        "{count}",
        String(contributingCount)
      )}
      icon={Wallet01Icon}
      iconTone={TONE_EXPENSE}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      {/*
        Layout mirrors ActivePipelineTile (sibling on the same row): same
        outer `flex-col gap-3`, same headline size (40px primary + 11px
        supporting label, baseline-aligned), same `mt-auto` bar block,
        same single-row inline legend. When the two tiles sit side-by-
        side the headlines, bars, and legend rows all read on the same
        horizontal Y — symmetric.
      */}
      <div className="flex flex-col gap-3 h-full">
        <div
          className="flex items-baseline gap-3"
          title={t("dash.tile.expense.headlineTip")
            .replace("{amount}", formatCompactCurrency(total, "USD"))
            .replace("{count}", String(contributingCount))}
        >
          {/* 30px sits between the original 26px and Pipeline's 40px —
              "80,3 Mn $" carries more characters than Pipeline's bare
              "90", so matching 40px exactly made the rose ink dominate
              the small tile. 30px keeps the headline readable next to
              "toplam gider" without overpowering the legend below. */}
          {/* Headline number tracks the live sidebar accent so the
              KPI's primary number adapts to light/navy/black themes.
              The 3-bucket stacked bar below keeps its semantic palette
              (Freight orange / Opex purple / Other slate) — those
              colours encode bucket meaning and shouldn't collapse to
              one accent. */}
          <span
            className="text-[30px] font-semibold leading-none tracking-tight"
            style={{ color: accent.solid }}
          >
            <AnimatedNumber value={total} preset="currency" currency="USD" />
          </span>
          {/* Supporting label — uses the deep theme stop at 75% so it
              reads cleanly without going faded-grey. The user
              explicitly asked for accompanying text to stay readable
              even when it's a sub-cue. */}
          <span
            className="text-[11px] font-medium"
            style={{ color: accent.stops[2], opacity: 0.75 }}
          >
            {t("dash.tile.expense.totalLabel")}
          </span>
        </div>

        {/* Stacked bar — 3 segments, glossy gradient + inset highlight */}
        {total > 0 ? (
          <div className="mt-auto flex flex-col gap-2">
            <div
              className="relative h-2.5 w-full rounded-full overflow-hidden"
              style={{
                background: "rgba(15,23,42,0.06)",
                boxShadow:
                  "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
              }}
            >
              {buckets.map((b, i) => {
                const offset = buckets
                  .slice(0, i)
                  .reduce(
                    (acc, prev) => acc + (prev.value / total) * 100,
                    0
                  );
                const pct = (b.value / total) * 100;
                if (pct === 0) return null;
                return (
                  <motion.span
                    key={b.key}
                    initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.55,
                      delay: 0.1 + i * 0.07,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${offset}%`,
                      background: `linear-gradient(180deg, ${b.color} 0%, ${b.color} 55%, color-mix(in oklab, ${b.color} 75%, black 25%) 100%)`,
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                    title={t("dash.tile.expense.shareTip")
                      .replace("{label}", b.label)
                      .replace("{amount}", formatCompactCurrency(b.value, "USD"))
                      .replace("{pct}", pct.toFixed(1))}
                  />
                );
              })}
            </div>
            {/* Single-row inline legend — dot · label · value, identical
                structural classes to ActivePipelineTile so labels and
                percent values land on the same baseline across the two
                tiles. Value keeps the bucket colour for semantic
                emphasis (vs Pipeline's neutral foreground). */}
            <div className="flex items-center justify-between gap-2 text-[10.5px] flex-wrap">
              {buckets.map((b) => {
                const pct = (b.value / total) * 100;
                return (
                  <div
                    key={b.key}
                    className="flex items-center gap-1.5 min-w-0 truncate"
                    title={t("dash.tile.expense.legendTip")
                      .replace("{label}", b.label)
                      .replace("{amount}", formatCompactCurrency(b.value, "USD"))
                      .replace("{pct}", pct.toFixed(1))}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <span
                      className="truncate font-medium"
                      style={{ color: "rgb(51 65 85)" }}
                    >
                      {b.label}
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: b.color }}
                    >
                      %{pct.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            {t("dash.tile.expense.empty")}
          </div>
        )}
      </div>
    </BentoTile>
  );
}
