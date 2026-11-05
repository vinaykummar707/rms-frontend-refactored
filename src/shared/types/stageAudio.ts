import type { ILanguageOption } from "@/features/stops/services/edgeTtsService";

export type StageType = "current_stop" | "next_stop" | "arriving_stop";

export interface IStageTypeMeta {
  type: StageType;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

export const STAGE_TYPES: IStageTypeMeta[] = [
  {
    type: "current_stop",
    label: "Current Stop Is",
    shortLabel: "Current Stop",
    description: "Announced when stationary at or departing a stop",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  {
    type: "next_stop",
    label: "Next Stop Is",
    shortLabel: "Next Stop",
    description: "Announced after departing toward the next destination",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    type: "arriving_stop",
    label: "Arriving Stop Is",
    shortLabel: "Arriving Stop",
    description: "Announced when approaching the arrival perimeter geofence",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
];

export interface IStageAudio {
  id: string;
  language: string;
  stage_type: StageType;
  stage_label: string;
  reference_text: string;
  announcement_text: string;
  file_name: string;
  file_size: number;
  file_format: string;
  url: string;
  storage_path: string;
  voice?: string | null;
  speed?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export type IStageAudioCreate = Omit<IStageAudio, "id" | "created_at" | "updated_at">;
export type IStageAudioUpdate = Pick<IStageAudio, "id"> & Partial<IStageAudioCreate>;

export interface IStageMatrixCell {
  language: ILanguageOption;
  stageType: StageType;
  audio: IStageAudio | null;
}

export interface IStageMatrixRow {
  language: ILanguageOption;
  cells: Record<StageType, IStageAudio | null>;
}
