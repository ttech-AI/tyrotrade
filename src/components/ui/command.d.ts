import type * as React from "react"

type Div = React.HTMLAttributes<HTMLDivElement>

export declare function Command(props: { shouldFilter?: boolean; loop?: boolean; children?: React.ReactNode } & Div): React.ReactElement
export declare function CommandDialog(props: Record<string, unknown>): React.ReactElement
export declare function CommandInput(props: { value?: string; onValueChange?: (v: string) => void; placeholder?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">): React.ReactElement
export declare function CommandList(props: { children?: React.ReactNode } & Div): React.ReactElement
export declare function CommandEmpty(props: { children?: React.ReactNode } & Div): React.ReactElement
export declare function CommandGroup(props: { heading?: React.ReactNode; children?: React.ReactNode } & Div): React.ReactElement
export declare function CommandItem(props: { value?: string; keywords?: string[]; onSelect?: (v: string) => void; disabled?: boolean; children?: React.ReactNode } & Div): React.ReactElement
export declare function CommandSeparator(props: Div): React.ReactElement
export declare function CommandShortcut(props: Div): React.ReactElement
