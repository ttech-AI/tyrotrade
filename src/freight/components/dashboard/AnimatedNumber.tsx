import * as React from "react";
import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";

export type AnimatedNumberPreset =
  | "count"
  | "currency"
  | "tons"
  | "days"
  | "percent"
  | "kilo";

interface AnimatedNumberProps {
  value: number;
  preset?: AnimatedNumberPreset;
  /** Currency code — only used by `preset="currency"`. Defaults to USD. */
  currency?: string;
  className?: string;
  /** Override locale (defaults to tr-TR). */
  locale?: string;
  /** Optional prefix (e.g. "+" for deltas). */
  prefix?: string;
  /** Optional suffix appended after the number (rendered as plain text, not animated). */
  suffix?: string;
}

const FORMATS: Record<AnimatedNumberPreset, (currency?: string) => Format> = {
  count: () => ({
    notation: "standard",
    maximumFractionDigits: 0,
  }),
  currency: (currency = "USD") => ({
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  tons: () => ({
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  days: () => ({
    notation: "standard",
    maximumFractionDigits: 0,
  }),
  percent: () => ({
    style: "percent",
    maximumFractionDigits: 1,
  }),
  kilo: () => ({
    notation: "compact",
    maximumFractionDigits: 1,
  }),
};

const SUFFIX_MAP: Partial<Record<AnimatedNumberPreset, string>> = {
  tons: " t",
  days: " gün",
  kilo: "",
};

/**
 * Animated counter wrapper around `@number-flow/react`.
 *
 * Smooth digit-by-digit transitions. Preset-driven for the four
 * dashboard formats: currency / tons / days / percent / count / kilo.
 *
 * Renders inline so it composes inside `text-3xl font-semibold` etc.
 */
export function AnimatedNumber({
  value,
  preset = "count",
  currency,
  className,
  locale = "tr-TR",
  prefix,
  suffix,
}: AnimatedNumberProps) {
  const format = React.useMemo(() => FORMATS[preset](currency), [preset, currency]);
  const resolvedSuffix = suffix ?? SUFFIX_MAP[preset] ?? "";

  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)}>
      <NumberFlow
        value={value}
        locales={locale}
        format={format}
        prefix={prefix}
      />
      {resolvedSuffix && (
        <span className="ml-0.5 text-[0.65em] font-medium text-muted-foreground">
          {resolvedSuffix}
        </span>
      )}
    </span>
  );
}
