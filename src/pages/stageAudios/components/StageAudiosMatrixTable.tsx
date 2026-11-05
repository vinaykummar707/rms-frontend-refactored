import { useMemo } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StageAudioCell } from "./StageAudioCell";
import { STAGE_TYPES } from "@/shared/types/stageAudio";
import type {
  IStageAudio,
  StageType,
  IStageMatrixRow,
} from "@/shared/types/stageAudio";
import type { ILanguageOption } from "@/features/stops/services/edgeTtsService";
import { Languages } from "lucide-react";

export interface StageAudiosMatrixTableProps {
  rows: IStageMatrixRow[];
  isLoading: boolean;
  searchQuery: string;
  playingAudioUrl: string | null;
  onPlay: (url: string) => void;
  onAdd: (language: ILanguageOption, stageType: StageType) => void;
  onEdit: (audio: IStageAudio, language: ILanguageOption) => void;
  onDelete: (audio: IStageAudio) => void;
}

export function StageAudiosMatrixTable({
  rows,
  isLoading,
  searchQuery,
  playingAudioUrl,
  onPlay,
  onAdd,
  onEdit,
  onDelete,
}: StageAudiosMatrixTableProps) {
  // Filter rows by language name or native name
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.language.name.toLowerCase().includes(q) ||
        r.language.nativeName.toLowerCase().includes(q) ||
        r.language.code.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3.5 rounded-xl border border-border/60 bg-card"
          >
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card">
        <div className="h-12 w-12 rounded-full bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center mb-3">
          <Languages className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No matching languages found
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          No languages match your search filter "{searchQuery}". Try a different language name or clear the search.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
      {/* Matrix Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
        <div className="lg:col-span-3 p-3.5 flex items-center gap-1.5 border-b lg:border-b-0 lg:border-r border-border">
          <Languages className="h-3.5 w-3.5 text-primary" />
          <span>Language (Row)</span>
        </div>

        {STAGE_TYPES.map((stage, idx) => (
          <div
            key={stage.type}
            className={cn(
              "lg:col-span-3 p-3.5 flex items-center justify-between border-b lg:border-b-0",
              idx < STAGE_TYPES.length - 1 && "lg:border-r border-border"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="font-semibold text-foreground text-xs">
                {stage.label}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium h-5 px-1.5", stage.color)}
            >
              {stage.shortLabel}
            </Badge>
          </div>
        ))}
      </div>

      {/* Matrix Rows */}
      <div className="divide-y divide-border/60">
        {filteredRows.map((row) => {
          const configuredInRow = Object.values(row.cells).filter(Boolean).length;

          return (
            <div
              key={row.language.code}
              className="grid grid-cols-1 lg:grid-cols-12 hover:bg-muted/15 transition-colors"
            >
              {/* Language Cell (Sticky Row Label) */}
              <div className="lg:col-span-3 p-3.5 lg:border-r border-border/60 flex flex-col justify-between gap-2 bg-muted/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {row.language.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono h-4 px-1 py-0 uppercase"
                    >
                      {row.language.code}
                    </Badge>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground mt-0.5 block">
                    {row.language.nativeName}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                  <span className="text-muted-foreground">Configured</span>
                  <Badge
                    variant={configuredInRow === 3 ? "default" : "outline"}
                    className={cn(
                      "text-[10px] font-semibold h-4 px-1.5",
                      configuredInRow === 3
                        ? "bg-emerald-600 text-white"
                        : "text-muted-foreground"
                    )}
                  >
                    {configuredInRow} / 3
                  </Badge>
                </div>
              </div>

              {/* 3 Stage Cells */}
              {STAGE_TYPES.map((stage, idx) => {
                const cellAudio = row.cells[stage.type];
                const isPlaying = Boolean(
                  cellAudio && playingAudioUrl === cellAudio.url
                );

                return (
                  <div
                    key={stage.type}
                    className={cn(
                      "lg:col-span-3 p-2.5",
                      idx < STAGE_TYPES.length - 1 && "lg:border-r border-border/60"
                    )}
                  >
                    <StageAudioCell
                      language={row.language}
                      stageType={stage.type}
                      audio={cellAudio}
                      isPlaying={isPlaying}
                      onPlay={onPlay}
                      onAdd={onAdd}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StageAudiosMatrixTable;
