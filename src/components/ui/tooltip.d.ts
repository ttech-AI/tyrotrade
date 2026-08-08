import type * as React from "react"

type Div = React.HTMLAttributes<HTMLDivElement>

export declare function TooltipProvider(props: { delayDuration?: number; skipDelayDuration?: number; disableHoverableContent?: boolean; children?: React.ReactNode }): React.ReactElement
export declare function Tooltip(props: { children?: React.ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void }): React.ReactElement
export declare function TooltipTrigger(props: { asChild?: boolean; children?: React.ReactNode } & Div): React.ReactElement
export declare function TooltipContent(
  props: { sideOffset?: number; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end"; children?: React.ReactNode } & Div,
): React.ReactElement
