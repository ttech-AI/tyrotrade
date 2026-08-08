import { RefreshCw } from "@/freight/icons";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

/**
 * Compact "Yenile / Gerçekleşeni hesapla" pill — shared header action for
 * the E.M Bakış cards (MonthlyPLChart, RealizedPLTable). Lives in the
 * tile header's right slot now that the icon leads on the left.
 */
export function RefreshButton({
  isFetching,
  hasRealizedCoverage,
  onRefresh,
}: {
  isFetching: boolean;
  hasRealizedCoverage: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isFetching}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        // Green signs the "live / realized data" action here, not an amount,
        // so this is --success rather than --pl-pos.
        "border border-border/60 bg-foreground/[0.03] hover:bg-foreground/[0.06] text-success",
        "transition-colors disabled:opacity-60 disabled:cursor-default"
      )}
    >
      <RefreshCw
        className={cn("size-3.5", isFetching && "animate-spin")}
        strokeWidth={2.25}
      />
      {isFetching
        ? t("dash.monthly.computing")
        : hasRealizedCoverage
          ? t("dash.monthly.refresh")
          : t("dash.monthly.compute")}
    </button>
  );
}
