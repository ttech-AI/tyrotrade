/**
 * Tiny inline price sparkline — a hand-rolled SVG (NOT recharts) so it
 * stays cheap when rendered once per table row. Draws a smoothed line +
 * soft area fill over the lane's freight-price history, with a dot on the
 * latest point. Colour is caller-driven (emerald rising / rose falling /
 * slate flat) so it reads at a glance alongside the Δ% chip.
 */
export function FreightSparkline({
  values,
  width = 84,
  height = 26,
  color = "#0284c7",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length < 2) {
    // One (or zero) points — nothing to trend; render a flat baseline tick.
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden
        role="presentation"
      >
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });

  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(
    height - pad
  ).toFixed(1)} L${pts[0][0].toFixed(1)},${(height - pad).toFixed(1)} Z`;
  const last = pts[pts.length - 1];
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      aria-hidden
      role="presentation"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  );
}
