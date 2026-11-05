import { useState, useMemo, useEffect } from "react";
import { cn } from "cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INDIAN_LANGUAGES } from "@/features/stops/services/edgeTtsService";
import { formatDate } from "@/shared/utils/dateUtils";
import type { IPremadeAudio } from "@/shared/types/premadeAudio";
import {
  Play,
  Download,
  Trash2,
  FileAudio,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Languages,
  Pencil,
} from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ActionTooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} className="text-xs font-medium">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export interface PremadeAudiosTableProps {
  audios: IPremadeAudio[];
  isLoading: boolean;
  playingAudioUrl: string | null;
  onPlayAudio: (url: string) => void;
  onEdit?: (audio: IPremadeAudio) => void;
  onDelete: (audio: IPremadeAudio) => void;
  pageSize?: number;
}

export function PremadeAudiosTable({
  audios,
  isLoading,
  playingAudioUrl,
  onPlayAudio,
  onEdit,
  onDelete,
  pageSize = 10,
}: PremadeAudiosTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(audios.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [audios.length, pageSize]);

  const paginatedAudios = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return audios.slice(start, start + pageSize);
  }, [audios, currentPage, pageSize]);

  const handleDownload = (audio: IPremadeAudio) => {
    const link = document.createElement("a");
    link.href = audio.url;
    link.download = audio.file_name || "premade-audio.mp3";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent border-b border-border/80">
              <TableHead className="w-12 text-center font-semibold text-xs text-foreground">
                #
              </TableHead>
              <TableHead className="min-w-[260px] font-semibold text-xs text-foreground">
                Reference Announcement Text
              </TableHead>
              <TableHead className="w-[130px] min-w-[130px] text-center font-semibold text-xs text-foreground">
                Playback
              </TableHead>
              <TableHead className="min-w-[170px] font-semibold text-xs text-foreground">
                Voice & Language
              </TableHead>
              <TableHead className="min-w-[160px] font-semibold text-xs text-foreground">
                File Details
              </TableHead>
              <TableHead className="w-[160px] font-semibold text-xs text-foreground">
                Created
              </TableHead>
              <TableHead className="w-[130px] text-right pr-4 font-semibold text-xs text-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-border/50">
                  <TableCell className="w-12 text-center">
                    <Skeleton className="h-4 w-5 mx-auto rounded" />
                  </TableCell>
                  <TableCell className="min-w-[260px]">
                    <Skeleton className="h-4 w-3/4 rounded mb-1" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-7 w-20 mx-auto rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28 rounded mb-1" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28 rounded mb-1" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24 rounded" />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Skeleton className="h-7 w-16 ml-auto rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedAudios.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileAudio className="h-8 w-8 text-muted-foreground/40" />
                    <span className="font-medium text-foreground">No premade audios found</span>
                    <span className="text-[11px] text-muted-foreground">
                      Synthesize or upload your first premade audio clip above.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedAudios.map((audio, idx) => {
                const serialNumber = (currentPage - 1) * pageSize + idx + 1;
                const isPlaying = playingAudioUrl === audio.url;
                const langConfig = INDIAN_LANGUAGES.find(
                  (l) => l.code === audio.language
                );
                const formatLabel =
                  audio.file_format?.includes("wav") || audio.file_name?.endsWith(".wav")
                    ? "WAV"
                    : "MP3";

                return (
                  <TableRow
                    key={audio.id}
                    className="hover:bg-muted/40 transition-colors border-b border-border/60"
                  >
                    {/* Index */}
                    <TableCell className="text-center font-mono text-xs text-muted-foreground py-3">
                      #{serialNumber}
                    </TableCell>

                    {/* Reference Text & Spoken Announcement Text */}
                    <TableCell className="min-w-[260px] py-3">
                      <div className="space-y-1">
                        <span
                          className="font-semibold text-xs text-foreground block line-clamp-1"
                          title={audio.reference_text}
                        >
                          {audio.reference_text}
                        </span>
                        {audio.announcement_text && (
                          <p
                            className="text-[11px] text-muted-foreground line-clamp-2 italic bg-muted/40 px-1.5 py-0.5 rounded border border-border/40"
                            title={audio.announcement_text}
                          >
                            "{audio.announcement_text}"
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Playback Preview */}
                    <TableCell className="w-[130px] text-center py-2">
                      <ActionTooltip
                        content={isPlaying ? "Stop playback" : "Play audio announcement"}
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
                          onClick={() => onPlayAudio(audio.url)}
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
                    </TableCell>

                    {/* Voice & Language */}
                    <TableCell className="min-w-[170px] py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 font-medium gap-1"
                          >
                            <Languages className="h-2.5 w-2.5" />
                            <span>{langConfig?.name || audio.language || "en-IN"}</span>
                          </Badge>
                          {audio.speed && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {audio.speed}
                            </span>
                          )}
                        </div>
                        {audio.voice && (
                          <span
                            className="text-[11px] text-muted-foreground block truncate max-w-[160px]"
                            title={audio.voice}
                          >
                            {audio.voice}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* File Details */}
                    <TableCell className="min-w-[160px] py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 font-mono font-bold uppercase"
                          >
                            {formatLabel}
                          </Badge>
                          <span className="text-xs font-mono text-foreground">
                            {formatFileSize(audio.file_size)}
                          </span>
                        </div>
                        <span
                          className="text-[11px] text-muted-foreground block truncate max-w-[150px]"
                          title={audio.file_name}
                        >
                          {audio.file_name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="w-[160px] py-3">
                      <span className="text-xs text-muted-foreground block whitespace-nowrap">
                        {formatDate(audio.created_at)}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="w-[130px] text-right pr-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <ActionTooltip content="Edit reference or announcement audio" side="top">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="h-7 w-7 border-border hover:border-primary text-muted-foreground hover:text-primary shadow-xs"
                              onClick={() => onEdit(audio)}
                              aria-label={`Edit audio ${audio.reference_text}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </ActionTooltip>
                        )}

                        <ActionTooltip content="Download audio file" side="top">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="h-7 w-7 border-border hover:border-primary text-muted-foreground hover:text-primary shadow-xs"
                            onClick={() => handleDownload(audio)}
                            aria-label={`Download audio for ${audio.reference_text}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </ActionTooltip>

                        <ActionTooltip content="Delete audio from storage & inventory" side="top">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="h-7 w-7 border-border hover:border-destructive text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-xs"
                            onClick={() => onDelete(audio)}
                            aria-label={`Delete audio ${audio.reference_text}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </ActionTooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {audios.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/80 bg-muted/20 text-xs">
          <span className="text-muted-foreground">
            Showing{" "}
            <strong>
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, audios.length)}
            </strong>{" "}
            of <strong>{audios.length}</strong> premade audios
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="h-7 w-7"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
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

export default PremadeAudiosTable;
