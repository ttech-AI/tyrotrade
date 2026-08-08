import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
  Menu03Icon,
  DragDropVerticalIcon,
  RefreshIcon,
  MoreVerticalIcon,
  PlusSignIcon,
  Time03Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useLocale } from "@/hooks/useLocale"
import { tableData } from "@/data/tableData"

const TYPE_KEYS = ["strategy", "contract", "operation", "trade", "project", "approval", "analytics"]
const STATUS_KEYS = ["done", "progress", "review", "waiting"]
const REVIEWERS = ["Cenk Şayli", "Arzu Örsel", "Mehmet Kılıç"]

function StatusBadge({ status }) {
  const { t } = useLocale()
  let icon = RefreshIcon
  let cls = "text-muted-foreground"
  if (status === "done") {
    icon = CheckmarkCircle02Icon
    cls = "text-emerald-500 dark:text-emerald-400"
  } else if (status === "waiting") {
    icon = Time03Icon
    cls = "text-amber-500 dark:text-amber-400"
  } else if (status === "review") {
    icon = RefreshIcon
    cls = "text-sky-500 dark:text-sky-400"
  }
  return (
    <Badge
      variant="outline"
      className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3"
    >
      <HugeiconsIcon icon={icon} className={cls} />
      {t(`table.status.${status}`)}
    </Badge>
  )
}

function DragHandle({ id }) {
  const { t } = useLocale()
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <HugeiconsIcon icon={DragDropVerticalIcon} className="size-3 text-muted-foreground" />
      <span className="sr-only">{t("table.dragAria")}</span>
    </Button>
  )
}

