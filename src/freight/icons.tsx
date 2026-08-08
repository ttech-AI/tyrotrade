/**
 * lucide-react → Hugeicons bridge.
 *
 * The ported freight pages were written against lucide; tyroTrade's icon
 * language is Hugeicons (see components.json `iconLibrary`). Rather than
 * shipping a second icon runtime or hand-editing ~200 JSX call sites, every
 * lucide glyph the port uses is re-exported here under its ORIGINAL lucide
 * name, drawn with the closest Hugeicons equivalent. The port's imports were
 * rewritten to `@/freight/icons`, so this file is the single place where the
 * icon mapping can be reviewed or corrected.
 *
 * Sizing: lucide takes `size` as a prop and defaults to 24; Hugeicons emits
 * width/height SVG presentation attributes, which CSS always overrides — so
 * the call sites' `className="size-4"` keeps working unchanged. `size` is
 * still honoured for the few places that pass it numerically.
 */
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowUpDownIcon,
  Tick02Icon,
  Cancel01Icon,
  Dollar01Icon,
  EuroIcon,
  Layers01Icon,
  Loading03Icon,
  RefreshIcon,
  Route01Icon,
  ShipmentTrackingIcon,
  TradeUpIcon,
  TradeDownIcon,
  Wallet01Icon,
  WheatIcon,
  AnchorIcon,
  MapPinIcon,
  MapsOffIcon,
  Compass01Icon,
  Target01Icon,
  Clock01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  HourglassIcon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  MinusSignIcon,
  File01Icon,
  Leaf01Icon,
  GlobalIcon,
  Building02Icon,
  TruckIcon,
  UserCircleIcon,
  Download01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"

type IconProps = {
  className?: string
  size?: number | string
  strokeWidth?: number
  color?: string
  [key: string]: unknown
}

function make(icon: unknown) {
  return function Icon({ className, size, strokeWidth, color, ...rest }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon as never}
        className={className}
        {...(size != null ? { size: Number(size) } : {})}
        {...(strokeWidth != null ? { strokeWidth } : {})}
        {...(color != null ? { color } : {})}
        {...rest}
      />
    )
  }
}

// Directional
export const ArrowRight = make(ArrowRight01Icon)
export const ArrowUp = make(ArrowUp01Icon)
export const ArrowUpRight = make(ArrowUpRight01Icon)
export const ArrowLeftRight = make(ArrowDataTransferHorizontalIcon)
export const ChevronRight = make(ArrowRight01Icon)
export const ChevronLeft = make(ArrowLeft01Icon)
export const ChevronDown = make(ArrowDown01Icon)
export const ChevronUp = make(ArrowUp01Icon)
export const ChevronsUpDown = make(ArrowUpDownIcon)

// Actions / state
export const Check = make(Tick02Icon)
export const X = make(Cancel01Icon)
export const RefreshCw = make(RefreshIcon)
export const Loader2 = make(Loading03Icon)

// Domain
export const Ship = make(ShipmentTrackingIcon)
export const Route = make(Route01Icon)
export const Layers = make(Layers01Icon)
export const Wheat = make(WheatIcon)
export const Wallet = make(Wallet01Icon)
export const DollarSign = make(Dollar01Icon)
export const Euro = make(EuroIcon)
export const TrendingUp = make(TradeUpIcon)
export const TrendingDown = make(TradeDownIcon)

// Map / voyage
export const Anchor = make(AnchorIcon)
export const MapPin = make(MapPinIcon)
export const MapPinOff = make(MapsOffIcon)
export const Compass = make(Compass01Icon)
export const Crosshair = make(Target01Icon)
export const Plus = make(PlusSignIcon)
export const Minus = make(MinusSignIcon)
export const Globe2 = make(GlobalIcon)
export const Truck = make(TruckIcon)
export const ArrowDownToLine = make(Download01Icon)
export const ArrowUpFromLine = make(Upload01Icon)

// Time / milestones
export const Clock = make(Clock01Icon)
export const Calendar = make(Calendar03Icon)
export const CalendarClock = make(CalendarCheckIn01Icon)
export const Hourglass = make(HourglassIcon)
export const CircleCheck = make(CheckmarkCircle02Icon)

// Misc
export const FileText = make(File01Icon)
export const Leaf = make(Leaf01Icon)
export const Building2 = make(Building02Icon)
export const User = make(UserCircleIcon)

/** lucide's component type, used by ported code for icon-valued props. */
export type LucideIcon = ReturnType<typeof make>
