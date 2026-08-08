import { useContext } from "react"
import { ConfigContext } from "@/providers/ConfigProvider"

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error("useConfig must be used within a ConfigProvider")
  return ctx
}
