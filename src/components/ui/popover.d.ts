import type * as React from "react"

export declare function Popover(props: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; modal?: boolean; children?: React.ReactNode }): React.ReactElement
export declare function PopoverTrigger(props: { asChild?: boolean; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>): React.ReactElement
export declare function PopoverAnchor(props: { asChild?: boolean; children?: React.ReactNode }): React.ReactElement
export declare function PopoverContent(
  props: {
    align?: "start" | "center" | "end"
    side?: "top" | "right" | "bottom" | "left"
    sideOffset?: number
    alignOffset?: number
    collisionPadding?: number | Record<string, number>
    avoidCollisions?: boolean
    children?: React.ReactNode
  } & React.HTMLAttributes<HTMLDivElement>,
): React.ReactElement
