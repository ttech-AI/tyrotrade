/**
 * Helpers for the OData annotation pattern that Dataverse uses to surface
 * human-readable values alongside raw codes / IDs.
 *
 *   "mserp_voyagestatus": 200000003,
 *   "mserp_voyagestatus@OData.Community.Display.V1.FormattedValue": "Completed"
 *
 * Pulled in via the `Prefer: odata.include-annotations="*"` request header
 * (set in `realClient.ts`). Available on every option set / lookup / numeric /
 * date field automatically — no extra metadata API call needed.
 */

const SUFFIX = "@OData.Community.Display.V1.FormattedValue";

/** Return the formatted (human-readable) value for a field if Dataverse
 *  attached one; otherwise undefined. */
export function getFormattedValue(
  row: Record<string, unknown>,
  fieldName: string
): string | undefined {
  const v = row[fieldName + SUFFIX];
  return typeof v === "string" ? v : undefined;
}

/** True when the field's annotation key is present alongside the raw key. */
export function hasFormattedValue(
  row: Record<string, unknown>,
  fieldName: string
): boolean {
  return fieldName + SUFFIX in row;
}

/** True when this key IS a formatted-value annotation (filter UI lists). */
export function isFormattedValueKey(key: string): boolean {
  return key.endsWith(SUFFIX);
}

/** Strip annotation suffix to reveal the base field. */
export function stripAnnotationSuffix(key: string): string {
  return key.endsWith(SUFFIX) ? key.slice(0, -SUFFIX.length) : key;
}
