export function SidebarCopyright() {
  const year = new Date().getFullYear()
  return (
    <div className="overflow-hidden px-3 pb-2 text-center transition-[opacity,max-height,padding] duration-200 ease-linear max-h-8 opacity-100 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0">
      <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
        © {year} TTECH Business Solutions
      </span>
    </div>
  )
}
