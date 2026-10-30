export interface ITextProperties {
  fontHeight: string;
  fontFamily16: string;
  fontFamily32: string;
  fontFamily8: string;
}

export interface ITextConfigStructure {
  sideText: ITextProperties;
  text: ITextProperties;
  upperHalfText: ITextProperties;
  lowerHalfText: ITextProperties;
  routeNumber1: ITextProperties;
  routeNumber2: ITextProperties;
}

export interface ITextConfig {
  id: string;
  code: string;
  name: string;
  config: string | ITextConfigStructure;
  created_at: string;
  updated_at?: string;
  organization_id?: string | null;
  deleted?: boolean;
}

export interface ITextConfigCreate {
  code: string;
  name: string;
  config: ITextConfigStructure;
  organization_id?: string | null;
}

export type ITextConfigUpdate = Pick<ITextConfig, "id"> &
  Partial<Omit<ITextConfig, "id" | "created_at">>;

export type ITextConfigDelete = Pick<ITextConfig, "id">;
export type ITextConfigGet = Pick<ITextConfig, "id">;

export const texts = [
  "sideText",
  "text",
  "upperHalfText",
  "lowerHalfText",
  "routeNumber1",
  "routeNumber2",
] as const;

export const defaultTextConfig: ITextConfigCreate = {
  code: "",
  name: "",
  config: {
    sideText: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
    text: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
    upperHalfText: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
    lowerHalfText: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
    routeNumber1: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
    routeNumber2: {
      fontHeight: "",
      fontFamily16: "",
      fontFamily32: "",
      fontFamily8: "",
    },
  },
};

