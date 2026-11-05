import React, { useState, useMemo, useEffect } from "react";
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
import type { IStopWithAudio, IStopAudio } from "@/shared/types/stop";
import {
  Pencil,
  Trash2,
  Play,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Loader2,
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

function getStopAudio(stop: IStopWithAudio): IStopAudio | null {
  if (!stop.stop_audios) return null;
  if (Array.isArray(stop.stop_audios)) {
    return stop.stop_audios[0] || null;
  }
  return stop.stop_audios;
}

export interface StopsTableProps {
  stops: IStopWithAudio[];
  selectedStopIds?: string[];
  onSelectedChange?: (stopId: string, selected: boolean) => void;
  onSelectAllChange?: (checked: boolean) => void;
  isLoading?: boolean;
  uploadingStopId?: string | null;
  generatingStopId?: string | null;
  playingAudioUrl: string | null;
  onPlayAudio: (url: string) => void;
  onUploadAudio?: (stop: IStopWithAudio, file: File) => Promise<void> | void;
  onDeleteAudio: (stop: IStopWithAudio) => void;
  onGenerateAudio?: (stop: IStopWithAudio) => void;
  onEdit: (stop: IStopWithAudio) => void;
  onDelete: (stop: IStopWithAudio) => void;
  isGuest?: boolean;
  className?: string;
  initialPageSize?: number;
  showPagination?: boolean;
}

export function StopsTable({
  stops,
  selectedStopIds = [],
  onSelectedChange,
  onSelectAllChange,
  isLoading = false,
  uploadingStopId = null,
  generatingStopId = null,
  playingAudioUrl,
  onPlayAudio,
  onUploadAudio,
  onDeleteAudio,
  onGenerateAudio,
  onEdit,
  onDelete,
  isGuest = false,
  className,
  initialPageSize = 10,
  showPagination = true,
}: StopsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [targetStopForUpload, setTargetStopForUpload] = useState<IStopWithAudio | null>(null);

  const handleTriggerUpload = (stop: IStopWithAudio) => {
    setTargetStopForUpload(stop);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetStopForUpload || !onUploadAudio) return;
    try {
      await onUploadAudio(targetStopForUpload, file);
    } finally {
      setTargetStopForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectedSet = useMemo(
    () => new Set(selectedStopIds),
    [selectedStopIds]
  );

  const allSelected =
    stops.length > 0 && selectedStopIds.length === stops.length;
  const someSelected =
    selectedStopIds.length > 0 && selectedStopIds.length < stops.length;

  const totalPages = Math.max(1, Math.ceil(stops.length / pageSize));

  // Reset page when stops collection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [stops.length, pageSize]);

  // Clamp current page
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedStops = useMemo(() => {
    if (!showPagination) return stops;
    const start = (currentPage - 1) * pageSize;
    return stops.slice(start, start + pageSize);
  }, [stops, currentPage, pageSize, showPagination]);

  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden",
        className
      )}
    >
      {/* Hidden file input for direct audio upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Responsive Table Scroll Area */}
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
                  aria-label="Select all stops"
                />
              </TableHead>
              <TableHead className="w-12 text-center font-semibold text-xs text-foreground">
                #
              </TableHead>
              <TableHead className="min-w-[170px] font-semibold text-xs text-foreground">
                Stop Name
              </TableHead>
              <TableHead className="hidden md:table-cell min-w-[150px] font-semibold text-xs text-foreground">
                Downward (Lat, Long)
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-[150px] font-semibold text-xs text-foreground">
                Upward (Lat, Long)
              </TableHead>
              <TableHead className="min-w-[210px] text-center font-semibold text-xs text-foreground">
                Audio Announcement
              </TableHead>
              <TableHead className="hidden xl:table-cell min-w-[95px] text-center font-semibold text-xs text-foreground">
                Status
              </TableHead>
              <TableHead className="hidden xl:table-cell min-w-[120px] font-semibold text-xs text-foreground">
                Created
              </TableHead>
              <TableHead className="w-[148px] min-w-[148px] pr-4 text-right font-semibold text-xs text-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-border/50">
                  <TableCell className="w-10 pl-3.5 pr-1">
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  <TableCell className="w-12 text-center">
                    <Skeleton className="h-4 w-6 mx-auto rounded" />
                  </TableCell>
                  <TableCell className="min-w-[170px]">
                    <Skeleton className="h-4 w-32 rounded" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell min-w-[150px]">
                    <Skeleton className="h-4 w-28 rounded" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell min-w-[150px]">
                    <Skeleton className="h-4 w-28 rounded" />
                  </TableCell>
                  <TableCell className="min-w-[210px] text-center">
                    <Skeleton className="h-7 w-28 mx-auto rounded-lg" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-center min-w-[95px]">
                    <Skeleton className="h-5 w-14 mx-auto rounded-full" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell min-w-[120px]">
                    <Skeleton className="h-4 w-20 rounded" />
                  </TableCell>
                  <TableCell className="w-[148px] min-w-[148px] pr-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedStops.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  No stops found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedStops.map((stop, index) => {
                const serialNumber = (currentPage - 1) * pageSize + index + 1;
                const audio = getStopAudio(stop);
                const hasAudio = Boolean(audio?.url);
                const isPlaying = hasAudio && playingAudioUrl === audio?.url;
                const isSelected = selectedSet.has(stop.id);

                return (
                  <TableRow
                    key={stop.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "transition-colors duration-150 border-b border-border/60 hover:bg-muted/40",
                      isSelected && "bg-muted/30"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="w-10 pl-3.5 pr-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked: boolean) => {
                          onSelectedChange?.(stop.id, Boolean(checked));
                        }}
                        aria-label={`Select stop ${stop.name}`}
                      />
                    </TableCell>

                    {/* Index */}
                    <TableCell className="text-center font-mono text-xs text-muted-foreground py-3">
                      #{serialNumber}
                    </TableCell>

                    {/* Stop Name */}
                    <TableCell className="min-w-[170px] font-medium py-3">
                      <span
                        className="font-semibold text-xs text-foreground tracking-tight whitespace-nowrap block"
                        title={stop.name}
                      >
                        {stop.name}
                      </span>
                    </TableCell>

                    {/* Downward (Lat, Long) */}
                    <TableCell className="hidden md:table-cell py-3">
                      {stop.down_latitude != null && stop.down_longitude != null ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/60">
                          {stop.down_latitude}, {stop.down_longitude}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </TableCell>

                    {/* Upward (Lat, Long) */}
                    <TableCell className="hidden lg:table-cell py-3">
                      {stop.up_latitude != null && stop.up_longitude != null ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/60">
                          {stop.up_latitude}, {stop.up_longitude}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </TableCell>

                    {/* Audio Announcement */}
                    <TableCell className="min-w-[210px] text-center py-2">
                      {hasAudio ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <ActionTooltip
                            content={
                              isPlaying
                                ? "Pause audio announcement"
                                : "Play audio announcement"
                            }
                            side="top"
                          >
                            <Button
                              type="button"
                              variant={isPlaying ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-7 text-xs px-2.5 gap-1.5 font-semibold shadow-xs transition-colors",
                                isPlaying
                                  ? "bg-primary text-primary-foreground"
                                  : "border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                              )}
                              onClick={() => onPlayAudio(audio!.url)}
                            >
                              {isPlaying ? (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-primary-foreground animate-ping inline-block" />
                                  <span>Playing</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  <span>Play</span>
                                </>
                              )}
                            </Button>
                          </ActionTooltip>

                          {!isGuest && (
                            <>
                              <ActionTooltip content="Replace audio file (.mp3, .wav)" side="top">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  disabled={uploadingStopId === stop.id || generatingStopId === stop.id}
                                  className="h-7 w-7 border-border hover:border-primary text-foreground hover:text-primary shadow-xs"
                                  onClick={() => handleTriggerUpload(stop)}
                                  aria-label={`Replace audio for ${stop.name}`}
                                >
                                  {uploadingStopId === stop.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </ActionTooltip>

                              <ActionTooltip content="Regenerate announcement with Edge-TTS" side="top">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  disabled={generatingStopId === stop.id || uploadingStopId === stop.id}
                                  className="h-7 w-7 border-border hover:border-amber-500/50 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 shadow-xs"
                                  onClick={() => onGenerateAudio?.(stop)}
                                  aria-label={`Regenerate audio for ${stop.name}`}
                                >
                                  {generatingStopId === stop.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                                  ) : (
                                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                  )}
                                </Button>
                              </ActionTooltip>

                              <ActionTooltip content="Delete audio announcement" side="top">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="h-7 w-7 border-border hover:border-destructive text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-xs"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Are you sure you want to delete the audio file for "${stop.name}"?`
                                      )
                                    ) {
                                      onDeleteAudio(stop);
                                    }
                                  }}
                                  aria-label={`Delete audio for ${stop.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </ActionTooltip>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {!isGuest ? (
                            <>
                              <ActionTooltip content="Upload audio file (.mp3, .wav)" side="top">
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  disabled={uploadingStopId === stop.id || generatingStopId === stop.id}
                                  className="h-7 text-xs px-2.5 gap-1.5 font-semibold shadow-xs"
                                  onClick={() => handleTriggerUpload(stop)}
                                >
                                  {uploadingStopId === stop.id ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3.5 w-3.5" />
                                      <span>Upload Audio</span>
                                    </>
                                  )}
                                </Button>
                              </ActionTooltip>

                              <ActionTooltip content="Generate audio announcement using Edge-TTS" side="top">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={generatingStopId === stop.id || uploadingStopId === stop.id}
                                  className="h-7 text-xs px-2 gap-1 border-border hover:border-amber-500/50 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 shadow-xs"
                                  onClick={() => onGenerateAudio?.(stop)}
                                >
                                  {generatingStopId === stop.id ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                                      <span className="text-xs">Generating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                      <span className="text-xs font-medium">Auto Generate</span>
                                    </>
                                  )}
                                </Button>
                              </ActionTooltip>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="hidden xl:table-cell text-center py-3">
                      {stop.active !== false ? (
                        <Badge
                          variant="outline"
                          className="gap-1 font-medium text-[11px] h-5 px-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 font-medium text-[11px] h-5 px-2 text-muted-foreground"
                        >
                          Disabled
                        </Badge>
                      )}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap py-3">
                      {formatDate(stop.created_at)}
                    </TableCell>

                    {/* Actions Column (Secondary & Destructive Icon Buttons) */}
                    <TableCell className="w-[148px] min-w-[148px] pr-4 text-right py-2">
                      {!isGuest && (
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionTooltip content="Edit Stop" side="top">
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              onClick={() => onEdit(stop)}
                              className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/15 shadow-2xs"
                              aria-label={`Edit stop ${stop.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip content="Delete Stop" side="top">
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => onDelete(stop)}
                              className="h-7 w-7 shadow-2xs"
                              aria-label={`Delete stop ${stop.name}`}
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
      {showPagination && !isLoading && stops.length > 0 && (
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
                {Math.min(currentPage * pageSize, stops.length)}
              </strong>{" "}
              of{" "}
              <strong className="font-semibold text-foreground">
                {stops.length}
              </strong>{" "}
              {stops.length === 1 ? "stop" : "stops"}
            </span>

            {selectedStopIds.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                {selectedStopIds.length} selected
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

export default StopsTable;
