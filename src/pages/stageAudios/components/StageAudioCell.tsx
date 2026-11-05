import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ILanguageOption } from "@/features/stops/services/edgeTtsService";
import type { IStageAudio, StageType } from "@/shared/types/stageAudio";
import {
  Play,
  Pause,
  Plus,
  Pencil,
  Trash2,
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

export interface StageAudioCellProps {
  language: ILanguageOption;
  stageType: StageType;
  audio: IStageAudio | null;
  isPlaying: boolean;
  onPlay: (url: string) => void;
  onAdd: (language: ILanguageOption, stageType: StageType) => void;
  onEdit: (audio: IStageAudio, language: ILanguageOption) => void;
  onDelete: (audio: IStageAudio) => void;
}

export function StageAudioCell({
  language,
  stageType,
  audio,
  isPlaying,
  onPlay,
  onAdd,
  onEdit,
  onDelete,
}: StageAudioCellProps) {
  // 1. Empty / Unconfigured Cell
  if (!audio) {
    return (
      <div className="h-full min-h-[105px] rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors p-3 flex flex-col items-center justify-center gap-2 group">
        <span className="text-[11px] text-muted-foreground/80 font-medium text-center">
          Not configured
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAdd(language, stageType)}
          className="h-7 text-xs px-2.5 gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground font-medium shadow-2xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Audio</span>
        </Button>
      </div>
    );
  }

  // 2. Configured Cell with Playback & Controls
  return (
    <div className="h-full min-h-[105px] rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all p-3 flex flex-col justify-between shadow-2xs group">
      {/* Top Header: Play Button & Announcement Quote */}
      <div className="flex items-start gap-2.5">
        <ActionTooltip
          content={isPlaying ? "Stop audio preview" : "Play announcement preview"}
          side="top"
        >
          <Button
            type="button"
            size="sm"
            variant={isPlaying ? "default" : "outline"}
            className={cn(
              "h-8 w-8 rounded-lg p-0 shrink-0 shadow-2xs transition-all",
              isPlaying
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
            )}
            onClick={() => onPlay(audio.url)}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 ml-0.5" />
            )}
          </Button>
        </ActionTooltip>

        <div className="flex-1 min-w-0 space-y-1">
          <p
            className="text-xs font-semibold text-foreground line-clamp-1 truncate"
            title={audio.reference_text}
          >
            {audio.reference_text}
          </p>
          <p
            className="text-[11px] text-muted-foreground line-clamp-2 italic bg-muted/30 px-1.5 py-0.5 rounded border border-border/40 leading-snug"
            title={audio.announcement_text}
          >
            "{audio.announcement_text}"
          </p>
        </div>
      </div>

      {/* Bottom Footer: Badges & Edit/Delete Actions */}
      <div className="flex items-center justify-between gap-1.5 pt-2 mt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Badge
            variant="outline"
            className="text-[10px] font-medium h-5 px-1.5 py-0 bg-background text-muted-foreground border-border/60 shrink-0"
          >
            {formatFileSize(audio.file_size)}
          </Badge>
          {audio.speed && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono h-5 px-1 py-0 bg-background text-muted-foreground border-border/60 shrink-0"
            >
              {audio.speed}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ActionTooltip content="Edit / Regenerate audio" side="top">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => onEdit(audio, language)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>

          <ActionTooltip content="Delete audio" side="top">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(audio)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>
        </div>
      </div>
    </div>
  );
}

export default StageAudioCell;
