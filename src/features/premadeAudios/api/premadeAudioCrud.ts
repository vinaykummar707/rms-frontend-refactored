import { createCrudHooks } from "@/shared/hooks/useCrud";
import type {
  IPremadeAudio,
  IPremadeAudioCreate,
  IPremadeAudioUpdate,
} from "@/shared/types/premadeAudio";

export const premadeAudioCrud = createCrudHooks<
  IPremadeAudio,
  IPremadeAudioCreate,
  IPremadeAudioUpdate
>("premade_audios");

