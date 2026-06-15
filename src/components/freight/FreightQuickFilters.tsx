import * as React from "react";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import type {
  FreightFilterState,
  FreightOptions,
} from "@/lib/filters/freightFilters";

/** Stable aria-labelledby seed (avoids useId per column). */
let comboLabelCounter = 0;

interface FreightQuickFiltersProps {
  options: FreightOptions;
  filters: FreightFilterState;
  onChange: (next: FreightFilterState) => void;
}

/**
 * Fiyat Takibi quick-filter row — five compact multiselect comboboxes:
 * Yükleme Limanı, Boşaltma Limanı, Gemi Tipi, Gemi Sınıfı, Kargo. Mirrors
 * the Trade Cost quick-filter dialect (small uppercase label above an h-9
 * compact combobox). Options are derived from the full row set (page-level)
 * so picking one value never prunes the others away.
 */
export function FreightQuickFilters({
  options,
  filters,
  onChange,
}: FreightQuickFiltersProps) {
  const accent = useThemeAccent();
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("ft.search.label")}
      className="flex items-end gap-2.5 flex-wrap min-w-0 flex-1"
    >
      <Combo
        label={t("ft.filter.loadingPort")}
        options={options.loadingPorts}
        selected={filters.loadingPorts}
        onChange={(next) => onChange({ ...filters, loadingPorts: next })}
        accent={accent}
        searchPlaceholder={t("ft.filter.searchPort")}
      />
      <Combo
        label={t("ft.filter.dischargePort")}
        options={options.dischargePorts}
        selected={filters.dischargePorts}
        onChange={(next) => onChange({ ...filters, dischargePorts: next })}
        accent={accent}
        searchPlaceholder={t("ft.filter.searchPort")}
      />
      <Combo
        label={t("ft.filter.vesselType")}
        options={options.vesselTypes}
        selected={filters.vesselTypes}
        onChange={(next) => onChange({ ...filters, vesselTypes: next })}
        accent={accent}
        searchPlaceholder={t("ft.filter.searchVesselType")}
      />
      <Combo
        label={t("ft.filter.shipClass")}
        options={options.shipSizeCategories}
        selected={filters.shipSizeCategories}
        onChange={(next) =>
          onChange({ ...filters, shipSizeCategories: next })
        }
        accent={accent}
        searchPlaceholder={t("ft.filter.searchShipClass")}
      />
      <Combo
        label={t("ft.filter.cargo")}
        options={options.cargoGoods}
        selected={filters.cargoGoods}
        onChange={(next) => onChange({ ...filters, cargoGoods: next })}
        accent={accent}
        searchPlaceholder={t("ft.filter.searchCargo")}
      />
    </div>
  );
}

function Combo({
  label,
  options,
  selected,
  onChange,
  accent,
  searchPlaceholder,
}: {
  label: string;
  options: ReadonlyArray<string>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  accent: { solid: string; ring: string; tint: string };
  searchPlaceholder: string;
}) {
  const idRef = React.useRef<string>("");
  if (!idRef.current) {
    comboLabelCounter += 1;
    idRef.current = `freight-combo-label-${comboLabelCounter}`;
  }
  const hasSelection = selected.size > 0;
  const t = useT();
  return (
    <div className="flex flex-col min-w-[132px] max-w-[180px]">
      <span
        id={idRef.current}
        className="text-[10.5px] font-bold uppercase tracking-wider leading-none mb-1.5 px-0.5 transition-colors"
        style={{
          color: hasSelection ? accent.solid : "rgba(15, 23, 42, 0.78)",
        }}
      >
        {label}
      </span>
      <MultiSelectCombobox
        options={options}
        selected={selected}
        onChange={onChange}
        accent={accent}
        placeholder={t("common.all")}
        searchPlaceholder={searchPlaceholder}
        triggerClassName="text-[12.5px]"
        triggerAriaLabelledBy={idRef.current}
        compact
      />
    </div>
  );
}
