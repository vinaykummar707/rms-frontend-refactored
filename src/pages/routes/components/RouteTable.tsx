import { useMemo } from "react";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/shared/utils/dateUtils";
import type { IRoute } from "@/shared/types/route";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  ArrowLeftRight,
  Trash2,
  Check,
  X,
  Tag,
  Layers,
  Calendar,
} from "lucide-react";

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
}: RouteTableProps) {
  const selectedSet = useMemo(
    () => new Set(selectedRouteIds),
    [selectedRouteIds]
  );

  const allSelected =
    routes.length > 0 && selectedRouteIds.length === routes.length;
  const someSelected =
    selectedRouteIds.length > 0 && selectedRouteIds.length < routes.length;

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

              {/* Actions */}
              <TableHead className="w-12 pr-3.5 text-right font-semibold text-xs text-foreground" />
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
                  <TableCell className="w-12 pr-3.5 text-right">
                    <Skeleton className="h-7 w-7 rounded-md ml-auto" />
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
              routes.map((route) => {
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

                    {/* Actions Menu */}
                    <TableCell className="w-12 pr-3.5 text-right py-3">
                      {!isGuest && (
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  aria-label="Route actions"
                                />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 p-1 space-y-0.5"
                            >
                              <DropdownMenuItem
                                onClick={() => onEdit?.(route.id)}
                                className="text-xs font-medium cursor-pointer gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Edit Route</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDuplicate?.(route.id, "D")}
                                className="text-xs font-medium cursor-pointer gap-2"
                              >
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Duplicate Route</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onReturn?.(route.id, "(Return)")}
                                className="text-xs font-medium cursor-pointer gap-2"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Create Return Route</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDelete?.(route)}
                                className="text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete Route</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </div>
  );
}

export default RouteTable;
