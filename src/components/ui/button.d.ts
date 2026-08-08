import type * as React from "react"

export declare const buttonVariants: (opts?: {
  variant?: string | null
  size?: string | null
  className?: string
}) => string

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | string
  size?: "default" | "sm" | "lg" | "icon" | string
  asChild?: boolean
}

export declare function Button(props: ButtonProps): React.ReactElement
