export const categories = [
  { id: "operations", tr: "Operasyon", en: "Operations", tone: "amber" },
  { id: "management", tr: "Yönetim", en: "Management", tone: "emerald" },
  { id: "trade", tr: "Ticaret", en: "Trade", tone: "indigo" },
  { id: "project", tr: "Proje", en: "Project", tone: "violet" },
  { id: "it", tr: "IT", en: "IT", tone: "cyan" },
]

export const categoryTones = {
  amber: {
    badge: "bg-amber-100 text-amber-900 border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20",
    icon: "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 dark:from-amber-500/20 dark:to-amber-600/10 dark:text-amber-300",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20",
    icon: "bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-900 dark:from-emerald-500/20 dark:to-emerald-600/10 dark:text-emerald-300",
  },
  indigo: {
    badge: "bg-indigo-100 text-indigo-900 border-indigo-200/60 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20",
    icon: "bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-900 dark:from-indigo-500/20 dark:to-indigo-600/10 dark:text-indigo-300",
  },
  violet: {
    badge: "bg-violet-100 text-violet-900 border-violet-200/60 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/20",
    icon: "bg-gradient-to-br from-violet-100 to-violet-200 text-violet-900 dark:from-violet-500/20 dark:to-violet-600/10 dark:text-violet-300",
  },
  cyan: {
    badge: "bg-cyan-100 text-cyan-900 border-cyan-200/60 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/20",
    icon: "bg-gradient-to-br from-cyan-100 to-cyan-200 text-cyan-900 dark:from-cyan-500/20 dark:to-cyan-600/10 dark:text-cyan-300",
  },
}

export function getCategory(id) {
  return categories.find((c) => c.id === id)
}

export function getCategoryLabel(id, locale = "tr") {
  return getCategory(id)?.[locale] ?? id
}
