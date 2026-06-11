/**
 * Excel (.xlsx) export for the Veri Yönetimi master caches.
 *
 * 🔒 Read-only — serialises rows that are ALREADY in localStorage /
 * memory; no Dataverse round-trip happens here.
 *
 * SheetJS is ~400 KB minified, so it is loaded lazily inside the export
 * call — users who never press "Excel" never download the chunk.
 */

import { getFieldLabel } from "@/lib/dataverse/fieldLabels";

export interface ExcelSheetSpec {
  /** Sheet tab name — sanitised + truncated to Excel's 31-char limit. */
  name: string;
  /** Raw OData rows (mserp_* keys + @FormattedValue annotations). */
  rows: Record<string, unknown>[];
  /** Column order — the same `$select` lists the inspector displays. */
  columns: readonly string[];
}

/** Excel forbids []:*?/\ in sheet names and caps them at 31 chars. */
function sanitiseSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sayfa";
}

/** Cell value for (row, column) — inspector parity rule:
 *  the Excel must show what the Veri Yönetimi table shows.
 *
 *  - Numeric raw + a LABEL-LIKE @FormattedValue (contains letters —
 *    option-set codes like 200000005 → "Açık", "Gemi", "Commenced")
 *    → the label wins. A formatted value that is just the localized
 *    rendering of the same number ("3.000.000,00") has no letters, so
 *    real amounts/quantities stay numeric and Excel can still sum them.
 *  - Booleans prefer their formatted "Evet/Hayır" label when present.
 *  - Strings (dates, ids) prefer the formatted form when present. */
function cellValue(
  row: Record<string, unknown>,
  col: string
): string | number | boolean {
  const raw = row[col];
  const formatted = row[`${col}@OData.Community.Display.V1.FormattedValue`];
  const labelLike =
    typeof formatted === "string" && /\p{L}/u.test(formatted);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return labelLike ? (formatted as string) : raw;
  }
  if (typeof raw === "boolean") {
    return labelLike ? (formatted as string) : raw;
  }
  const v = formatted ?? raw;
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Build a multi-sheet workbook and trigger the browser download.
 * Empty sheets are skipped ("dolu sekmeler" only). Header row uses the
 * Turkish field labels (`getFieldLabel`), falling back to the raw
 * mserp_* name when no label is mapped.
 *
 * Returns the number of sheets written (0 → nothing to export).
 */
export async function exportSheetsToExcel(
  sheets: ExcelSheetSpec[],
  fileNameBase: string
): Promise<number> {
  const nonEmpty = sheets.filter((s) => s.rows.length > 0);
  if (nonEmpty.length === 0) return 0;

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of nonEmpty) {
    const header = sheet.columns.map((c) => getFieldLabel(c) || c);
    const data = sheet.rows.map((r) =>
      sheet.columns.map((c) => cellValue(r, c))
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    // Reasonable default column widths — header length vs a sample of
    // the data, clamped so one long description doesn't blow the layout.
    ws["!cols"] = sheet.columns.map((_c, i) => {
      let w = header[i].length;
      for (const row of data.slice(0, 50)) {
        const len = String(row[i] ?? "").length;
        if (len > w) w = len;
      }
      return { wch: Math.min(Math.max(w + 2, 10), 44) };
    });
    // De-dupe sheet names after sanitisation (Excel requires unique).
    let name = sanitiseSheetName(sheet.name);
    let n = 2;
    while (usedNames.has(name)) {
      name = sanitiseSheetName(`${sheet.name} (${n})`);
      n += 1;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const stamp = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const fileName = `${fileNameBase}-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`;
  XLSX.writeFile(wb, fileName, { compression: true });
  return nonEmpty.length;
}
