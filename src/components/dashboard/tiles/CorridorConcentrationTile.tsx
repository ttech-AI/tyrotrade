import * as React from "react";
import { Route01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { TONE_CORRIDOR } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { aggregateByCorridor } from "@/lib/selectors/aggregate";
import type { Project } from "@/lib/dataverse/entities";

interface CorridorConcentrationTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

/**
 * Corridor concentration — the top loading→discharge corridors plus a
 * Herfindahl–Hirschman index of how concentrated the route portfolio is.
 *
 * HHI thresholds (commodity trading benchmark):
 *   < 0.15  diversified
 *   0.15-0.25  moderately concentrated
 *   > 0.25  critical concentration (single-corridor risk)
 */
export function CorridorConcentrationTile({
  projects,
  span,
  rowSpan,
  onClick,
}: CorridorConcentrationTileProps) {
  const accent = useThemeAccent();
  const t = useT();
  const corridors = React.useMemo(() => aggregateByCorridor(projects), [projects]);
  const totalRoutedProjects = React.useMemo(
    () => corridors.reduce((sum, c) => sum + c.count, 0),
    [corridors]
  );
  // HHI on corridor counts
  const hhi = React.useMemo(() => {
    if (totalRoutedProjects === 0) return 0;
    let sum = 0;
    for (const c of corridors) {
      const share = c.count / totalRoutedProjects;
      sum += share * share;
    }
    return sum;
  }, [corridors, totalRoutedProjects]);
  const top3 = corridors.slice(0, 3);

  const concentrationLabel =
    hhi < 0.15
      ? t("dash.tile.corridor.diverse")
      : hhi < 0.25
        ? t("dash.tile.corridor.moderate")
        : t("dash.tile.corridor.heavy");
  return (
    <BentoTile
      title={t("dash.tile.corridor.title")}
      subtitle={t("dash.tile.corridor.subtitle")}
      icon={Route01Icon}
      iconTone={TONE_CORRIDOR}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full">
        <div
          className="flex items-baseline gap-2"
          title={t("dash.tile.corridor.hhiTip")}
        >
          {/* HHI number tracks the sidebar accent. The secondary
              "Çeşitli / Orta / Yoğun" label keeps its status palette
              so the at-a-glance health cue (green=good, amber=watch,
              rose=critical) survives the theme swap. */}
          {/* Both the HHI value and the "Çeşitli/Orta/Yoğun" label
              now sit on the live sidebar accent. The status nuance is
              still hinted via opacity (lighter for the secondary
              label) but the colour family is unified — keeps the tile
              tonally clean across the three sidebar themes. */}
          <span
            className="text-[24px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: accent.solid }}
          >
            {(hhi * 100).toFixed(0)}
          </span>
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: accent.solid, opacity: 0.65 }}
          >
            {concentrationLabel}
          </span>
        </div>

        {top3.length > 0 ? (
          <div className="mt-auto flex flex-col gap-1">
            {top3.map((c, idx) => {
              const pct =
                totalRoutedProjects > 0
                  ? (c.count / totalRoutedProjects) * 100
                  : 0;
              return (
                <div
                  key={`${c.loadingPort}-${c.dischargePort}`}
                  className="flex items-baseline justify-between gap-2 text-[10.5px] min-w-0"
                  title={t("dash.tile.corridor.rowTip")
                    .replace("{rank}", String(idx + 1))
                    .replace("{lp}", c.loadingPort)
                    .replace("{dp}", c.dischargePort)
                    .replace("{count}", String(c.count))
                    .replace("{pct}", pct.toFixed(1))}
                >
                  <span className="truncate min-w-0 flex-1">
                    <span
                      className="tabular-nums mr-1.5 font-semibold"
                      style={{ color: accent.solid, opacity: 0.7 }}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-foreground/90 font-medium">
                      {c.loadingPort}
                    </span>
                    <span className="text-foreground/55"> → </span>
                    <span className="text-foreground/90 font-medium">
                      {c.dischargePort}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-foreground/75">
                    {c.count} · {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-auto text-[10.5px] text-muted-foreground/70">
            {t("dash.tile.corridor.empty")}
          </div>
        )}
      </div>
    </BentoTile>
  );
}
