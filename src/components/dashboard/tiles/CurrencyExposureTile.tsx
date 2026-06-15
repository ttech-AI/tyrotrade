import * as React from "react";
import { MoneyExchange01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { TONE_CURRENCY } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  aggregateCurrencyExposure,
  type CurrencyCode,
} from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CurrencyExposureTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

const ORDER: CurrencyCode[] = ["USD", "EUR", "TRY", "OTHER"];

/** Per-currency stop index into `accent.stops` — each currency picks a
 *  distinct colour from the live theme palette (light → mid → deep)
 *  so USD/EUR/TRY read as visibly different bars even though they
 *  belong to the same theme. OTHER reuses the lightest stop. */
const STOP_INDEX: Record<CurrencyCode, 0 | 1 | 2> = {
  USD: 2, // deep / dominant
  EUR: 1, // mid
  TRY: 0, // light
  OTHER: 0,
};

/**
 * Currency exposure tile — counts of projects per pricing currency
 * (USD/EUR/TRY/OTHER), with a concentration index (HHI) so the user
 * sees how diversified the FX-risk portfolio is.
 *
 * No FX conversion — sums are kept in their native currency to avoid
 * introducing fake precision (Tiryaki has no in-app rate table yet).
 */
export function CurrencyExposureTile({
  projects,
  span,
  rowSpan,
  onClick,
}: CurrencyExposureTileProps) {
  const accent = useThemeAccent();
  const t = useT();
  const exposure = React.useMemo(
    () => aggregateCurrencyExposure(projects),
    [projects]
  );

  // Convert HHI 0..1 to a "diversification score" — closer to 1/n is
  // healthier (n=4 here → ideal HHI = 0.25). We display the raw
  // concentration index for reading, but flag any single-currency
  // dominance > 70%.
  const dominantShare =
    exposure.totalProjects > 0
      ? exposure.byCurrency[exposure.dominant].count / exposure.totalProjects
      : 0;

  return (
    <BentoTile
      title={t("dash.tile.currency.title")}
      subtitle={t("dash.tile.currency.subtitle")}
      icon={MoneyExchange01Icon}
      iconTone={TONE_CURRENCY}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full">
        {/* Dominant currency callout */}
        <div
          className="flex items-baseline gap-2"
          title={t("dash.tile.currency.dominantTip")
            .replace("{currency}", exposure.dominant)
            .replace(
              "{count}",
              String(exposure.byCurrency[exposure.dominant].count)
            )
            .replace("{pct}", (dominantShare * 100).toFixed(1))}
        >
          {/* Dominant code reads in the live sidebar accent so the
              tile's primary number tracks light/navy/black themes.
              Per-currency bars below keep their semantic palette so
              the user can still tell USD from EUR from TRY at a
              glance. */}
          <span
            className="text-[24px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: accent.solid }}
          >
            {exposure.dominant}
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: accent.stops[2], opacity: 0.75 }}
          >
            {(dominantShare * 100).toFixed(0)}% {t("dash.tile.currency.dominant")}
          </span>
        </div>

        {/* Per-currency breakdown bars */}
        <div className="mt-auto flex flex-col gap-1.5">
          {ORDER.map((c) => {
            const cnt = exposure.byCurrency[c].count;
            if (cnt === 0) return null;
            const pct =
              exposure.totalProjects > 0
                ? (cnt / exposure.totalProjects) * 100
                : 0;
            return (
              <div
                key={c}
                className="min-w-0"
                title={t("dash.tile.currency.barTip")
                  .replace("{currency}", c)
                  .replace("{count}", String(cnt))
                  .replace("{pct}", pct.toFixed(1))}
              >
                <div className="flex items-baseline justify-between gap-2 text-[10.5px] mb-0.5">
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: accent.stops[STOP_INDEX[c]] }}
                  >
                    {c}
                  </span>
                  <span className="tabular-nums font-medium text-foreground/70">
                    {t("dash.tile.currency.projectsPct")
                      .replace("{count}", String(cnt))
                      .replace("{pct}", pct.toFixed(0))}
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  style={{
                    background: "rgba(15,23,42,0.06)",
                    boxShadow:
                      "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
                  }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(180deg, ${accent.stops[STOP_INDEX[c]]} 0%, ${accent.stops[STOP_INDEX[c]]} 55%, color-mix(in oklab, ${accent.stops[STOP_INDEX[c]]} 75%, black 25%) 100%)`,
                      opacity: c === "OTHER" ? 0.6 : 1,
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Concentration warning when HHI is high */}
        {dominantShare > 0.7 && (
          <div className="text-[9.5px] text-amber-700 italic mt-1">
            {t("dash.tile.currency.concentrationWarn").replace(
              "{pct}",
              (dominantShare * 100).toFixed(0)
            )}
          </div>
        )}
      </div>
    </BentoTile>
  );
}
