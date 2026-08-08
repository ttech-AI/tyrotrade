export const palettes = [
  {
    id: "fiesta",
    labelKey: "palette.fiesta",
    swatch: ["#feda77", "#dd2a7b", "#8134af"],
    group: "gradient",
  },
  {
    id: "ocean-breeze",
    labelKey: "palette.oceanBreeze",
    swatch: ["#38bdf8", "#22d3ee", "#14b8a6"],
    group: "gradient",
  },
  {
    id: "ocean-breeze-v2",
    labelKey: "palette.oceanBreezeV2",
    swatch: ["#0077b6", "#00b4d8", "#48cae4"],
    group: "gradient",
  },
  {
    id: "peach-sorbet",
    labelKey: "palette.peachSorbet",
    swatch: ["#ff835d", "#ffa583", "#db9df5"],
    group: "gradient",
  },
  {
    id: "sunset-gradient",
    labelKey: "palette.sunsetGradient",
    swatch: ["#ff7b00", "#ffaa00", "#ffea00"],
    group: "gradient",
  },
  {
    id: "pastel-lavender",
    labelKey: "palette.pastelLavender",
    swatch: ["#6247aa", "#b185db", "#c19ee0"],
    group: "gradient",
  },
  {
    id: "green-garden",
    labelKey: "palette.greenGarden",
    swatch: ["#31572c", "#90a955", "#c5d566"],
    group: "gradient",
  },
  {
    id: "fiery-red",
    labelKey: "palette.fieryRed",
    swatch: ["#621708", "#bc3908", "#f6aa1c"],
    group: "gradient",
  },
  {
    id: "chocolate-delight",
    labelKey: "palette.chocolateDelight",
    swatch: ["#210f04", "#690500", "#bb6b00"],
    group: "gradient",
  },
  {
    id: "black",
    labelKey: "palette.black",
    swatch: ["#000000", "#000000", "#000000"],
    group: "solid",
  },
  {
    id: "amber",
    labelKey: "palette.amber",
    swatch: ["#d97706", "#d97706", "#d97706"],
    group: "solid",
  },
  {
    id: "navy",
    labelKey: "palette.navy",
    swatch: ["#1e40af", "#1e40af", "#1e40af"],
    group: "solid",
  },
  {
    id: "sky",
    labelKey: "palette.sky",
    swatch: ["#0ea5e9", "#0ea5e9", "#0ea5e9"],
    group: "solid",
  },
  {
    id: "violet",
    labelKey: "palette.violet",
    swatch: ["#8b5cf6", "#8b5cf6", "#8b5cf6"],
    group: "solid",
  },
]

export const DEFAULT_PALETTE = "fiesta"

export function getPalette(id) {
  return palettes.find((p) => p.id === id) ?? palettes[0]
}
