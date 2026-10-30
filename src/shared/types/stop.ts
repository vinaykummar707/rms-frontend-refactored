export interface IStopAudio {
  id: string;
  file_name: string;
  url: string;
  file_size: number;
  created_at: string;
  stop_id: string;
}

export interface IStop {
  id: string;
  name: string;
  name_kn?: string;
  organization_id: string;
  depot_id: string;
  up_latitude: string | null;
  up_longitude: string | null;
  down_latitude: string | null;
  down_longitude: string | null;
  created_at: string;
  updated_at?: string;
  active: boolean;
  deleted?: boolean;
}

export interface IStopWithAudio extends IStop {
  stop_audios?: IStopAudio | IStopAudio[] | null;
}

export type IStopCreate = Omit<Partial<IStop>, "id" | "created_at" | "updated_at"> & {
  name: string;
  depot_id: string;
};

export type IStopUpdate = Pick<IStop, "id"> &
  Partial<Omit<IStop, "id" | "created_at">>;

export type IStopDelete = Pick<IStop, "id">;
export type IStopGet = Pick<IStop, "id">;

