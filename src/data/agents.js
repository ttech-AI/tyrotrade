import {
  Robot01Icon,
  CargoShipIcon,
} from "@hugeicons/core-free-icons"

export const agents = [
  { id: "tyroHR", labelKey: "chat.agents.hr", icon: Robot01Icon },
  { id: "tyroTrader", labelKey: "chat.agents.trader", icon: CargoShipIcon },
]

export const DEFAULT_AGENT = "tyroHR"

export function getAgent(id) {
  return agents.find((a) => a.id === id) ?? agents[0]
}
