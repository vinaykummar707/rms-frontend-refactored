export interface IPremadeAudio {
  id: string;
  reference_text: string;
  announcement_text?: string | null;
  file_name: string;
  file_size: number;
  file_format: string;
  url: string;
  storage_path: string;
  language?: string | null;
  voice?: string | null;
  speed?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export type IPremadeAudioCreate = Omit<
  IPremadeAudio,
  "id" | "created_at" | "updated_at"
>;

export type IPremadeAudioUpdate = Pick<IPremadeAudio, "id"> &
  Partial<Omit<IPremadeAudio, "id" | "created_at" | "updated_at">>;

export type IPremadeAudioDelete = Pick<IPremadeAudio, "id">;
export type IPremadeAudioGet = Pick<IPremadeAudio, "id">;