function TableCellViewer({ item }) {
  const { t } = useLocale()
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.header}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader className="gap-1">
          <SheetTitle>{item.header}</SheetTitle>
          <SheetDescription>{item.app} · {t(`table.type.${item.type}`)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="header">{t("sheet.header")}</Label>
              <Input id="header" defaultValue={item.header} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="type">{t("sheet.type")}</Label>
                <Select defaultValue={item.type}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder={t("sheet.typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>{t(`table.type.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="status">{t("sheet.status")}</Label>
                <Select defaultValue={item.status}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder={t("sheet.statusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>{t(`table.status.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="target">{t("sheet.target")}</Label>
                <Input id="target" defaultValue={item.target} />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="limit">{t("sheet.limit")}</Label>
                <Input id="limit" defaultValue={item.limit} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="reviewer">{t("sheet.reviewer")}</Label>
              <Select defaultValue={item.reviewer === "unassigned" ? undefined : item.reviewer}>
                <SelectTrigger id="reviewer" className="w-full">
                  <SelectValue placeholder={t("sheet.reviewerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REVIEWERS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">{t("table.unassigned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>
        <SheetFooter className="mt-auto flex gap-2 sm:flex-col sm:space-x-0">
          <Button className="w-full">{t("sheet.save")}</Button>
          <SheetClose asChild>
            <Button variant="outline" className="w-full">{t("sheet.close")}</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function useColumns() {
  const { t } = useLocale()
  return React.useMemo(
    () => [
      {
        id: "drag",
        header: () => null,
        cell: ({ row }) => <DragHandle id={row.original.id} />,
      },
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label={t("table.selectAria")}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={t("table.selectRowAria")}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "header",
        header: t("table.col.header"),
        cell: ({ row }) => <TableCellViewer item={row.original} />,
        enableHiding: false,
      },
      {
        accessorKey: "app",
        header: t("table.col.app"),
        cell: ({ row }) => (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            {row.original.app}
          </Badge>
        ),
      },
      {
        accessorKey: "type",
        header: t("table.col.type"),
        cell: ({ row }) => (
          <div className="w-28 text-muted-foreground">{t(`table.type.${row.original.type}`)}</div>
        ),
      },
      {
        accessorKey: "status",
        header: t("table.col.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "target",
        header: () => <div className="w-full text-right">{t("table.col.target")}</div>,
        cell: ({ row }) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              toast.promise(new Promise((r) => setTimeout(r, 800)), {
                loading: t("table.toast.saving").replace("{name}", row.original.header),
                success: t("table.toast.saved"),
                error: t("table.toast.error"),
              })
            }}
          >
            <Label htmlFor={`${row.original.id}-target`} className="sr-only">{t("table.col.target")}</Label>
            <Input
              className="h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background"
              defaultValue={row.original.target}
              id={`${row.original.id}-target`}
            />
          </form>
        ),
      },
      {
        accessorKey: "limit",
        header: () => <div className="w-full text-right">{t("table.col.limit")}</div>,
        cell: ({ row }) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              toast.promise(new Promise((r) => setTimeout(r, 800)), {
                loading: t("table.toast.saving").replace("{name}", row.original.header),
                success: t("table.toast.saved"),
                error: t("table.toast.error"),
              })
            }}
          >
            <Label htmlFor={`${row.original.id}-limit`} className="sr-only">{t("table.col.limit")}</Label>
            <Input
              className="h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background"
              defaultValue={row.original.limit}
              id={`${row.original.id}-limit`}
            />
          </form>
        ),
      },
      {
        accessorKey: "reviewer",
        header: t("table.col.reviewer"),
        cell: ({ row }) => {
          const isAssigned = row.original.reviewer !== "unassigned"
          if (isAssigned) return row.original.reviewer
          return (
            <>
              <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">{t("table.col.reviewer")}</Label>
              <Select>
                <SelectTrigger className="h-8 w-40" id={`${row.original.id}-reviewer`}>
                  <SelectValue placeholder={t("table.assign")} />
                </SelectTrigger>
                <SelectContent align="end">
                  {REVIEWERS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )
        },
      },
      {
        id: "actions",
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                size="icon"
              >
                <HugeiconsIcon icon={MoreVerticalIcon} />
                <span className="sr-only">{t("table.openMenu")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem>{t("table.action.edit")}</DropdownMenuItem>
              <DropdownMenuItem>{t("table.action.copy")}</DropdownMenuItem>
              <DropdownMenuItem>{t("table.action.bookmark")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t("table.action.delete")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t],
  )
}

function DraggableRow({ row }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({ data: initialData = tableData } = {}) {
  const { t } = useLocale()
  const columns = useColumns()
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState({})
  const [columnFilters, setColumnFilters] = React.useState([])
  const [sorting, setSorting] = React.useState([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  )
  const dataIds = React.useMemo(() => data?.map(({ id }) => id) || [], [data])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((d) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(d, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs defaultValue="all" className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">{t("table.viewAria")}</Label>
        <Select defaultValue="all">
          <SelectTrigger className="@4xl/main:hidden flex w-fit" id="view-selector">
            <SelectValue placeholder={t("table.viewPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("table.tab.all")}</SelectItem>
            <SelectItem value="approvals">{t("table.tab.approvals")}</SelectItem>
            <SelectItem value="ops">{t("table.tab.ops")}</SelectItem>
            <SelectItem value="strategy">{t("table.tab.strategy")}</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="@4xl/main:flex hidden">
          <TabsTrigger value="all">{t("table.tab.all")}</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            {t("table.tab.approvals")}{" "}
            <Badge variant="secondary" className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30">
              2
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ops" className="gap-1">
            {t("table.tab.ops")}{" "}
            <Badge variant="secondary" className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30">
              3
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="strategy">{t("table.tab.strategy")}</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <HugeiconsIcon icon={Menu03Icon} />
                <span className="hidden lg:inline">{t("table.columns")}</span>
                <span className="lg:hidden">{t("table.columnsShort")}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={PlusSignIcon} />
            <span className="hidden lg:inline">{t("table.addRecord")}</span>
          </Button>
        </div>
      </div>
      <TabsContent value="all" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {t("table.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {t("table.rowsSelected")
              .replace("{selected}", table.getFilteredSelectedRowModel().rows.length)
              .replace("{total}", table.getFilteredRowModel().rows.length)}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">{t("table.rowsPerPage")}</Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((s) => (
                    <SelectItem key={s} value={`${s}`}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {t("table.page")
                .replace("{current}", table.getState().pagination.pageIndex + 1)
                .replace("{total}", table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">{t("table.firstPage")}</span>
                <HugeiconsIcon icon={ArrowLeftDoubleIcon} />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">{t("table.previousPage")}</span>
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">{t("table.nextPage")}</span>
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Button>
              <Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                <span className="sr-only">{t("table.lastPage")}</span>
                <HugeiconsIcon icon={ArrowRightDoubleIcon} />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="approvals" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed grid place-items-center text-sm text-muted-foreground">{t("table.tab.approvalsEmpty")}</div>
      </TabsContent>
      <TabsContent value="ops" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed grid place-items-center text-sm text-muted-foreground">{t("table.tab.opsEmpty")}</div>
      </TabsContent>
      <TabsContent value="strategy" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed grid place-items-center text-sm text-muted-foreground">{t("table.tab.strategyEmpty")}</div>
      </TabsContent>
    </Tabs>
  )
}
