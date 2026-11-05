import { createCrudHooks } from "@/shared/hooks/useCrud";
import type {
  IStageAudio,
  IStageAudioCreate,
  IStageAudioUpdate,
} from "@/shared/types/stageAudio";

export const stageAudioCrud = createCrudHooks<
  IStageAudio,
  IStageAudioCreate,
  IStageAudioUpdate
>("stage_audios");

