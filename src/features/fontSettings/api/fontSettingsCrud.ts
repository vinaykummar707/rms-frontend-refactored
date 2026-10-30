import { createCrudHooks } from "@/shared/hooks/useCrud";
import type { ITextConfig, ITextConfigCreate, ITextConfigUpdate } from "@/shared/types/textConfig";

export const fontSettingsCrud = createCrudHooks<ITextConfig, ITextConfigCreate, ITextConfigUpdate>(
  "font_settings"
);

