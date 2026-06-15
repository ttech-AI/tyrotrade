import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  Download01Icon,
  AlertCircleIcon,
  Database02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useEntityRows } from "@/hooks/useEntityRows";
import { shouldUseMock } from "@/lib/dataverse";
import type { InspectorEntityConfig } from "@/lib/dataverse/entityConfig";
import {
  getFormattedValue,
  isFormattedValueKey,
} from "@/lib/dataverse/formatted";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/LanguageProvider";

interface EntityInspectorProps {
  config: InspectorEntityConfig;
}

/**
 * Generic per-entity inspector — drives one tab in DataManagementPage.
 *
 * Behavior:
 *   - On mount: hydrates from `localStorage` (if previously fetched).
 *   - "Verileri Güncelle" button → walks all pages, persists to cache.
 *   - Shows row count, fetchedAt timestamp, fields discovered, table preview,
 *     raw-JSON viewer for the selected row.
 */
export function EntityInspector({ config }: EntityInspectorProps) {
  const t = useT();
  const filter = config.defaultFilter?.();

  const {
    rows,
    totalCount,
    fetchedAt,
    loaded,
    isFetching,
    isError,
    error,
    refetch,
  } = useEntityRows({
    entitySet: config.entitySet,
    query: {
      ...(filter ? { $filter: filter } : {}),
      $count: true,
    },
  });

  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number | null>(
    rows.length > 0 ? 0 : null
  );

  // Reset selection when entity changes or fresh data arrives
  React.useEffect(() => {
    setSelectedRowIndex(rows.length > 0 ? 0 : null);
  }, [config.entitySet, fetchedAt, rows.length]);

  const fields = React.useMemo(() => {
    if (rows.length === 0) return [];
    // Same useful-only logic as EntityRowsTable: only keep keys that have at
    // least one non-empty value across the loaded dataset.
    const useful = new Set<string>();
    for (const row of rows) {
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (k.startsWith("@") || isFormattedValueKey(k)) continue;
        if (useful.has(k)) continue;
        if (v !== null && v !== undefined && v !== "") {
          useful.add(k);
        }
      }
    }
    return [...useful].sort();
  }, [rows]);

  const selectedRow =
    selectedRowIndex !== null ? rows[selectedRowIndex] : null;

  function handleExportCsv() {
    if (rows.length === 0) return;
    const csv = toCSV(rows as Record<string, unknown>[], fields);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.key}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Toolbar */}
      <GlassPanel tone="default" className="rounded-2xl shrink-0">
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {shouldUseMock() ? t("dm.inspector.mock") : t("dm.inspector.live")}
            </div>
            <div className="text-sm font-semibold truncate">
              {config.labelKey ? t(config.labelKey) : config.label}
            </div>
            <div className="text-[10.5px] text-muted-foreground truncate">
              <code className="font-mono">{config.entitySet}</code>
              {filter && (
                <>
                  {" · "}
                  <code className="font-mono">$filter={filter}</code>
                </>
              )}
            </div>
            {(config.hintKey || config.hint) && (
              <div className="text-[10.5px] text-muted-foreground/80 mt-1 italic">
                {config.hintKey ? t(config.hintKey) : config.hint}
              </div>
            )}
            <CacheStatus
              fetchedAt={fetchedAt}
              isFetching={isFetching}
              loaded={loaded}
              count={rows.length}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="gap-1.5"
              >
                <HugeiconsIcon
                  icon={Download01Icon}
                  size={14}
                  strokeWidth={2}
                />
                CSV
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={14}
                strokeWidth={2}
                className={cn(isFetching && "animate-spin")}
              />
              {isFetching
                ? loaded !== null
                  ? `${t("dm.inspector.loading")} ${loaded.toLocaleString("tr-TR")}`
                  : t("dm.inspector.loading")
                : t("dm.inspector.refresh")}
            </Button>
          </div>
        </div>
      </GlassPanel>

      {/* Error */}
      {isError && (
        <GlassPanel tone="default" className="rounded-2xl shrink-0">
          <div className="p-4 flex items-start gap-3 text-rose-700">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={18}
              strokeWidth={2}
              className="shrink-0 mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t("dm.inspector.error")}</div>
              <div className="text-[11.5px] text-rose-700/80 break-words">
                {error?.message ?? t("dm.inspector.errorUnknown")}
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Empty state */}
      {!isError && !isFetching && rows.length === 0 && (
        <GlassPanel
          tone="default"
          className="rounded-2xl flex-1 grid place-items-center"
        >
          <div className="text-center text-sm text-muted-foreground p-10 max-w-md">
            <HugeiconsIcon
              icon={Database02Icon}
              size={36}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-muted-foreground/60"
            />
            <div className="text-[13px] font-semibold text-foreground mb-1">
              {t("dm.inspector.emptyTitle")}
            </div>
            <p className="text-[11.5px]">
              <span className="font-semibold">
                {t("dm.inspector.emptyBodyLead")}
              </span>
              {t("dm.inspector.emptyBodyTail")}
              <br />
              {t("dm.inspector.emptyBodyCache")}
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Data view: table + detail */}
      {rows.length > 0 && (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: row list */}
          <GlassPanel
            tone="default"
            className="rounded-2xl col-span-12 lg:col-span-5 xl:col-span-4 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-foreground/[0.06] flex items-center justify-between">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dm.inspector.rows")}
              </div>
              <div className="text-[10.5px] tabular-nums text-muted-foreground">
                <span className="font-bold text-foreground">{rows.length}</span>
                {totalCount !== undefined && totalCount > rows.length && (
                  <span> / {totalCount}</span>
                )}
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {rows.map((row, i) => (
                <RowItem
                  key={i}
                  row={row as Record<string, unknown>}
                  index={i}
                  selected={selectedRowIndex === i}
                  onSelect={() => setSelectedRowIndex(i)}
                />
              ))}
            </div>
          </GlassPanel>

          {/* Right: detail panel */}
          <GlassPanel
            tone="default"
            className="rounded-2xl col-span-12 lg:col-span-7 xl:col-span-8 overflow-hidden"
          >
            <DetailPanel row={selectedRow} fields={fields} />
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

/* ─────────── Cache status ─────────── */

function CacheStatus({
  fetchedAt,
  isFetching,
  loaded,
  count,
}: {
  fetchedAt: string | null;
  isFetching: boolean;
  loaded: number | null;
  count: number;
}) {
  const t = useT();
  if (!fetchedAt && !isFetching) return null;

  const ago = fetchedAt ? humanAgo(new Date(fetchedAt), t) : null;

  return (
    <div className="text-[10.5px] text-muted-foreground/80 mt-1 flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          isFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
        )}
      />
      {isFetching ? (
        <>
          {loaded !== null ? (
            <>{t("dm.inspector.paginationLead")} <span className="tabular-nums font-medium">{loaded.toLocaleString("tr-TR")}</span> {t("dm.inspector.recordsFetched")}</>
          ) : (
            t("dm.inspector.connecting")
          )}
        </>
      ) : (
        <>
          {t("dm.inspector.lastUpdate")} <span className="font-medium">{ago}</span> ·{" "}
          <span className="tabular-nums font-medium">
            {count.toLocaleString("tr-TR")}
          </span>{" "}
          {t("dm.inspector.recordsCached")}
        </>
      )}
    </div>
  );
}

function humanAgo(d: Date, t: (key: string) => string): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return t("dm.ago.now");
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${t("dm.ago.minutes")}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t("dm.ago.hours")}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ${t("dm.ago.days")}`;
  return d.toLocaleDateString("tr-TR");
}

/* ─────────── Row list item ─────────── */

function RowItem({
  row,
  index,
  selected,
  onSelect,
}: {
  row: Record<string, unknown>;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const primary = pickPrimaryLabel(row);
  const secondary = pickSecondaryLabel(row, primary.key);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-2.5 border-b border-foreground/[0.04] transition-colors",
        "hover:bg-foreground/[0.04]",
        selected && "bg-foreground/[0.06]"
      )}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono text-muted-foreground tabular-nums">
          #{index + 1}
        </span>
        <span className="truncate font-medium text-foreground">
          {String(primary.value ?? "—")}
        </span>
      </div>
      {secondary && (
        <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">
          {String(secondary.value ?? "—")}
        </div>
      )}
    </button>
  );
}

function pickPrimaryLabel(row: Record<string, unknown>): {
  key: string;
  value: unknown;
} {
  // Tiryaki F&O field hierarchy — actual mserp_* names from production tenant.
  // Each entity tends to have one "name-ish" field, fall through.
  const candidates = [
    "mserp_projname", // Project (e.g. "RED SEA - 30.000MT SORGHUM")
    "mserp_projid", // Project ID (e.g. "MESTHL00368")
    "mserp_vesselname", // Ship relation
    "mserp_assignmentid", // Fixture ID
    "mserp_primaryfield", // Most lines have this composite label
    "mserp_segment",
    "mserp_tryexpensetype",
    "mserp_refexpenseid",
    "mserp_projectexpenseid",
    "name",
    "Name",
    "id",
    "Id",
  ];
  for (const k of candidates) {
    if (k in row && row[k] != null && row[k] !== "") {
      return { key: k, value: row[k] };
    }
  }
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && v.length > 0 && !k.startsWith("@")) {
      return { key: k, value: v };
    }
  }
  const firstKey = Object.keys(row)[0];
  return { key: firstKey, value: row[firstKey] };
}

function pickSecondaryLabel(
  row: Record<string, unknown>,
  excludeKey: string
): { key: string; value: unknown } | null {
  // Prefer ID-ish or descriptive secondaries
  const preferred = [
    "mserp_projid",
    "mserp_tryshipprojid",
    "mserp_tryplanprojectid",
    "mserp_etgtryprojid",
    "mserp_segment",
    "mserp_year",
    "mserp_currencycode",
    "mserp_dlvmode",
    "mserp_projgroupid",
  ];
  for (const k of preferred) {
    if (k === excludeKey) continue;
    if (k in row && row[k] != null && row[k] !== "") {
      return { key: k, value: row[k] };
    }
  }
  for (const [k, v] of Object.entries(row)) {
    if (k === excludeKey) continue;
    if (k.startsWith("@") || k.endsWith("FormattedValue")) continue;
    if (typeof v === "string" && v.length > 0 && v.length < 80) {
      return { key: k, value: v };
    }
  }
  return null;
}

/* ─────────── Detail panel ─────────── */

function DetailPanel({
  row,
  fields,
}: {
  row: Record<string, unknown> | null;
  fields: string[];
}) {
  const t = useT();
  const [tab, setTab] = React.useState<"fields" | "json">("fields");

  if (!row) {
    return (
      <div className="grid place-items-center h-full text-sm text-muted-foreground p-10">
        {t("dm.inspector.selectRow")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2.5 border-b border-foreground/[0.06] flex items-center justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("dm.inspector.recordDetail")} · {fields.length} {t("dm.inspector.fields")}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("fields")}
            className={cn(
              "h-6 px-2 rounded-md text-[10.5px] font-semibold transition-colors",
              tab === "fields"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/[0.06]"
            )}
          >
            {t("dm.inspector.tabFields")}
          </button>
          <button
            type="button"
            onClick={() => setTab("json")}
            className={cn(
              "h-6 px-2 rounded-md text-[10.5px] font-semibold transition-colors",
              tab === "json"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/[0.06]"
            )}
          >
            {t("dm.inspector.tabJson")}
          </button>
        </div>
      </div>

      {tab === "fields" ? (
        <div className="overflow-y-auto flex-1 p-1">
          {fields.map((f) => (
            <FieldRow
              key={f}
              fieldName={f}
              value={row[f]}
              formatted={getFormattedValue(row, f)}
            />
          ))}
        </div>
      ) : (
        <pre className="overflow-auto flex-1 text-[11px] font-mono p-4 leading-relaxed">
          {JSON.stringify(row, null, 2)}
        </pre>
      )}
    </div>
  );
}

function FieldRow({
  fieldName,
  value,
  formatted,
}: {
  fieldName: string;
  value: unknown;
  formatted?: string;
}) {
  const isOdataAnnotation = fieldName.includes("@odata");
  const isNull = value === null || value === undefined;
  // Empty / null values render as a blank cell — the field name still
  // shows the schema slot, but no "null" placeholder text appears.
  const valueText = isNull
    ? ""
    : typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(180px,2fr)_minmax(0,3fr)] gap-3 items-start px-3 py-1.5 rounded-md",
        "hover:bg-foreground/[0.03]",
        isOdataAnnotation && "opacity-60"
      )}
    >
      <code
        className={cn(
          "font-mono text-[11px] leading-snug break-all",
          isOdataAnnotation
            ? "text-muted-foreground"
            : "text-foreground/85 font-medium"
        )}
      >
        {fieldName}
      </code>
      <div className="flex items-baseline gap-2 min-w-0">
        {formatted ? (
          <>
            <span className="font-sans font-semibold text-[11.5px] text-foreground truncate">
              {formatted}
            </span>
            {!isNull && (
              <code className="font-mono text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                {valueText}
              </code>
            )}
          </>
        ) : (
          !isNull && (
            <code className="font-mono text-[11px] leading-snug break-all text-foreground">
              {valueText}
            </code>
          )
        )}
      </div>
    </div>
  );
}

/* ─────────── CSV ─────────── */

function toCSV(
  rows: Record<string, unknown>[],
  fields: string[]
): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = fields.join(",");
  const body = rows
    .map((r) => fields.map((f) => escape(r[f])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
