import type * as React from "react"

export declare function ToggleGroup(
  props: {
    type?: "single" | "multiple"
    value?: string | string[]
    defaultValue?: string | string[]
    onValueChange?: (v: never) => void
    spacing?: number
    variant?: string
    size?: string
    children?: React.ReactNode
  } & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
): React.ReactElement
export declare function ToggleGroupItem(
  props: { value: string; disabled?: boolean; variant?: string; size?: string; children?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>,
): React.ReactElement
