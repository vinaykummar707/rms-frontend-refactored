import React, { useState, useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import {
  ensureMin,
  ensureNumber,
  getBitmapColumns,
} from "@/shared/utils/measurements";
import LEDBitmapSimulator from "./LedSignBoard";
import { useTabsStore } from "@/features/stores/useTabsStore";
import type { DisplayConfigPostRequest, Simulation, TextConfig } from "@/shared/types/routeConfigV2";
import { useFontFileByLanguage } from "@/shared/utils/getFontFileByLanguage";

interface DisplayEditorProps {
  listIndex: number;
  stopScroll?: boolean;
  ledColor?: string;
  simulation?: Simulation | null;
  onBitmapChange?: (bitmap: string) => void;
}

/**
 * Extracted LED Wrapper to prevent re-creation on every parent render
 */
const LEDWrapper = React.memo(({
  fieldKey, rows, cols, textConfig, isRouteNumber = false,
  fontFamily, stopScroll, basePath, setValue, ledColor, onBitmapChange
}: any) => {
  const fieldPath = `${basePath}.texts.${fieldKey}`;
  const currentBitmap = textConfig?.bitmap || "";
  const currentBitmapRef = React.useRef(currentBitmap);
  currentBitmapRef.current = currentBitmap;

  const handleBitmapChange = useCallback((text: string) => {
    if (text !== currentBitmapRef.current) {
      currentBitmapRef.current = text;
      if (onBitmapChange) {
        onBitmapChange(text);
      } else {
        setValue(`${fieldPath}.bitmap`, text, { shouldDirty: false });
        setValue(`${fieldPath}.fontWidth`, getBitmapColumns(text), { shouldDirty: false });
      }
    }
  }, [fieldPath, setValue, onBitmapChange]);

  return (
    <LEDBitmapSimulator
      key={fieldPath}
      stopScroll={stopScroll}
      rows={rows}
      cols={cols}
      text={textConfig}
      isRouteNumber={isRouteNumber}
      fontFamily={fontFamily}
      onBitmapTextChange={handleBitmapChange}
      ledColor={ledColor}
    />
  );
});

LEDWrapper.displayName = "LEDWrapper";

export function DisplayEditor({
  listIndex,
  stopScroll,
  ledColor,
  simulation,
  onBitmapChange,
}: DisplayEditorProps) {
  const { selectedTab } = useTabsStore();
  const { watch, setValue } = useFormContext<DisplayConfigPostRequest>();
  const getFontFileByLanguage = useFontFileByLanguage();
  const [isScrollStopped, setIsScrollStopped] = useState(stopScroll);

  useEffect(() => {
    setIsScrollStopped(stopScroll);
  }, [stopScroll]);

  const simulationsForTab: Simulation[] = simulation
    ? [simulation]
    : watch(selectedTab as any) || [];
  const safeListIndex = simulationsForTab.length > 0
    ? Math.min(Math.max(0, listIndex), simulationsForTab.length - 1)
    : 0;

  const basePath = `${selectedTab}.${safeListIndex}`;
  const screenConfig: Simulation = simulation || simulationsForTab[safeListIndex];

  if (!screenConfig) return null;

  const zoneConfig = (key: string): TextConfig | undefined => {
    const zone = (screenConfig.texts as Record<string, TextConfig | undefined> | undefined)?.[key];
    return zone ? { ...zone } : zone;
  };

  const commonProps = {
    stopScroll: isScrollStopped,
    basePath,
    setValue,
    ledColor,
    onBitmapChange,
  };

  const texts = (screenConfig.texts || {}) as any;

  const getFontFor = (key: string) => {
    const textObj = texts?.[key];
    const textLang = textObj?.language || "en";
    const textFontHeight = textObj?.fontHeight;
    return getFontFileByLanguage(textLang, key, textFontHeight);
  };

  const renderMultiLayout = () => {
    const splitRoute = watch("is_split_route" as any);
    const sideTextBitmap = texts?.sideText?.bitmap || "";
    const routeBitmap1 = texts?.routeNumber1?.bitmap || "";
    const routeBitmap2 = texts?.routeNumber2?.bitmap || "";

    const routePosition = !splitRoute
      ? (texts?.sideText?.position || "Center")
      : (texts?.routeNumber1?.position || "Center");

    const leftCols = ensureMin(
      splitRoute
        ? Math.max(getBitmapColumns(routeBitmap1), getBitmapColumns(routeBitmap2))
        : getBitmapColumns(sideTextBitmap),
      96
    );

    const availableWidth = ensureNumber(screenConfig.width, 10) - leftCols;

    return (
      <div className={`flex ${routePosition === "Right" ? "flex-row-reverse" : "flex-row"}`}>
        {splitRoute ? (
          <div className="flex flex-col">
            {["routeNumber1", "routeNumber2"].map((key) => (
              <LEDWrapper
                key={key}
                {...commonProps}
                fieldKey={key}
                rows={(screenConfig.height || 16) / 2}
                cols={leftCols + 1}
                textConfig={zoneConfig(key)}
                isRouteNumber={true}
                fontFamily={getFontFor(key)}
                stopScroll={stopScroll}
              />
            ))}
          </div>
        ) : (
          <LEDWrapper
            key="sideText"
            {...commonProps}
            fieldKey="sideText"
            rows={screenConfig.height || 16}
            cols={leftCols + 1}
            textConfig={zoneConfig("sideText")}
            isRouteNumber={true}
            fontFamily={getFontFor("sideText")}
            stopScroll={stopScroll}
          />
        )}

        {screenConfig.format === "two" ? (
          <LEDWrapper
            key="two-text"
            {...commonProps}
            fieldKey="text"
            rows={screenConfig.height || 16}
            cols={ensureMin(availableWidth, 96)}
            textConfig={zoneConfig("text")}
            fontFamily={getFontFor("text")}
            stopScroll={stopScroll}
          />
        ) : (
          <div className="flex flex-col">
            {["upperHalfText", "lowerHalfText"].map((key) => (
              <LEDWrapper
                key={key}
                {...commonProps}
                fieldKey={key}
                rows={(screenConfig.height || 16) / 2}
                cols={ensureMin(availableWidth, 96)}
                textConfig={zoneConfig(key)}
                fontFamily={getFontFor(key)}
                stopScroll={stopScroll}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-start gap-4">
      {screenConfig.format === "single" ? (
        <LEDWrapper
          key={
            simulation
              ? `single-text-${(simulation as any).stopType || ""}-${screenConfig.height || 16}-${screenConfig.width || 160}`
              : "single-text"
          }
          {...commonProps}
          fieldKey="text"
          rows={screenConfig.height || 16}
          cols={ensureNumber(screenConfig.width, 96)}
          textConfig={zoneConfig("text")}
          fontFamily={getFontFor("text")}
          stopScroll={stopScroll}
        />
      ) : (
        renderMultiLayout()
      )}
    </div>
  );
}

export default DisplayEditor;
