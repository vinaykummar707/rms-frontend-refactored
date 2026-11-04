import { useState, useEffect, useMemo } from "react";
import { cn } from "cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/shared/utils/dateUtils";
import type { IRoute } from "@/shared/types/route";
import {
  Pencil,
  Copy,
  ArrowLeftRight,
  Trash2,
  Check,
  X,
  Tag,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const ActionTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}> = ({ content, children, side = "top", align = "center" }) => {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={side}
        align={align}
        className="text-[11px] font-medium py-1 px-2 z-50 shadow-sm"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

const PAGE_SIZE_OPTIONS = [
  { label: "10", value: "10" },
  { label: "20", value: "20" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
];

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

export interface RouteTableProps {
  routes: IRoute[];
  selectedRouteIds?: string[];
  onSelectedChange?: (routeId: string, selected: boolean) => void;
  onSelectAllChange?: (checked: boolean) => void;
  highlightedRouteId?: string | null;
  onEdit?: (routeId: string) => void;
  onDuplicate?: (routeId: string, suffix: string) => void;
  onReturn?: (routeId: string, suffix: string) => void;
  onDelete?: (route: IRoute) => void;
  isGuest?: boolean;
  isLoading?: boolean;
  className?: string;
  initialPageSize?: number;
  showPagination?: boolean;
}

export function RouteTable({
  routes,
  selectedRouteIds = [],
  onSelectedChange,
  onSelectAllChange,
  highlightedRouteId,
  onEdit,
  onDuplicate,
  onReturn,
  onDelete,
  isGuest = false,
  isLoading = false,
  className,
  initialPageSize = 10,
  showPagination = true,
}: RouteTableProps) {
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const selectedSet = useMemo(
    () => new Set(selectedRouteIds),
    [selectedRouteIds]
  );

  const totalPages = Math.max(1, Math.ceil(routes.length / pageSize));

  // Reset page when totalPages shrinks below currentPage
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Jump to page of highlighted route if present
  useEffect(() => {
    if (!highlightedRouteId || routes.length === 0) return;
    const index = routes.findIndex((r) => r.id === highlightedRouteId);
    if (index !== -1) {
      const targetPage = Math.floor(index / pageSize) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [highlightedRouteId, routes, pageSize]);

  const allSelected =
    routes.length > 0 && selectedRouteIds.length === routes.length;
  const someSelected =
    selectedRouteIds.length > 0 && selectedRouteIds.length < routes.length;

  const paginatedRoutes = useMemo(() => {
    if (!showPagination) return routes;
    const start = (currentPage - 1) * pageSize;
    return routes.slice(start, start + pageSize);
  }, [routes, currentPage, pageSize, showPagination]);

  const pageNumbers = useMemo(() => {
    return getPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden",
        className
      )}
    >
      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent border-b border-border/80">
              {/* Checkbox Column */}
              <TableHead className="w-10 pl-3.5 pr-1">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked: boolean) => {
                    onSelectAllChange?.(Boolean(checked));
                  }}
                  aria-label="Select all routes"
                />
              </TableHead>

              {/* Route Number */}
              <TableHead className="min-w-[120px] font-semibold text-xs text-foreground">
                Route No
              </TableHead>

              {/* Source */}
              <TableHead className="min-w-[130px] font-semibold text-xs text-foreground">
                Source
              </TableHead>

              {/* Destination */}
              <TableHead className="min-w-[130px] font-semibold text-xs text-foreground">
                Destination
              </TableHead>

              {/* Split Route */}
              <TableHead className="hidden md:table-cell min-w-[95px] text-center font-semibold text-xs text-foreground">
                Split Route
              </TableHead>

              {/* Version */}
              <TableHead className="hidden sm:table-cell min-w-[85px] text-center font-semibold text-xs text-foreground">
                Version
              </TableHead>

              {/* Created At */}
              <TableHead className="hidden lg:table-cell min-w-[120px] font-semibold text-xs text-foreground">
                Created At
              </TableHead>

              {/* Created By */}
              <TableHead className="hidden xl:table-cell min-w-[160px] font-semibold text-xs text-foreground">
                Created By
              </TableHead>

              {/* Actions Column */}
              <TableHead className="w-[148px] min-w-[148px] pr-4 text-right font-semibold text-xs text-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index} className="border-b border-border/50">
                  <TableCell className="w-10 pl-3.5 pr-1">
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="min-w-[130px]">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="min-w-[130px]">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    <Skeleton className="h-5 w-12 mx-auto rounded-full" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    <Skeleton className="h-5 w-12 mx-auto rounded-full" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell className="w-[148px] min-w-[148px] pr-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : routes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  No routes to display.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRoutes.map((route) => {
                const isSelected = selectedSet.has(route.id);
                const isHighlighted = highlightedRouteId === route.id;
                const email = route.created_by_user?.email || "Unknown";
                const initials = email.slice(0, 2).toUpperCase();

                const routeDisplayNumber = route.is_split_route
                  ? `${route.route_number_1 || ""} - ${route.route_number_2 || ""}`
                  : route.route_number;

                return (
                  <TableRow
                    key={route.id}
                    id={`route-row-${route.id}`}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "transition-colors duration-150 border-b border-border/60 hover:bg-muted/40",
                      isSelected && "bg-muted/30",
                      isHighlighted &&
                        "bg-primary/5 ring-1 ring-inset ring-primary/30 border-l-4 !border-l-primary"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="w-10 pl-3.5 pr-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked: boolean) => {
                          onSelectedChange?.(route.id, Boolean(checked));
                        }}
                        aria-label={`Select route ${route.route_number}`}
                      />
                    </TableCell>

                    {/* Route No */}
                    <TableCell className="min-w-[120px] font-medium py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-semibold text-xs text-foreground tracking-tight whitespace-nowrap"
                          title={routeDisplayNumber}
                        >
                          {routeDisplayNumber}
                        </span>
                        {isHighlighted && (
                          <Badge className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground font-semibold rounded shrink-0">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Source */}
                    <TableCell className="min-w-[130px] py-3">
                      <span
                        className="text-xs text-muted-foreground font-medium truncate block max-w-[160px]"
                        title={route.source}
                      >
                        {route.source || "—"}
                      </span>
                    </TableCell>

                    {/* Destination */}
                    <TableCell className="min-w-[130px] py-3">
                      <span
                        className="text-xs text-muted-foreground font-medium truncate block max-w-[160px]"
                        title={route.destination}
                      >
                        {route.destination || "—"}
                      </span>
                    </TableCell>

                    {/* Split Route */}
                    <TableCell className="hidden md:table-cell min-w-[95px] text-center py-3">
                      <Badge
                        variant={route.is_split_route ? "default" : "outline"}
                        className="gap-1 font-medium text-[11px] h-5 px-2"
                      >
                        {route.is_split_route ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Yes</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3 text-muted-foreground" />
                            <span>No</span>
                          </>
                        )}
                      </Badge>
                    </TableCell>

                    {/* Version */}
                    <TableCell className="hidden sm:table-cell min-w-[85px] text-center py-3">
                      <Badge
                        variant={route.version === "1.0" ? "secondary" : "default"}
                        className={cn(
                          "gap-1 font-semibold text-[11px] h-5 px-2",
                          route.version === "1.0" &&
                            "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                        )}
                      >
                        {route.version === "1.0" ? (
                          <>
                            <Tag className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span>V1</span>
                          </>
                        ) : (
                          <>
                            <Layers className="h-3 w-3" />
                            <span>V2</span>
                          </>
                        )}
                      </Badge>
                    </TableCell>

                    {/* Created At */}
                    <TableCell className="hidden lg:table-cell min-w-[120px] py-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{formatDate(route.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* Created By */}
                    <TableCell className="hidden xl:table-cell min-w-[160px] py-3">
                      <div className="flex items-center gap-2 max-w-[170px]">
                        <Avatar className="h-5 w-5 shrink-0 rounded-full">
                          <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="truncate text-xs text-foreground font-medium"
                          title={email}
                        >
                          {email}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="w-[148px] min-w-[148px] pr-4 text-right py-2">
                      {!isGuest && (
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionTooltip content="Edit Route" side="top">
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              onClick={() => onEdit?.(route.id)}
                              className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/15 shadow-2xs"
                              aria-label={`Edit route ${route.route_number}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip content="Duplicate Route" side="top">
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              onClick={() => onDuplicate?.(route.id, "D")}
                              className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/15 shadow-2xs"
                              aria-label={`Duplicate route ${route.route_number}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip content="Create Return Route" side="top">
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              onClick={() => onReturn?.(route.id, "(Return)")}
                              className="h-7 w-7 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-500/15 shadow-2xs"
                              aria-label={`Create return route for ${route.route_number}`}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip content="Delete Route" side="top">
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => onDelete?.(route)}
                              className="h-7 w-7 shadow-2xs"
                              aria-label={`Delete route ${route.route_number}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      {showPagination && !isLoading && routes.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground select-none">
          {/* Left side: Results Count & Page Size Selector */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <span>
              Showing{" "}
              <strong className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, routes.length)}
              </strong>{" "}
              of{" "}
              <strong className="font-semibold text-foreground">
                {routes.length}
              </strong>{" "}
              {routes.length === 1 ? "route" : "routes"}
            </span>

            {selectedRouteIds.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                {selectedRouteIds.length} selected
              </span>
            )}

            <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
              <span className="text-[11px] whitespace-nowrap">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  if (val) {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }
                }}
                items={PAGE_SIZE_OPTIONS}
              >
                <SelectTrigger size="sm" className="h-7 w-[68px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right side: Navigation Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First Page"
              aria-label="Go to first page"
              className="h-7 w-7"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              title="Previous Page"
              aria-label="Go to previous page"
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-1">
              {pageNumbers.map((p, idx) => {
                if (p === "ellipsis") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-xs text-muted-foreground"
                    >
                      …
                    </span>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <Button
                    key={p}
                    variant={isActive ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "h-7 w-7 text-xs font-medium",
                      isActive && "pointer-events-none shadow-xs font-semibold"
                    )}
                    aria-label={`Page ${p}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {p}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              title="Next Page"
              aria-label="Go to next page"
              className="h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last Page"
              aria-label="Go to last page"
              className="h-7 w-7"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteTable;
