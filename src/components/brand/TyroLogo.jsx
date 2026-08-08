import { useId } from "react"

export function TyroLogo({ size = 36, themeColors, className }) {
  const uniqueId = useId()
  const gradId = `tyro-grad-${uniqueId.replace(/:/g, "")}`

  const colors = themeColors ?? {
    gradStart: "var(--brand-logo-1)",
    gradEnd: "var(--brand-logo-2)",
    fillA: "var(--brand-logo-3)",
    fillB: "var(--brand-logo-4)",
    fillC: "var(--brand-logo-5)",
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 150 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TYRO"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="61.29"
          y1="116.53"
          x2="14.04"
          y2="47.15"
          gradientTransform="translate(0 150.55) scale(1 -1)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={colors.gradStart} />
          <stop offset="1" stopColor={colors.gradEnd} />
        </linearGradient>
      </defs>
      <path
        d="M14.52,68.93v33.41s-.28,6.49,3.59,4.28c10.49-6.21,21.95-12.7,26.51-15.05,9.39-4.69,8.01-10.49,8.01-10.49V48.77c0-8.42-5.8-4.69-5.8-4.69l-28.16,16.15s-4.14,2.35-4.14,8.7Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M97.77,70.17v40.31s1.52,10.91-7.45,15.88l-25.68,15.19s-6.9,3.31-6.49-2.76l1.66-48.73,37.96-19.88Z"
        fill={colors.fillA}
      />
      <path
        d="M58.15,137.95V66.72s-1.52-13.67,18.5-24.99l54.94-31.61s5.8-3.59,5.8,4.69V47.12s1.52,5.8-8.01,10.49c-9.53,4.69-47.9,27.61-47.9,27.61,0,0-23.33,11.87-23.33,52.74Z"
        fill={colors.fillB}
      />
      <path
        d="M84.52,91.98s5.52-3.31,13.25-7.87v-8.28c-9.11,5.25-16.43,9.66-16.43,9.66,0,0-20.29,10.35-22.92,45.14v1.1c7.32-30.23,26.09-39.76,26.09-39.76Z"
        fill={colors.fillC}
      />
    </svg>
  )
}

export default TyroLogo
