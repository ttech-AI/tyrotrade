import type * as React from "react"

type Div = React.HTMLAttributes<HTMLDivElement>

export declare function Sheet(props: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; children?: React.ReactNode }): React.ReactElement
export declare function SheetTrigger(props: { asChild?: boolean; children?: React.ReactNode }): React.ReactElement
export declare function SheetClose(props: { asChild?: boolean; children?: React.ReactNode }): React.ReactElement
export declare function SheetPortal(props: { children?: React.ReactNode }): React.ReactElement
export declare function SheetOverlay(props: Div): React.ReactElement
export declare function SheetContent(props: { side?: "top" | "right" | "bottom" | "left"; children?: React.ReactNode } & Div): React.ReactElement
export declare function SheetHeader(props: Div): React.ReactElement
export declare function SheetFooter(props: Div): React.ReactElement
export declare function SheetTitle(props: Div): React.ReactElement
export declare function SheetDescription(props: Div): React.ReactElement
