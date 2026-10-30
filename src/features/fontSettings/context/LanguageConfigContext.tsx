import React, { createContext, useContext, useMemo } from "react";
import { fontSettingsCrud } from "../api/fontSettingsCrud";
import type { ITextConfig } from "@/shared/types/textConfig";

type LanguageConfigContextType = {
  configs: ITextConfig[];
  isLoading: boolean;
  isError: boolean;
};

const LanguageConfigContext = createContext<LanguageConfigContextType>({
  configs: [],
  isLoading: true,
  isError: false,
});

const QUERY_OPTIONS = {};

export const LanguageConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, isLoading, isError } = fontSettingsCrud.useList(QUERY_OPTIONS);

  const fontSettings = useMemo(() => {
    if (!data?.data) return [];
    return (data.data as ITextConfig[]).map((item) => ({
      ...item,
      config: typeof item.config === "string" ? JSON.parse(item.config) : item.config,
    }));
  }, [data]);

  const contextValue = useMemo(
    () => ({ configs: fontSettings, isLoading, isError }),
    [fontSettings, isLoading, isError]
  );

  return (
    <LanguageConfigContext.Provider value={contextValue}>
      {children}
    </LanguageConfigContext.Provider>
  );
};

export const useLanguageConfigs = () => useContext(LanguageConfigContext);

