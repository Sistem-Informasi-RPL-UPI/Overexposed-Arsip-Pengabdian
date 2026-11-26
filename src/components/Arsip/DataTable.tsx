import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export interface DataTableEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  itemLabel?: string;
  disabled?: boolean;
  /** Gunakan di Server Component untuk navigasi berbasis Link */
  buildHref?: (page: number) => string;
  /** Gunakan di Client Component untuk navigasi berbasis state */
  onPageChange?: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => React.Key;
  /** Slot bebas di bagian atas kartu tabel (mis. toolbar kustom) */
  topContent?: React.ReactNode;
  /** Ikon subheader standar */
  icon?: React.ReactNode;
  /** Judul subheader standar */
  title?: React.ReactNode;
  /** Aksi atau info di sisi kanan subheader standar */
  headerActions?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  error?: string;
  emptyMessage?: React.ReactNode;
  emptyState?: DataTableEmptyStateProps;
  pagination?: DataTablePaginationProps;
  /** Slot footer kustom bila tidak memakai pagination standar */
  footer?: React.ReactNode;
  minWidthClassName?: string;
  rowClassName?: string;
  className?: string;
}

export function getPaginationItems(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, "ellipsis", total];
  }
  if (current >= total - 2) {
    return [1, "ellipsis", total - 2, total - 1, total];
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

function alignClass(align: DataTableColumn<unknown>["align"]) {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function DataTablePagination({
  page,
  totalPages,
  from,
  to,
  total,
  itemLabel = "data",
  disabled = false,
  buildHref,
  onPageChange,
}: DataTablePaginationProps) {
  const pageItems = getPaginationItems(page, Math.max(1, totalPages));
  const canPrev = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  const navBtnBase =
    "inline-flex h-8 items-center justify-center gap-1 rounded-lg px-3 text-[11px] font-bold leading-3.5 tracking-[0.44px] transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaedff] bg-[#f2f3ff]/60 px-6 py-3.5">
      <p className="text-[13px] leading-4.5 text-[#444653]">
        Menampilkan{" "}
        <span className="font-semibold text-[#131b2e]">
          {from} - {to}
        </span>{" "}
        dari <span className="font-semibold text-[#131b2e]">{total}</span>{" "}
        {itemLabel}
      </p>

      <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
        {buildHref ? (
          canPrev ? (
            <Link
              href={buildHref(page - 1)}
              className={cn(
                navBtnBase,
                "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff]",
              )}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Sebelumnya
            </Link>
          ) : (
            <span
              className={cn(
                navBtnBase,
                "cursor-not-allowed bg-[#eaedff] text-[#757684] opacity-50",
              )}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Sebelumnya
            </span>
          )
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={!canPrev}
            onClick={() => onPageChange?.(page - 1)}
            className={cn(
              navBtnBase,
              "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff] disabled:opacity-50",
            )}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Sebelumnya
          </Button>
        )}

        <div className="flex items-center gap-1 px-1">
          {pageItems.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-6 text-center text-xs font-bold text-[#757684]"
              >
                ...
              </span>
            ) : buildHref ? (
              <Link
                key={item}
                href={buildHref(item)}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-xs font-semibold tracking-[0.24px] transition-colors",
                  item === page
                    ? "bg-[#1e40af] text-white"
                    : "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff]",
                )}
              >
                {item}
              </Link>
            ) : (
              <Button
                key={item}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onPageChange?.(item)}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "size-8 rounded-lg p-0 text-xs font-semibold tracking-[0.24px]",
                  item === page
                    ? "bg-[#1e40af] text-white hover:bg-[#1e40af] hover:text-white"
                    : "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff]",
                )}
              >
                {item}
              </Button>
            ),
          )}
        </div>

        {buildHref ? (
          canNext ? (
            <Link
              href={buildHref(page + 1)}
              className={cn(
                navBtnBase,
                "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff]",
              )}
            >
              Selanjutnya
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : (
            <span
              className={cn(
                navBtnBase,
                "cursor-not-allowed bg-[#eaedff] text-[#757684] opacity-50",
              )}
            >
              Selanjutnya
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          )
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={!canNext}
            onClick={() => onPageChange?.(page + 1)}
            className={cn(
              navBtnBase,
              "bg-[#eaedff] text-[#131b2e] hover:bg-[#dde1ff] disabled:opacity-50",
            )}
          >
            Selanjutnya
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        )}
      </nav>
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  topContent,
  icon,
  title,
  headerActions,
  loading = false,
  loadingMessage = "Memuat data...",
  error,
  emptyMessage = "Tidak ada data yang cocok.",
  emptyState,
  pagination,
  footer,
  minWidthClassName = "min-w-240",
  rowClassName,
  className,
}: DataTableProps<T>) {
  const hasSubheader = Boolean(icon || title || headerActions);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      {topContent}

      {hasSubheader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaedff] bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            {icon}
            {title && (
              <h2 className="text-base font-bold leading-6 text-[#131b2e]">
                {title}
              </h2>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      )}

      <Table className={minWidthClassName}>
        <TableHeader className="bg-[#f2f3ff] [&_tr]:border-0">
          <TableRow className="border-0 bg-[#f2f3ff] hover:bg-[#f2f3ff]">
            {columns.map((col, idx) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-auto px-4 py-4 text-xs font-bold uppercase leading-4 tracking-[0.6px] text-[#444653]",
                  idx === 0 && "pl-6",
                  idx === columns.length - 1 && "pr-6",
                  alignClass(col.align),
                  col.headerClassName,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-[#757684]"
              >
                {loadingMessage}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm font-medium text-[#ba1a1a]"
              >
                {error}
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-6 py-14 text-center text-sm text-[#444653]"
              >
                {emptyState ? (
                  <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-[#f2f3ff] text-[#00288e]">
                      {emptyState.icon ?? (
                        <Inbox className="size-6" aria-hidden />
                      )}
                    </div>
                    <h3 className="mt-3.5 text-base font-bold leading-6 text-[#131b2e]">
                      {emptyState.title}
                    </h3>
                    {emptyState.description && (
                      <p className="mt-1 whitespace-normal text-sm leading-5 text-[#444653]">
                        {emptyState.description}
                      </p>
                    )}
                    {emptyState.action && (
                      <div className="mt-5 flex items-center justify-center">
                        {emptyState.action}
                      </div>
                    )}
                  </div>
                ) : (
                  emptyMessage
                )}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIdx) => (
              <TableRow
                key={getRowKey(row, rowIdx)}
                className={cn(
                  "border-t border-[#eaedff] transition-colors hover:bg-[#f2f3ff]/40",
                  rowClassName,
                )}
              >
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "px-4 py-4 align-middle",
                      colIdx === 0 && "pl-6",
                      colIdx === columns.length - 1 && "pr-6",
                      alignClass(col.align),
                      col.cellClassName,
                    )}
                  >
                    {col.render(row, rowIdx)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && <DataTablePagination {...pagination} />}
      {!pagination && footer}
    </section>
  );
}

export default DataTable;
