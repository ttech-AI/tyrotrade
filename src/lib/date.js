import { getDateTimeFormat } from "./intl-cache"

const FORMATS = {
  tr: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  en: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
}

const RELATIVE = {
  tr: { now: "az önce", minute: "dakika önce", hour: "saat önce", day: "gün önce", week: "hafta önce", month: "ay önce", year: "yıl önce", new: "Yeni" },
  en: { now: "just now", minute: "min ago", hour: "h ago", day: "d ago", week: "w ago", month: "mo ago", year: "y ago", new: "New" },
}

export function formatLongDate(date, locale = "tr") {
  const opts = FORMATS[locale] ?? FORMATS.tr
  return getDateTimeFormat(locale, opts).format(date)
}

export function formatRelative(date, locale = "tr") {
  const t = RELATIVE[locale] ?? RELATIVE.tr
  if (date === "new") return t.new
  const d = date instanceof Date ? date : new Date(date)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return t.now
  if (min < 60) return `${min} ${t.minute}`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${t.hour}`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} ${t.day}`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} ${t.week}`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} ${t.month}`
  const yr = Math.floor(day / 365)
  return `${yr} ${t.year}`
}
