import { useContext } from "react"
import { LocaleContext } from "@/providers/LocaleProvider"

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider")
  return ctx
}
