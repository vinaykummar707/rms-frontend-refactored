"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Repeat,
  Layers,
  Columns,
  Plus,
  Minus,
  Trash2,
  Copy,
  Maximize2,
  Search,
  Sparkles,
  Volume2,
  Mic,
  MessageSquare,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  ListFilter,
  MapPin,
  GitBranch,
  VolumeX,
  Radio,
  CheckCircle2,
  AlertCircle,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { DisplayEditor } from "@/features/simulation/components/DisplayEditor";
import { IMEInput } from "@/components/common/IMEInput";
import { AutoTextGenerator } from "@/components/common/AutoTextGenerator";
import { MaterialSymbolPicker } from "@/components/common/MaterialSymbolPicker";
import { JsonViewerDialog } from "@/components/common/JsonViewerDialog";
import { useTabsStore, Tab, type TabType } from "@/features/stores/useTabsStore";
import { useSimulationStore } from "@/features/stores/useSimulationStore";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useDepotStore } from "@/features/stores/useDepotStore";
import { useAuthStore } from "@/core/auth/authStore";
import { useAuthorization } from "@/core/authorization/useAuthorization";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import { Controller, type SubmitHandler, useFormContext } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { IRoute } from "@/shared/types/route";
import { routeCrud } from "@/features/routes/api/routeCrud";
import { stopCrud } from "@/features/stops/api/stopCrud";
import { stageAudioCrud } from "@/features/stageAudios/api/stageAudioCrud";
import {
  computeSyncAnnouncementText,
  getTransliteratedAnnouncementText,
  generateRouteStopRecords,
  generateRouteStageAudioRecords,
} from "@/features/routes/utils/routeAnnouncementTransliteration";
import type { IRouteStopRecord, IRouteStageAudioRecord } from "@/shared/types/routeConfigV2";
import type { IStageAudio, StageType } from "@/shared/types/stageAudio";
import { checkActiveDuplicate } from "@/shared/hooks/useCrud";
import { notify } from "@/core/notifications/notificationService";
import { AVAILABLE_LANGUAGES } from "@/config/constants/languages";
import {
  getDefaultSingleSimulation,
  getDefaultTextConfig,
  getDefaultThreeSimulation,
  getDefaultTwoSimulation,
} from "@/config/constants/defaultRouteValues";
import {
  DEFAULT_SIMULATION_HEIGHTS,
  DEFAULT_SIMULATION_WIDTHS,
  FONT_WEIGHTS,
  type DisplayConfigPostRequest,
  type FontWeight,
  type Position,
  type ScrollType,
  type Simulation,
  type SimulationFormat,
  type SimulationType,
  type TextConfig,
} from "@/shared/types/routeConfigV2";
import {
  getRoutePresetZoneText,
  isAutoRouteZoneText,
  joinSourceDestination,
  migrateSlidesOnSplitRouteToggle,
  ROUTE_SEPARATOR_OPTIONS,
  type RouteFieldValues,
  sanitizeRouteBoards,
  syncSlidesWithRouteFields,
} from "@/shared/utils/simulationUtils";
import {
  useFontFileByLanguage,
  useFontHeightForLanguage,
} from "@/shared/utils/getFontFileByLanguage";
import { fillMissingSlideBitmaps } from "@/features/bitmap/services/bitmapService";
import { cn } from "cn";

const HEIGHT_OPTIONS = DEFAULT_SIMULATION_HEIGHTS;
const WIDTH_OPTIONS = DEFAULT_SIMULATION_WIDTHS;

// Zones rendered at half board height by DisplayEditor
const isHalfHeightZone = (format: SimulationFormat | undefined, key: string) =>
  format !== "single" &&
  (key === "routeNumber1" ||
    key === "routeNumber2" ||
    (format === "three" && (key === "upperHalfText" || key === "lowerHalfText")));

// Clamps zone font heights to a board height, clearing bitmaps that must be regenerated
const fitSimulationToHeight = (s: Simulation, newHeight: number): Simulation => {
  const newTexts: Record<string, any> = { ...(s.texts || {}) };
  Object.keys(newTexts).forEach((k) => {
    const item = newTexts[k];
    if (!item) return;
    const maxFont = isHalfHeightZone(s.format, k) ? Math.floor(newHeight / 2) : newHeight;
    if (!item.fontHeight || item.fontHeight > maxFont) {
      newTexts[k] = { ...item, fontHeight: maxFont, bitmap: "" };
    }
  });
  return { ...s, height: newHeight as Simulation["height"], texts: newTexts as Simulation["texts"] };
};

const FONT_HEIGHT_GRID = [7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];

const BOARD_ITEMS = [
  { id: Tab.FRONT, letter: "F", label: "FRONT" },
  { id: Tab.SIDE, letter: "S", label: "SIDE" },
  { id: Tab.REAR, letter: "R", label: "REAR" },
  { id: Tab.INTERNAL, letter: "I", label: "IN BUS" },
  { id: Tab.STOPS, letter: "ST", label: "STOPS & AUDIO" },
] as const;

const getBoardLabel = (board: string) =>
  BOARD_ITEMS.find((b) => b.id === board)?.label ?? board.toUpperCase();

const getFirstTextZone = (split: boolean) => (split ? "routeNumber1" : "routeNumber");

const ActionTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}> = ({ content, children, side = "top", align = "center" }) => {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} align={align} className="text-[11px] font-medium py-1 px-2.5 z-50">
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3">
    <span className="w-24 flex-none text-xs font-medium text-foreground">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const NumberField: React.FC<{
  value: number | "" | undefined;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}> = ({ value, min, max, step, placeholder, disabled, onChange }) => (
  <input
    type="number"
    min={min}
    max={max}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    value={value ?? ""}
    onChange={(e) => {
      const raw = e.target.value;
      onChange(raw === "" ? undefined : Math.min(Math.max(min, Number(raw) || min), max));
    }}
    className="h-8 w-full rounded-lg bg-muted px-2.5 text-xs font-mono text-foreground border border-input outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
  />
);

const SCROLL_SPEED_TOGGLES = [
  { value: 6, label: "Slow", tip: "Slow scroll speed" },
  { value: 4, label: "Normal", tip: "Normal scroll speed" },
  { value: 1, label: "Fast", tip: "Fast scroll speed" },
] as const;

// Maps any stored speed onto the nearest of the three UI presets (lower value = faster)
const toSpeedPreset = (speed: number) => (speed <= 2 ? 1 : speed <= 5 ? 4 : 6);

const SLIDE_BOARDS = ["front", "side", "rear", "internal"] as const;
const ROUTE_SYNC_FIELDS: string[] = [
  "route_number",
  "route_number_1",
  "route_number_2",
  "source",
  "destination",
  "via",
  "separation",
];

let hasStageAudiosColumnCache: boolean | null = null;
async function checkHasStageAudiosColumn(): Promise<boolean> {
  if (hasStageAudiosColumnCache !== null) return hasStageAudiosColumnCache;
  try {
    const { error } = await supabase.from("routes").select("stage_audios").limit(1);
    hasStageAudiosColumnCache = !error;
  } catch {
    hasStageAudiosColumnCache = false;
  }
  return hasStageAudiosColumnCache;
}

// Split-route number zones are half height, so icons render too small there and are not offered
const isSplitRouteNumberZone = (key: string) => key === "routeNumber1" || key === "routeNumber2";

interface ViaStopItem {
  id: string;
  name: string;
  name_kn?: string;
  isCustom?: boolean;
}

interface RouteCreationLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  mode?: "create" | "edit";
}

export const RouteCreationLayout = React.forwardRef<HTMLDivElement, RouteCreationLayoutProps>(
  function RouteCreationLayout({ className, mode = "create", ...otherProps }, ref) {
    const navigate = useNavigate();
    const { depotId } = useParams<{ areaId?: string; depotId?: string; routeId?: string }>();
    const { selectedOrganization } = useOrganizationStore();
    const selectedDepot = useDepotStore((state) => state.selectedDepot);
    const loggedUser = useAuthStore((state) => state.user);
    const isMasterUser = isSuperAdmin(loggedUser);
    const { isSuperAdmin: checkSuperAdmin, canAccessModule, canAccessRole } = useAuthorization();

    const canSelectStops = useMemo(() => {
      return (
        checkSuperAdmin ||
        canAccessModule("PAS") ||
        canAccessRole(["master", "organization_admin", "region_admin", "depot_admin"])
      );
    }, [checkSuperAdmin, canAccessModule, canAccessRole]);

    // Global Stores
    const { selectedTab, setSelectedTab } = useTabsStore();
    const { selectedSimulationIndex, setSelectedSimulationIndex } = useSimulationStore();

    // React Hook Form
    const methods = useFormContext<DisplayConfigPostRequest & IRoute>();
    const {
      register,
      watch,
      setValue,
      getValues,
      handleSubmit,
      formState,
      setError,
      clearErrors,
      control,
    } = methods;

    const effectiveDepotId = useMemo(() => {
      return depotId || (watch("depot_id") as string) || selectedDepot?.id || "";
    }, [depotId, watch, selectedDepot?.id]);

    const { useCreate, useUpdate } = routeCrud;
    const { mutate: createRoute, isPending: isCreatingRoute } = useCreate();
    const { mutate: updateRoute, isPending: isUpdatingRoute } = useUpdate();

    // Synchronous Tab Switch Handler to prevent blank frame renders and page blinking
    const handleTabChange = useCallback(
      (newTab: TabType) => {
        if (newTab === selectedTab) return;
        const newTabSims: Simulation[] = getValues(newTab as any) || [];
        const nextIndex = newTabSims.length > 0 ? 0 : -1;
        setSelectedSimulationIndex(nextIndex);
        setSelectedTab(newTab);
      },
      [selectedTab, getValues, setSelectedSimulationIndex, setSelectedTab]
    );

    // Local UI State
    const [hasBeenSaved, setHasBeenSaved] = useState(false);
    const submitLockRef = useRef(false);
    const [isPreparingSubmit, setIsPreparingSubmit] = useState(false);
    const releaseSubmitLock = useCallback(() => {
      submitLockRef.current = false;
      setIsPreparingSubmit(false);
    }, []);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [ledColor, setLedColor] = useState<"#ffbf00" | "#ff2222">("#ffbf00");
    const [manualZoom, setManualZoom] = useState<number | null>(null);
    const [fitZoom, setFitZoom] = useState<number>(80);
    const zoom = manualZoom ?? fitZoom;
    const [ledStageEl, setLedStageEl] = useState<HTMLDivElement | null>(null);
    const [ledMatrixEl, setLedMatrixEl] = useState<HTMLDivElement | null>(null);
    const [ledMatrixSize, setLedMatrixSize] = useState<{ width: number; height: number } | null>(null);
    const [isCycling, setIsCycling] = useState<boolean>(false);
    const [showAutoText, setShowAutoText] = useState(false);
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    const [isJsonOpen, setIsJsonOpen] = useState(false);

    useEffect(() => {
      if (!ledStageEl || !ledMatrixEl || typeof ResizeObserver === "undefined") return;
      const BEZEL_CHROME_PX = 42;
      const measure = () => {
        const width = ledMatrixEl.offsetWidth;
        const height = ledMatrixEl.offsetHeight;
        setLedMatrixSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
        const available = ledStageEl.clientWidth - BEZEL_CHROME_PX;
        if (width > 0 && available > 0) {
          setFitZoom(Math.min(100, Math.max(40, Math.floor((available / width) * 100))));
        }
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(ledStageEl);
      observer.observe(ledMatrixEl);
      return () => observer.disconnect();
    }, [ledStageEl, ledMatrixEl]);

    // Stop Announcement Simulator State (for Tab.STOPS)
    const [simStopId, setSimStopId] = useState<string>("");
    const [simStage, setSimStage] = useState<"current" | "next" | "arriving">("current");
    const [simLanguage, setSimLanguage] = useState<string>("en");
    const [desiredLanguages, setDesiredLanguages] = useState<string[]>(["en", "kn"]);
    const [simAnnouncementSlide, setSimAnnouncementSlide] = useState<Simulation | null>(null);
    const [simAnnouncementText, setSimAnnouncementText] = useState<string>("");
    const [playbackPhase, setPlaybackPhase] = useState<"idle" | "playing_stage" | "playing_stop">("idle");
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Language management helpers
    const removeDesiredLanguage = useCallback((code: string) => {
      setDesiredLanguages((prev) => {
        if (prev.length <= 1) {
          notify.warning("At least one language must remain selected");
          return prev;
        }
        return prev.filter((c) => c !== code);
      });
    }, []);

    const addDesiredLanguage = useCallback((code: string) => {
      setDesiredLanguages((prev) => {
        if (prev.includes(code)) return prev;
        return [...prev, code];
      });
    }, []);

    const availableLanguageSelectItems = useMemo(() => {
      const current = new Set(desiredLanguages);
      return AVAILABLE_LANGUAGES.filter((l) => !current.has(l.code)).map((l) => ({
        value: l.code,
        label: l.label,
      }));
    }, [desiredLanguages]);

    // Keep active simulator language aligned with selected desired languages
    useEffect(() => {
      if (desiredLanguages.length > 0 && !desiredLanguages.includes(simLanguage)) {
        setSimLanguage(desiredLanguages[0]);
      }
    }, [desiredLanguages, simLanguage]);

    const filteredSimLanguageItems = useMemo(() => {
      const avail = new Set(desiredLanguages.map((d) => d.toLowerCase()));
      return AVAILABLE_LANGUAGES.filter((l) => avail.has(l.code.toLowerCase())).map((l) => ({
        value: l.code,
        label: l.label,
      }));
    }, [desiredLanguages]);

    // Watch Form Values
    const isSplitRoute = watch("is_split_route");
    const routeNumber = watch("route_number");
    const routeNumber1 = watch("route_number_1");
    const routeNumber2 = watch("route_number_2");
    const source = watch("source");
    const destination = watch("destination");
    const separation = watch("separation");
    const isReturn = watch("return");
    const rawViaFormVal = watch("via");

    // Input modes for Source, Destination, and Via ("select" dropdown or "manual" typing)
    const [sourceInputMode, setSourceInputMode] = useState<"select" | "manual">("select");
    const [destInputMode, setDestInputMode] = useState<"select" | "manual">("select");
    const [viaInputMode, setViaInputMode] = useState<"select" | "manual">("select");

    // Via stops manager state
    const [viaStops, setViaStops] = useState<ViaStopItem[]>([]);
    const [selectedViaPickerId, setSelectedViaPickerId] = useState<string>("");
    const [customViaInput, setCustomViaInput] = useState<string>("");
    const [draggedViaIdx, setDraggedViaIdx] = useState<number | null>(null);
    const [dragOverViaIdx, setDragOverViaIdx] = useState<number | null>(null);
    const hasInitializedVia = useRef(false);

    const languageItems = useMemo(
      () =>
        AVAILABLE_LANGUAGES.map((l) => ({
          value: l.code,
          label: l.label,
        })),
      []
    );

    const separatorItems = useMemo(() => {
      const opts = Array.from(
        new Set([
          ...ROUTE_SEPARATOR_OPTIONS,
          ...(separation && !(ROUTE_SEPARATOR_OPTIONS as readonly string[]).includes(separation)
            ? [separation]
            : []),
        ])
      );
      return opts.map((opt) => ({
        value: opt,
        label: opt === " " ? "Space ( )" : opt,
      }));
    }, [separation]);

    const displayRouteNum = isSplitRoute
      ? `${routeNumber1 || "?"} / ${routeNumber2 || "?"}`
      : routeNumber || "---";

    // Auto-sync existing slides with Route Setup edits
    useEffect(() => {
      const pickRouteFields = (values: object | undefined): RouteFieldValues => {
        const fields = (values || {}) as Record<string, unknown>;
        const read = (key: string) => (typeof fields[key] === "string" ? (fields[key] as string) : "");
        return {
          routeNumber: read("route_number"),
          routeNumber1: read("route_number_1"),
          routeNumber2: read("route_number_2"),
          source: read("source"),
          destination: read("destination"),
          via: read("via"),
          separation: read("separation"),
        };
      };
      let prevFields = pickRouteFields(getValues());
      const subscription = watch((values, { name }) => {
        const nextFields = pickRouteFields(values);
        const prev = prevFields;
        prevFields = nextFields;
        if (!name || !ROUTE_SYNC_FIELDS.includes(name)) return;
        SLIDE_BOARDS.forEach((board) => {
          const { slides, changed } = syncSlidesWithRouteFields(
            getValues(board) || [],
            prev,
            nextFields
          );
          if (changed) {
            setValue(board, slides as any, { shouldDirty: true });
          }
        });
      });
      return () => subscription.unsubscribe();
    }, [watch, getValues, setValue]);

    // Active board simulations with safe index boundary
    const activeBoardVal = watch(selectedTab as any);
    const simulations: Simulation[] = useMemo(() => {
      if (selectedTab === Tab.STOPS) {
        return simAnnouncementSlide ? [simAnnouncementSlide] : [];
      }
      return Array.isArray(activeBoardVal) ? activeBoardVal : [];
    }, [selectedTab, simAnnouncementSlide, activeBoardVal]);
    const safeSimulationIndex =
      simulations.length > 0
        ? Math.min(Math.max(0, selectedSimulationIndex), simulations.length - 1)
        : -1;
    const currentSimulation = safeSimulationIndex >= 0 ? simulations[safeSimulationIndex] : null;

    useEffect(() => {
      if (!simulations || simulations.length === 0) {
        if (selectedSimulationIndex !== -1) setSelectedSimulationIndex(-1);
      } else if (selectedSimulationIndex >= simulations.length || selectedSimulationIndex < 0) {
        setSelectedSimulationIndex(0);
      }
    }, [simulations.length, selectedSimulationIndex, setSelectedSimulationIndex]);

    const [optimisticFormat, setOptimisticFormat] = useState<"single" | "two" | "three" | null>(null);

    useEffect(() => {
      if (currentSimulation && optimisticFormat === currentSimulation.format) {
        setOptimisticFormat(null);
      }
    }, [currentSimulation?.format, optimisticFormat]);

    useEffect(() => {
      setOptimisticFormat(null);
    }, [selectedTab, selectedSimulationIndex]);

    const currentFormat: "single" | "two" | "three" =
      optimisticFormat ?? (currentSimulation?.format as any) ?? "two";

    // Active Text Zone selection state
    const [userTextZone, setUserTextZone] = useState<string>("routeNumber");

    const activeTextZone = useMemo(() => {
      if (!currentSimulation || currentFormat === "single") return "text";
      if (currentFormat === "three") {
        if (isSplitRoute) {
          if (userTextZone === "routeNumber1" || userTextZone === "routeNumber2") return userTextZone;
        } else {
          if (userTextZone === "routeNumber" || userTextZone === "sideText") return "routeNumber";
        }
        if (userTextZone === "upperHalfText" || userTextZone === "lowerHalfText") return userTextZone;
        return isSplitRoute ? "routeNumber1" : "routeNumber";
      }
      if (isSplitRoute) {
        if (
          userTextZone === "routeNumber1" ||
          userTextZone === "routeNumber2" ||
          userTextZone === "text"
        )
          return userTextZone;
        return "routeNumber1";
      }
      if (userTextZone === "text") return "text";
      return "routeNumber";
    }, [currentFormat, userTextZone, isSplitRoute, currentSimulation]);

    const activeTextZoneKey = useMemo(() => {
      if (!currentSimulation || currentFormat === "single") return "text";
      if (activeTextZone === "routeNumber") {
        if (isSplitRoute) return "routeNumber1";
        if (
          currentSimulation.texts &&
          !(currentSimulation.texts as any).sideText &&
          (currentSimulation.texts as any).routeNumber
        ) {
          return "routeNumber";
        }
        return "sideText";
      }
      if (activeTextZone === "routeNumber1" || activeTextZone === "routeNumber2") {
        return isSplitRoute ? activeTextZone : "sideText";
      }
      return activeTextZone;
    }, [currentSimulation, activeTextZone, isSplitRoute, currentFormat]);

    // Ensure active zone has text configuration initialized
    useEffect(() => {
      if (!currentSimulation || safeSimulationIndex < 0 || !activeTextZoneKey) return;
      const texts = currentSimulation.texts || {};
      const currentZoneConfig = (texts as any)[activeTextZoneKey];
      if (!currentZoneConfig) {
        const fallbackText =
          activeTextZone === "routeNumber"
            ? (watch("route_number") as string) || ""
            : activeTextZone === "routeNumber1"
            ? (watch("route_number_1") as string) || ""
            : activeTextZone === "routeNumber2"
            ? (watch("route_number_2") as string) || ""
            : "";
        setValue(
          `${selectedTab}.${safeSimulationIndex}.texts.${activeTextZoneKey}` as any,
          {
            text: fallbackText,
            language: "en",
            fontHeight:
              currentFormat === "three" &&
              (activeTextZoneKey === "upperHalfText" || activeTextZoneKey === "lowerHalfText")
                ? 8
                : 16,
            fontWeight: "Bold",
            position: "Center",
            scrollType: "Fixed",
            scrollSpeed: 4,
            bitmap: "",
          },
          { shouldDirty: false }
        );
      }
    }, [
      selectedTab,
      safeSimulationIndex,
      activeTextZoneKey,
      currentSimulation,
      activeTextZone,
      setValue,
      currentFormat,
      watch,
    ]);

    const pathBase =
      safeSimulationIndex >= 0 ? `${selectedTab}.${safeSimulationIndex}.texts.${activeTextZoneKey}` : "";

    const watchZoneField = <K extends keyof TextConfig>(field: K) =>
      (pathBase ? (watch as unknown as (name: string) => unknown)(`${pathBase}.${field}`) : undefined) as
        | TextConfig[K]
        | undefined;

    const setZoneField = <K extends keyof TextConfig>(field: K, value: TextConfig[K] | undefined) =>
      (setValue as unknown as (name: string, value: unknown, options: { shouldDirty: boolean }) => void)(
        `${pathBase}.${field}`,
        value,
        { shouldDirty: true }
      );

    const currentText = pathBase ? (watch(`${pathBase}.text` as any) as string) || "" : "";
    const currentLanguage = pathBase ? (watch(`${pathBase}.language` as any) as string) || "en" : "en";
    const currentFontHeight = pathBase ? Number(watch(`${pathBase}.fontHeight` as any)) || 14 : 14;
    const currentWeight = pathBase
      ? (watch(`${pathBase}.fontWeight` as any) as string) || "Regular"
      : "Regular";
    const currentPosition = pathBase
      ? (watch(`${pathBase}.position` as any) as string) || "Center"
      : "Center";
    const currentScrollType = pathBase
      ? (watch(`${pathBase}.scrollType` as any) as string) || "Fixed"
      : "Fixed";
    const currentSpeed = pathBase ? Number(watch(`${pathBase}.scrollSpeed` as any)) || 4 : 4;

    const activeWidth = currentSimulation?.width || 160;
    const activeHeight = currentSimulation?.height || 16;

    const currentIcon = pathBase ? (watch(`${pathBase}.icon` as any) as string) || "" : "";
    const iconsAllowed = !isSplitRouteNumberZone(activeTextZoneKey);
    const currentIconPos = pathBase
      ? (watch(`${pathBase}.iconPosition` as any) as string) || "start"
      : "start";
    const currentIconSpacing = pathBase ? Number(watch(`${pathBase}.iconSpacing` as any) ?? 2) : 2;
    const currentIconScale = pathBase ? Number(watch(`${pathBase}.iconWidthScale` as any) ?? 1.0) : 1.0;
    const rawWordIndex = pathBase ? Number(watch(`${pathBase}.iconWordIndex` as any) ?? 1) : 1;
    const wordsList = currentText.trim().split(/\s+/).filter(Boolean);
    const wordsCount = wordsList.length;
    const maxWordIndex = Math.max(1, wordsCount > 1 ? wordsCount - 1 : 1);
    const currentWordIndex = Math.min(Math.max(1, rawWordIndex), maxWordIndex);

    const maxHeight = currentSimulation?.height || 16;
    const isHalfLine = isHalfHeightZone(currentFormat, activeTextZoneKey);
    const maxAllowedFontHeight = isHalfLine ? Math.floor(maxHeight / 2) : maxHeight;

    // Font hooks
    const getDefaultFontHeightForLanguage = useFontHeightForLanguage();
    const getFontFileByLanguage = useFontFileByLanguage();

    const stopFilters = useMemo(
      () => ({ depot_id: effectiveDepotId || "", organization_id: selectedOrganization?.id || "" }),
      [effectiveDepotId, selectedOrganization?.id]
    );

    const { data: stopsData } = stopCrud.useList({
      filters: stopFilters,
      orderBy: { column: "created_at", ascending: false },
      custom(query) {
        return query.select(
          `*,
           stop_audios (
             id,
             url,
             file_name,
             file_size
           )`
        );
      },
      skip: !effectiveDepotId,
    });
    const depotStops = (stopsData?.data as any[]) || [];

    const { data: stageAudiosResponse } = stageAudioCrud.useList({
      orderBy: { column: "created_at", ascending: true },
    });
    const stageAudios = (stageAudiosResponse?.data as IStageAudio[]) || [];

    // Initialize viaStops from form on load
    useEffect(() => {
      if (!hasInitializedVia.current && rawViaFormVal && viaStops.length === 0) {
        const parts = rawViaFormVal.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          const initialItems: ViaStopItem[] = parts.map((part, idx) => {
            const matched = depotStops.find(
              (s) => s.name?.toLowerCase().trim() === part.toLowerCase().trim()
            );
            return {
              id: matched ? matched.id : `custom-via-${idx}-${part}`,
              name: matched ? matched.name : part,
              name_kn: matched?.name_kn,
              isCustom: !matched,
            };
          });
          setViaStops(initialItems);
          hasInitializedVia.current = true;
        }
      }
    }, [rawViaFormVal, depotStops, viaStops.length]);

    // Link custom via stops to catalog when depotStops loads
    useEffect(() => {
      if (depotStops.length > 0 && viaStops.length > 0) {
        let hasChanges = false;
        const updated = viaStops.map((v) => {
          if (v.isCustom) {
            const match = depotStops.find(
              (s) => s.name?.toLowerCase().trim() === v.name.toLowerCase().trim()
            );
            if (match) {
              hasChanges = true;
              return { ...v, id: match.id, name_kn: match.name_kn, isCustom: false };
            }
          }
          return v;
        });
        if (hasChanges) {
          setViaStops(updated);
        }
      }
    }, [depotStops]);

    // Restore desiredLanguages from existing stops in route if present
    const hasInitializedStopsLang = useRef(false);
    useEffect(() => {
      if (!hasInitializedStopsLang.current) {
        const rawStops = getValues("stops" as any);
        if (Array.isArray(rawStops) && rawStops.length > 0) {
          const extractedLangs = new Set<string>();
          rawStops.forEach((st: any) => {
            if (Array.isArray(st?.languages)) {
              st.languages.forEach((l: any) => {
                if (l?.language) extractedLangs.add(l.language);
              });
            } else if (st?.language) {
              extractedLangs.add(st.language);
            }
          });
          if (extractedLangs.size > 0) {
            setDesiredLanguages(Array.from(extractedLangs));
            hasInitializedStopsLang.current = true;
          }
        }
      }
    }, [getValues]);

    // Mutual Exclusion Filtering
    const sourceVal = (source || "").trim();
    const destVal = (destination || "").trim();
    const sourceNorm = sourceVal.toLowerCase();
    const destNorm = destVal.toLowerCase();
    const viaNamesSet = useMemo(
      () => new Set(viaStops.map((v) => v.name.toLowerCase().trim())),
      [viaStops]
    );

    // 1. Available for Source (excludes destination and vias, keeps current source)
    const availableSourceStops = useMemo(() => {
      return depotStops.filter((s) => {
        const sName = (s.name || "").toLowerCase().trim();
        if (!sName) return false;
        if (sName === sourceNorm) return true;
        if (sName === destNorm) return false;
        if (viaNamesSet.has(sName)) return false;
        return true;
      });
    }, [depotStops, sourceNorm, destNorm, viaNamesSet]);

    // 2. Available for Destination (excludes source and vias, keeps current dest)
    const availableDestStops = useMemo(() => {
      return depotStops.filter((s) => {
        const sName = (s.name || "").toLowerCase().trim();
        if (!sName) return false;
        if (sName === destNorm) return true;
        if (sName === sourceNorm) return false;
        if (viaNamesSet.has(sName)) return false;
        return true;
      });
    }, [depotStops, sourceNorm, destNorm, viaNamesSet]);

    // 3. Available for Via addition (excludes current source, destination, and already added vias)
    const availableViaStops = useMemo(() => {
      return depotStops.filter((s) => {
        const sName = (s.name || "").toLowerCase().trim();
        if (!sName) return false;
        if (sName === sourceNorm) return false;
        if (sName === destNorm) return false;
        if (viaNamesSet.has(sName)) return false;
        return true;
      });
    }, [depotStops, sourceNorm, destNorm, viaNamesSet]);

    const sourceSelectItems = useMemo(() => {
      const items = availableSourceStops.map((s) => ({
        value: s.name,
        label: s.name_kn ? `${s.name} (${s.name_kn})` : s.name,
      }));
      if (sourceVal && !items.some((i) => i.value.toLowerCase() === sourceNorm)) {
        items.unshift({
          value: sourceVal,
          label: `${sourceVal} (Custom)`,
        });
      }
      return items;
    }, [availableSourceStops, sourceVal, sourceNorm]);

    const destSelectItems = useMemo(() => {
      const items = availableDestStops.map((s) => ({
        value: s.name,
        label: s.name_kn ? `${s.name} (${s.name_kn})` : s.name,
      }));
      if (destVal && !items.some((i) => i.value.toLowerCase() === destNorm)) {
        items.unshift({
          value: destVal,
          label: `${destVal} (Custom)`,
        });
      }
      return items;
    }, [availableDestStops, destVal, destNorm]);

    const viaSelectItems = useMemo(() => {
      return availableViaStops.map((s) => ({
        value: s.id,
        label: s.name_kn ? `${s.name} (${s.name_kn})` : s.name,
      }));
    }, [availableViaStops]);

    const handleAddViaFromSelect = useCallback(
      (stopId: string) => {
        const stop = depotStops.find((s) => s.id === stopId);
        if (!stop) return;
        const newVia: ViaStopItem = {
          id: stop.id,
          name: stop.name,
          name_kn: stop.name_kn,
          isCustom: false,
        };
        const updated = [...viaStops, newVia];
        setViaStops(updated);
        setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
        setSelectedViaPickerId("");
      },
      [depotStops, viaStops, setValue]
    );

    const handleAddCustomVia = useCallback(() => {
      const trimmed = customViaInput.trim();
      if (!trimmed) return;
      const parts = trimmed.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      const newItems: ViaStopItem[] = [];
      for (const part of parts) {
        const pNorm = part.toLowerCase();
        if (pNorm === sourceNorm || pNorm === destNorm) {
          notify.warning(`"${part}" is already selected as Source or Destination`);
          continue;
        }
        if (
          viaStops.some((v) => v.name.toLowerCase() === pNorm) ||
          newItems.some((v) => v.name.toLowerCase() === pNorm)
        ) {
          notify.warning(`"${part}" is already in the via waypoints list`);
          continue;
        }
        newItems.push({
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: part,
          isCustom: true,
        });
      }
      if (newItems.length > 0) {
        const updated = [...viaStops, ...newItems];
        setViaStops(updated);
        setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
        setCustomViaInput("");
      }
    }, [customViaInput, viaStops, sourceNorm, destNorm, setValue]);

    const handleRemoveVia = useCallback(
      (index: number) => {
        const updated = viaStops.filter((_, idx) => idx !== index);
        setViaStops(updated);
        setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
      },
      [viaStops, setValue]
    );

    const handleMoveViaUp = useCallback(
      (index: number) => {
        if (index === 0) return;
        const updated = [...viaStops];
        const temp = updated[index - 1];
        updated[index - 1] = updated[index];
        updated[index] = temp;
        setViaStops(updated);
        setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
      },
      [viaStops, setValue]
    );

    const handleMoveViaDown = useCallback(
      (index: number) => {
        if (index >= viaStops.length - 1) return;
        const updated = [...viaStops];
        const temp = updated[index + 1];
        updated[index + 1] = updated[index];
        updated[index] = temp;
        setViaStops(updated);
        setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
      },
      [viaStops, setValue]
    );

    const handleViaDragStart = (index: number) => {
      setDraggedViaIdx(index);
    };

    const handleViaDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragOverViaIdx !== index) {
        setDragOverViaIdx(index);
      }
    };

    const handleViaDrop = (dropIndex: number) => {
      if (draggedViaIdx === null || draggedViaIdx === dropIndex) {
        setDraggedViaIdx(null);
        setDragOverViaIdx(null);
        return;
      }
      const updated = [...viaStops];
      const [item] = updated.splice(draggedViaIdx, 1);
      updated.splice(dropIndex, 0, item);
      setViaStops(updated);
      setValue("via", updated.map((v) => v.name).join(", "), { shouldDirty: true });
      setDraggedViaIdx(null);
      setDragOverViaIdx(null);
    };

    // Auto-preview loop timer
    useEffect(() => {
      if (!isCycling || simulations.length <= 1) return;
      const interval = setInterval(() => {
        setSelectedSimulationIndex((prev) => (prev + 1) % simulations.length);
      }, 3500);
      return () => clearInterval(interval);
    }, [isCycling, simulations.length, setSelectedSimulationIndex]);

    // Keyboard shortcut 'r' for return route toggle
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        ) {
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          handleReturnRoute();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isReturn]);

    const handleSwapEndpoints = () => {
      const src = getValues("source");
      const dest = getValues("destination");
      setValue("source", dest, { shouldDirty: true });
      setValue("destination", src, { shouldDirty: true });
      notify.info("Swapped Source and Destination (trip direction unchanged)");
    };

    const handleReturnRoute = () => {
      const src = getValues("source");
      const dest = getValues("destination");
      setValue("source", dest, { shouldDirty: true });
      setValue("destination", src, { shouldDirty: true });
      if (viaStops.length > 1) {
        const reversed = [...viaStops].reverse();
        setViaStops(reversed);
        setValue("via", reversed.map((v) => v.name).join(", "), { shouldDirty: true });
      } else {
        const rawViaList = (getValues("via") || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        if (rawViaList.length > 1) {
          setValue("via", rawViaList.reverse().join(", "), { shouldDirty: true });
        }
      }
      setValue("return", !isReturn, { shouldDirty: true });
      notify.info(!isReturn ? "Return trip: direction reversed" : "Outbound trip: direction restored");
    };

    // =========================================================================
    // STOP ANNOUNCEMENT SIMULATOR ENGINE (Tab.STOPS)
    // =========================================================================
    interface RouteSimStopOption {
      id: string;
      name: string;
      name_kn?: string;
      group: "via" | "endpoint";
      label: string;
      stopAudioUrl?: string | null;
    }

    const simulationRouteStops = useMemo<RouteSimStopOption[]>(() => {
      const options: RouteSimStopOption[] = [];

      // 1. Via waypoints (primary for intermediate stop announcements)
      viaStops.forEach((via, idx) => {
        const matched = depotStops.find(
          (s) =>
            s.id === via.id ||
            (s.name && s.name.toLowerCase().trim() === via.name.toLowerCase().trim())
        );
        const audioRec = Array.isArray(matched?.stop_audios)
          ? matched?.stop_audios[0]
          : matched?.stop_audios;
        options.push({
          id: matched?.id || via.id,
          name: via.name,
          name_kn: via.name_kn || matched?.name_kn,
          group: "via",
          label: `Waypoint #${idx + 1}: ${via.name}`,
          stopAudioUrl: audioRec?.url || null,
        });
      });

      // 2. Endpoints (Source & Destination)
      if (sourceVal) {
        const matched = depotStops.find(
          (s) => s.name && s.name.toLowerCase().trim() === sourceNorm
        );
        const audioRec = Array.isArray(matched?.stop_audios)
          ? matched?.stop_audios[0]
          : matched?.stop_audios;
        options.push({
          id: matched?.id || "source-endpoint",
          name: sourceVal,
          name_kn: matched?.name_kn,
          group: "endpoint",
          label: `Origin: ${sourceVal}`,
          stopAudioUrl: audioRec?.url || null,
        });
      }

      if (destVal) {
        const matched = depotStops.find(
          (s) => s.name && s.name.toLowerCase().trim() === destNorm
        );
        const audioRec = Array.isArray(matched?.stop_audios)
          ? matched?.stop_audios[0]
          : matched?.stop_audios;
        options.push({
          id: matched?.id || "dest-endpoint",
          name: destVal,
          name_kn: matched?.name_kn,
          group: "endpoint",
          label: `Terminus: ${destVal}`,
          stopAudioUrl: audioRec?.url || null,
        });
      }

      return options;
    }, [viaStops, sourceVal, sourceNorm, destVal, destNorm, depotStops]);

    const effectiveSimStops = useMemo<RouteSimStopOption[]>(() => {
      if (simulationRouteStops.length > 0) return simulationRouteStops;
      return depotStops.map((s) => {
        const audioRec = Array.isArray(s.stop_audios) ? s.stop_audios[0] : s.stop_audios;
        return {
          id: s.id,
          name: s.name,
          name_kn: s.name_kn,
          group: "endpoint" as const,
          label: s.name,
          stopAudioUrl: audioRec?.url || null,
        };
      });
    }, [simulationRouteStops, depotStops]);

    const simStopSelectItems = useMemo(
      () =>
        effectiveSimStops.map((s) => ({
          value: s.id,
          label: `${s.label}${s.name_kn ? ` (${s.name_kn})` : ""}`,
        })),
      [effectiveSimStops]
    );

    useEffect(() => {
      if (selectedTab === Tab.STOPS && effectiveSimStops.length > 0) {
        if (!simStopId || !effectiveSimStops.some((s) => s.id === simStopId)) {
          setSimStopId(effectiveSimStops[0].id);
        }
      }
    }, [selectedTab, effectiveSimStops, simStopId]);

    const selectedSimStop = useMemo(() => {
      return effectiveSimStops.find((s) => s.id === simStopId) || effectiveSimStops[0] || null;
    }, [effectiveSimStops, simStopId]);

    const stageTypeMap: Record<string, StageType> = {
      current: "current_stop",
      next: "next_stop",
      arriving: "arriving_stop",
    };

    const targetStageType = stageTypeMap[simStage] || "current_stop";

    const matchedStageAudio = useMemo(() => {
      const langLower = simLanguage.toLowerCase();
      return stageAudios.find((a) => {
        if (a.stage_type !== targetStageType) return false;
        const aLang = (a.language || "").toLowerCase();
        return (
          aLang === langLower ||
          aLang.startsWith(langLower + "-") ||
          langLower.startsWith(aLang + "-")
        );
      });
    }, [stageAudios, targetStageType, simLanguage]);

    const staticLangPreset = useMemo(() => {
      return AVAILABLE_LANGUAGES.find((l) => l.code.toLowerCase() === simLanguage.toLowerCase());
    }, [simLanguage]);

    const stageAudioUrl = useMemo(() => {
      if (matchedStageAudio?.url) return matchedStageAudio.url;
      if (simStage === "current") return staticLangPreset?.current || null;
      if (simStage === "next") return staticLangPreset?.next || null;
      return staticLangPreset?.coming || null;
    }, [matchedStageAudio, staticLangPreset, simStage]);

    const stopAudioUrl = useMemo(() => {
      if (!selectedSimStop) return null;
      if (selectedSimStop.stopAudioUrl) return selectedSimStop.stopAudioUrl;
      const matched = depotStops.find(
        (s) =>
          s.id === selectedSimStop.id ||
          (s.name && s.name.toLowerCase().trim() === selectedSimStop.name.toLowerCase().trim())
      );
      const audioRec = Array.isArray(matched?.stop_audios)
        ? matched?.stop_audios[0]
        : matched?.stop_audios;
      return audioRec?.url || null;
    }, [selectedSimStop, depotStops]);

    const computeAnnouncementText = useCallback(
      (stop: RouteSimStopOption, stage: "current" | "next" | "arriving", lang: string) => {
        return computeSyncAnnouncementText(stop, stage, lang);
      },
      []
    );

    const stopChainedAudio = useCallback(() => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setPlaybackPhase("idle");
    }, []);

    const playChainedAudio = useCallback(
      (stageUrl: string | null, stopUrl: string | null) => {
        if (!audioPlayerRef.current) {
          audioPlayerRef.current = new Audio();
        }
        const audio = audioPlayerRef.current;
        audio.pause();
        audio.currentTime = 0;

        if (stageUrl && stopUrl) {
          setPlaybackPhase("playing_stage");
          audio.src = stageUrl;
          audio.onended = () => {
            setPlaybackPhase("playing_stop");
            audio.src = stopUrl;
            audio.onended = () => setPlaybackPhase("idle");
            audio.onerror = () => setPlaybackPhase("idle");
            audio.play().catch(() => setPlaybackPhase("idle"));
          };
          audio.onerror = () => {
            setPlaybackPhase("playing_stop");
            audio.src = stopUrl;
            audio.onended = () => setPlaybackPhase("idle");
            audio.play().catch(() => setPlaybackPhase("idle"));
          };
          audio.play().catch((e) => {
            console.warn("Stage audio play error:", e);
            setPlaybackPhase("idle");
          });
        } else if (stageUrl) {
          setPlaybackPhase("playing_stage");
          audio.src = stageUrl;
          audio.onended = () => setPlaybackPhase("idle");
          audio.onerror = () => setPlaybackPhase("idle");
          audio.play().catch(() => setPlaybackPhase("idle"));
        } else if (stopUrl) {
          setPlaybackPhase("playing_stop");
          audio.src = stopUrl;
          audio.onended = () => setPlaybackPhase("idle");
          audio.onerror = () => setPlaybackPhase("idle");
          audio.play().catch(() => setPlaybackPhase("idle"));
        } else {
          setPlaybackPhase("idle");
        }
      },
      []
    );

    useEffect(() => {
      return () => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.removeAttribute("src");
        }
      };
    }, []);

    useEffect(() => {
      if (selectedTab !== Tab.STOPS && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlaybackPhase("idle");
      }
    }, [selectedTab]);

    const syncStopAnnouncementSimulation = useCallback(
      (
        text: string,
        stage: "current" | "next" | "arriving",
        lang: string,
        stageAudio: string | null,
        stopAudio: string | null
      ) => {
        const singleSlide: Simulation = {
          format: "single",
          texts: {
            text: {
              text,
              scrollType: "Right To Left",
              scrollSpeed: 4,
              fontHeight: 16,
              fontWidth: 12,
              fontWeight: "Bold",
              position: "Center",
              language: lang,
              bitmap: "",
              icon: "",
              iconPosition: "start",
              iconSpacing: 2,
              iconWidthScale: 1.0,
            },
          },
          height: 16,
          width: currentSimulation?.width || 160,
          type: "stop",
          stopType: stage as any,
          audioFileUrl: stopAudio,
          stopTypeAudioFileUrl: stageAudio,
        };

        setSimAnnouncementSlide(singleSlide);
        setSelectedSimulationIndex(0);
        setIsPaused(false);
      },
      [currentSimulation?.width, setSelectedSimulationIndex]
    );

    const prevSimTriggerRef = useRef<string>("");
    useEffect(() => {
      if (selectedTab !== Tab.STOPS || !selectedSimStop) return;

      const triggerKey = `${selectedSimStop.id}_${simStage}_${simLanguage}`;
      const hasChanged = prevSimTriggerRef.current !== triggerKey;
      prevSimTriggerRef.current = triggerKey;

      // 1. Immediate sync computation so the preview and slide are never blank
      const initialText = computeSyncAnnouncementText(selectedSimStop, simStage, simLanguage);
      setSimAnnouncementText(initialText);

      syncStopAnnouncementSimulation(
        initialText,
        simStage,
        simLanguage,
        stageAudioUrl,
        stopAudioUrl
      );

      if (hasChanged) {
        playChainedAudio(stageAudioUrl, stopAudioUrl);
      }

      // 2. Asynchronously resolve transliterated text if needed
      let isCancelled = false;
      getTransliteratedAnnouncementText(selectedSimStop, simStage, simLanguage)
        .then((resolvedText) => {
          if (!isCancelled && resolvedText) {
            setSimAnnouncementText(resolvedText);
            syncStopAnnouncementSimulation(
              resolvedText,
              simStage,
              simLanguage,
              stageAudioUrl,
              stopAudioUrl
            );
          }
        })
        .catch((err) => {
          console.warn("Announcement transliteration failed:", err);
        });

      return () => {
        isCancelled = true;
      };
    }, [
      selectedTab,
      selectedSimStop,
      simStage,
      simLanguage,
      stageAudioUrl,
      stopAudioUrl,
      syncStopAnnouncementSimulation,
      playChainedAudio,
    ]);

    // Background generator: Syncs clean IRouteStopRecord[] for all stops with desired languages & bitmaps
    useEffect(() => {
      let isCancelled = false;
      if (simulationRouteStops.length > 0 && desiredLanguages.length > 0) {
        generateRouteStopRecords({
          stops: simulationRouteStops,
          languages: desiredLanguages,
          depotStops,
          getFontFamily: getFontFileByLanguage,
        })
          .then((generatedStops) => {
            if (!isCancelled && generatedStops.length > 0) {
              setValue("stops" as any, generatedStops, { shouldDirty: false });
            }
          })
          .catch((err) => {
            console.warn("Could not generate stops records:", err);
          });
      }
      return () => {
        isCancelled = true;
      };
    }, [simulationRouteStops, desiredLanguages, depotStops, getFontFileByLanguage, setValue]);

    const handleToggleSplitRoute = (checked: boolean) => {
      setValue("is_split_route", checked, { shouldDirty: true });
      const boards = ["front", "side", "rear", "internal"] as const;
      const routeNumbers = {
        routeNumber: getValues("route_number"),
        routeNumber1: getValues("route_number_1"),
        routeNumber2: getValues("route_number_2"),
      };
      boards.forEach((board) => {
        const slides = getValues(board) || [];
        if (slides.length > 0) {
          const updated = migrateSlidesOnSplitRouteToggle(slides, checked, routeNumbers);
          setValue(board, updated as any, { shouldDirty: true });
        }
      });
    };

    const handleFormatChange = (newFormat: "single" | "two" | "three") => {
      if (!currentSimulation || currentFormat === newFormat) return;
      setOptimisticFormat(newFormat);

      const w = currentSimulation.width;
      const h = currentSimulation.height;
      const t = currentSimulation.type;
      const oldFormat = currentSimulation.format;
      const existingTexts: Record<string, any> = currentSimulation.texts || {};
      const routeValues: RouteFieldValues = {
        routeNumber: getValues("route_number") || "",
        routeNumber1: getValues("route_number_1") || "",
        routeNumber2: getValues("route_number_2") || "",
        source: getValues("source") || "",
        destination: getValues("destination") || "",
        via: getValues("via") || "",
        separation: getValues("separation") || "",
      };
      const halfRows = Math.floor(h / 2);
      const defaultFontHeight = getDefaultTextConfig().fontHeight || 14;
      const isRouteSlide = !t || t === "route";

      const buildZone = (targetKey: string, sourceKeys: string[]) => {
        const preset = isRouteSlide ? getRoutePresetZoneText(newFormat, targetKey, routeValues) ?? "" : "";
        const sourceKey = sourceKeys.find((key) => existingTexts[key]);
        const targetIsHalf = isHalfHeightZone(newFormat, targetKey);
        const maxRows = targetIsHalf ? Math.max(7, halfRows) : h;
        if (!sourceKey) {
          const created = getDefaultTextConfig(preset);
          return { ...created, fontHeight: Math.min(created.fontHeight || defaultFontHeight, maxRows) };
        }

        let cfg = existingTexts[sourceKey];
        if (
          isRouteSlide &&
          cfg.text !== preset &&
          isAutoRouteZoneText(oldFormat, sourceKey, cfg.text, routeValues)
        ) {
          cfg = { ...cfg, text: preset, bitmap: "" };
        }

        let fontHeight = Math.min(cfg.fontHeight || Math.min(defaultFontHeight, maxRows), maxRows);
        if (
          !targetIsHalf &&
          isHalfHeightZone(oldFormat, sourceKey) &&
          (!cfg.fontHeight || cfg.fontHeight >= halfRows)
        ) {
          fontHeight = Math.min(defaultFontHeight, h);
        }
        return fontHeight === cfg.fontHeight ? cfg : { ...cfg, fontHeight, bitmap: "" };
      };

      const routeNumberZones = isSplitRoute
        ? {
            routeNumber1:
              existingTexts.routeNumber1 ||
              getDefaultTextConfig(getRoutePresetZoneText(newFormat, "routeNumber1", routeValues)),
            routeNumber2:
              existingTexts.routeNumber2 ||
              getDefaultTextConfig(getRoutePresetZoneText(newFormat, "routeNumber2", routeValues)),
          }
        : {
            sideText:
              existingTexts.sideText ||
              getDefaultTextConfig(getRoutePresetZoneText(newFormat, "sideText", routeValues)),
          };

      let updatedTexts: Record<string, any>;
      if (newFormat === "single") {
        updatedTexts = { text: buildZone("text", ["text", "upperHalfText"]) };
      } else if (newFormat === "two") {
        updatedTexts = { text: buildZone("text", ["text", "upperHalfText"]), ...routeNumberZones };
      } else {
        updatedTexts = {
          upperHalfText: buildZone("upperHalfText", ["upperHalfText", "text"]),
          lowerHalfText: buildZone("lowerHalfText", ["lowerHalfText"]),
          ...routeNumberZones,
        };
      }

      const updated: Simulation = {
        ...currentSimulation,
        format: newFormat,
        width: w,
        height: h,
        type: t,
        texts: updatedTexts as Simulation["texts"],
      };

      const targetIndex = safeSimulationIndex >= 0 ? safeSimulationIndex : selectedSimulationIndex;
      setValue(`${selectedTab}.${targetIndex}` as any, updated, { shouldDirty: true });
      setUserTextZone(newFormat === "single" ? "text" : getFirstTextZone(isSplitRoute));
    };

    const handleHeightChange = (newHeight: 16 | 32) => {
      const sims: Simulation[] = getValues(selectedTab as any) || [];
      if (sims.length === 0) return;
      const updated = sims.map((s) => fitSimulationToHeight(s, newHeight));
      setValue(selectedTab as any, updated, { shouldDirty: true });
    };

    const handleWidthChange = (newWidth: (typeof WIDTH_OPTIONS)[number]) => {
      const sims: Simulation[] = getValues(selectedTab as any) || [];
      if (sims.length === 0) return;
      const updated = sims.map((s) => ({ ...s, width: newWidth }));
      setValue(selectedTab as any, updated, { shouldDirty: true });
    };

    // Slide Operations
    const handleAddSlide = (format: "single" | "two" | "three", type: SimulationType = "route") => {
      let newSim: Simulation;
      const routeNum = isSplitRoute
        ? `${getValues("route_number_1") || ""}/${getValues("route_number_2") || ""}`
        : getValues("route_number") || "";
      const sourceDestination = joinSourceDestination(
        getValues("source"),
        getValues("destination"),
        getValues("separation")
      );
      const routeText = [sourceDestination, getValues("via")].filter(Boolean).join(" - ");

      if (format === "single") {
        const singlePreset =
          type === "slogan"
            ? "PLEASE WEAR SEAT BELT - ಸುರಕ್ಷಿತ ಪ್ರಯಾಣ"
            : type === "special message"
            ? "THIS IS A SPECIAL MESSAGE SIMULATION"
            : routeText || "Single Route Text";
        newSim = getDefaultSingleSimulation(singlePreset, type);
      } else if (format === "two") {
        newSim = getDefaultTwoSimulation(
          routeNum,
          routeText,
          type,
          getValues("route_number_1"),
          getValues("route_number_2"),
          isSplitRoute
        );
      } else {
        newSim = getDefaultThreeSimulation(
          routeNum,
          sourceDestination,
          getValues("via") || "",
          type,
          getValues("route_number_1"),
          getValues("route_number_2"),
          isSplitRoute
        );
      }

      if (currentSimulation) {
        newSim.height = currentSimulation.height;
        newSim.width = currentSimulation.width;
      }
      newSim = fitSimulationToHeight(newSim, newSim.height);

      const curList: Simulation[] = getValues(selectedTab as any) || [];
      const updatedList = [...curList, newSim];
      setValue(selectedTab as any, updatedList, { shouldDirty: true });
      setSelectedSimulationIndex(updatedList.length - 1);
    };

    const handleDuplicateSlide = (indexToDup?: number) => {
      const idx = typeof indexToDup === "number" ? indexToDup : selectedSimulationIndex;
      const list = getValues(selectedTab as any) || [];
      const target = list[idx];
      if (!target) return;
      const clone =
        typeof structuredClone === "function" ? structuredClone(target) : JSON.parse(JSON.stringify(target));
      const nextList = [...list, clone];
      setValue(selectedTab as any, nextList, { shouldDirty: true });
      setSelectedSimulationIndex(nextList.length - 1);
      notify.success(`Duplicated Slide #${idx + 1}`);
    };

    const handleMoveSlide = (idx: number, direction: "up" | "down") => {
      const list = [...(getValues(selectedTab as any) || [])];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return;
      [list[idx], list[targetIdx]] = [list[targetIdx], list[idx]];
      setValue(selectedTab as any, list, { shouldDirty: true });
      setSelectedSimulationIndex(targetIdx);
    };

    const handleRemoveSlide = (idx: number) => {
      const list = [...(getValues(selectedTab as any) || [])];
      list.splice(idx, 1);
      setValue(selectedTab as any, list, { shouldDirty: true });
      setSelectedSimulationIndex(list.length > 0 ? Math.min(idx, list.length - 1) : -1);
    };

    const handleClearAllSlides = () => {
      if (
        window.confirm(`Are you sure you want to delete all slides on ${getBoardLabel(selectedTab)} display?`)
      ) {
        setValue(selectedTab as any, [], { shouldDirty: true });
        setSelectedSimulationIndex(-1);
      }
    };

    const handleCopyAllToBoard = (destBoard: string) => {
      const currentSims = getValues(selectedTab as any) || [];
      if (currentSims.length === 0 || !destBoard || destBoard === selectedTab) return;
      const cloned = JSON.parse(JSON.stringify(currentSims));
      setValue(destBoard as any, cloned, { shouldDirty: true });
      notify.success(`Copied all ${currentSims.length} slides to ${getBoardLabel(destBoard)} signboard!`);
    };

    const handleCopySlideToBoard = (destBoard: string) => {
      if (!currentSimulation || destBoard === selectedTab) return;
      const destSims: Simulation[] = getValues(destBoard as any) || [];
      let cloned: Simulation = JSON.parse(JSON.stringify(currentSimulation));
      const destDims = destSims[0];
      if (destDims?.width && destDims?.height) {
        if (cloned.height !== destDims.height) cloned = fitSimulationToHeight(cloned, destDims.height);
        cloned = { ...cloned, width: destDims.width };
      }
      setValue(destBoard as any, [...destSims, cloned], { shouldDirty: true });
      notify.success(`Slide #${selectedSimulationIndex + 1} copied to ${getBoardLabel(destBoard)} signboard!`);
    };

    const handleToggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    const onSubmit: SubmitHandler<IRoute> = async (data: any) => {
      if (submitLockRef.current || isCreatingRoute || isUpdatingRoute) return;
      submitLockRef.current = true;
      setIsPreparingSubmit(true);
      let handedOffToMutation = false;

      try {
        const trimmedRouteNum1 = (data.route_number_1 || "").trim();
        const trimmedRouteNum2 = (data.route_number_2 || "").trim();
        const separator = (data.separation || "").trim() || "-";
        const routeNumberJoiner = /^[a-z]/i.test(separator) ? ` ${separator} ` : separator;
        const trimmedRouteNum = data.is_split_route
          ? `${trimmedRouteNum1}${routeNumberJoiner}${trimmedRouteNum2}`
          : (data.route_number || "").trim();

        if (data.is_split_route) {
          if (!trimmedRouteNum1 || !trimmedRouteNum2) {
            setError("route_number", {
              message: "Both Route #1 and Route #2 are required for Split Route",
            });
            notify.error("Both Route #1 and Route #2 are required for Split Route");
            return;
          }
        } else if (!trimmedRouteNum) {
          setError("route_number", { message: "Route number is required" });
          notify.error("Route number is required");
          return;
        }

        if (trimmedRouteNum) {
          const scopeFilter: Record<string, any> = {};
          if (data.depot_id) {
            scopeFilter.depot_id = data.depot_id;
          } else if (data.created_by) {
            scopeFilter.created_by = data.created_by;
          }

          const isReturnTrip = Boolean(data.return);
          const isDup = await checkActiveDuplicate(
            "routes",
            "route_number",
            trimmedRouteNum,
            scopeFilter,
            mode === "edit" && data.id ? data.id : undefined,
            (query) => (isReturnTrip ? query.eq("return", true) : query.not("return", "is", true))
          );

          if (isDup) {
            notify.error(
              `A ${isReturnTrip ? "return" : "outbound"} route with number "${trimmedRouteNum}" already exists in this depot.`
            );
            return;
          }
        }

        // Auto-sync via stops to depot
        if (data.via && data.depot_id) {
          try {
            const rawViaList = data.via.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
            if (rawViaList.length > 0) {
              const { data: existingStops } = await supabase
                .from("stops")
                .select("name")
                .eq("depot_id", data.depot_id);
              const existingSet = new Set(
                (existingStops || []).map((s: any) => s.name?.toLowerCase().trim())
              );
              const newStops = rawViaList
                .filter((s: string) => !existingSet.has(s.toLowerCase()))
                .map((s: string) => ({
                  name: s,
                  depot_id: data.depot_id,
                  organization_id: data.organization_id || null,
                }));
              if (newStops.length > 0) {
                await supabase.from("stops").insert(newStops);
              }
            }
          } catch (e) {
            console.warn("Could not auto-sync via stops:", e);
          }
        }

        const cleanedData: Record<string, any> = sanitizeRouteBoards(data);
        const bitmapResults = await Promise.all(
          SLIDE_BOARDS.map((board) =>
            fillMissingSlideBitmaps(cleanedData[board], {
              isSplitRoute: Boolean(data.is_split_route),
              getFontFamily: getFontFileByLanguage,
            })
          )
        );

        let missingBitmaps = 0;
        SLIDE_BOARDS.forEach((board, i) => {
          if (Array.isArray(cleanedData[board])) cleanedData[board] = bitmapResults[i].slides;
          missingBitmaps += bitmapResults[i].failed;
        });

        if (missingBitmaps > 0) {
          notify.warning(
            `${missingBitmaps} slide text bitmap(s) could not be generated. Open those slides to regenerate them.`
          );
        }

        // Generate structured V2 stops records with desired languages & bitmaps
        let stopsPayload: IRouteStopRecord[] = [];
        try {
          stopsPayload = await generateRouteStopRecords({
            stops: simulationRouteStops,
            languages: desiredLanguages,
            depotStops,
            getFontFamily: getFontFileByLanguage,
          });
          setValue("stops" as any, stopsPayload);
        } catch (stopGenError) {
          console.warn("Could not generate stops records on submit:", stopGenError);
          stopsPayload = (getValues("stops" as any) || []) as IRouteStopRecord[];
        }

        // Generate structured V2 stage audios records with desired languages & bitmaps
        let stageAudiosPayload: IRouteStageAudioRecord[] = [];
        try {
          stageAudiosPayload = await generateRouteStageAudioRecords({
            languages: desiredLanguages,
            stageAudios,
            getFontFamily: getFontFileByLanguage,
          });
          setValue("stage_audios" as any, stageAudiosPayload);
        } catch (stageGenError) {
          console.warn("Could not generate stage audios records on submit:", stageGenError);
          stageAudiosPayload = (getValues("stage_audios" as any) || []) as IRouteStageAudioRecord[];
        }

        const hasStageAudiosCol = await checkHasStageAudiosColumn();

        const payload: Record<string, any> = {
          ...cleanedData,
          route_number: trimmedRouteNum,
          route_number_1: data.is_split_route ? trimmedRouteNum1 : "",
          route_number_2: data.is_split_route ? trimmedRouteNum2 : "",
          separation: separator,
          stops: stopsPayload,
        };

        if (hasStageAudiosCol) {
          payload.stage_audios = stageAudiosPayload;
        }

        if (mode === "edit") {
          updateRoute(
            { id: data.id, payload: { ...payload, id: data.id } },
            {
              onSuccess: () => {
                notify.success("Route updated successfully");
                setHasBeenSaved(true);
                navigate(-1);
              },
              onError: (err: any) => {
                notify.error(
                  err?.code === "23505"
                    ? `Route number "${trimmedRouteNum}" is already used by another route in this depot.`
                    : `Error updating route: ${err.message || "Unknown error"}`
                );
              },
              onSettled: releaseSubmitLock,
            }
          );
        } else {
          createRoute(payload, {
            onSuccess: () => {
              notify.success("Route created successfully");
              setHasBeenSaved(true);
              navigate(-1);
            },
            onError: (err: any) => {
              notify.error(
                err?.code === "23505"
                  ? `Route number "${trimmedRouteNum}" is already used by another route in this depot.`
                  : `Error creating route: ${err.message || "Unknown error"}`
              );
            },
            onSettled: releaseSubmitLock,
          });
        }
        handedOffToMutation = true;
      } finally {
        if (!handedOffToMutation) releaseSubmitLock();
      }
    };

    const handleBackClick = () => {
      if (!hasBeenSaved && formState.isDirty) {
        setShowConfirmDialog(true);
      } else {
        navigate(-1);
      }
    };

    const currentBoardItem = BOARD_ITEMS.find((b) => b.id === selectedTab) || BOARD_ITEMS[0];
    const formatLabel =
      currentFormat === "two"
        ? "Two Line"
        : currentFormat === "three"
        ? "Three Line"
        : "Single Line";

    return (
      <TooltipProvider>
        <div
          ref={ref}
          className={cn(
            "flex h-[100dvh] w-full flex-col bg-background text-foreground overflow-hidden select-none font-sans",
            className
          )}
          {...otherProps}
        >
          {/* ========================================================= */}
          {/* TOP APPLICATION BAR                                      */}
          {/* ========================================================= */}
          <div className="relative flex h-12 w-full flex-none items-center justify-between border-b border-border bg-card px-4 gap-2 select-none">
            {/* Left: Back & Route Identity */}
            <div className="flex items-center gap-2.5 min-w-0 shrink-0">
              <ActionTooltip content="Return to Routes list" side="bottom">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium px-2.5"
                  onClick={handleBackClick}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </ActionTooltip>

              <span className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-mono font-bold text-xs tracking-wider shadow-xs flex-none">
                {displayRouteNum}
              </span>

              <span className="hidden sm:inline-block text-xs font-bold text-foreground uppercase tracking-wide truncate max-w-[140px] md:max-w-[200px] lg:max-w-[280px]">
                {source || "ORIGIN"} ⇄ {destination || "TERMINUS"}
              </span>

              {formState.isDirty && !hasBeenSaved ? (
                <span
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 dark:text-amber-400 font-semibold shrink-0"
                  title="Unsaved changes"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved
                </span>
              ) : (
                <span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved
                </span>
              )}
            </div>

            {/* Center: Zoom & Reset Controls */}
            {simulations.length > 0 && currentSimulation && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-muted/60 border border-border px-2 py-1 rounded-lg shadow-2xs z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  disabled={zoom <= 50}
                  onClick={() => setManualZoom(Math.max(10, zoom - 15))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-xs text-muted-foreground font-semibold flex items-center gap-1 min-w-[50px] justify-center select-none">
                  <Search className="h-3 w-3" /> {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  disabled={zoom >= 100}
                  onClick={() => setManualZoom(Math.min(175, zoom + 15))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <ActionTooltip content="Reset display zoom to fit the available width" side="bottom">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] font-medium px-2 ml-0.5"
                    onClick={() => setManualZoom(null)}
                  >
                    Reset
                  </Button>
                </ActionTooltip>
              </div>
            )}

            {/* Right: Consolidated Studio Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Amber / Red Color Toggle */}
              <ToggleGroup
                size="sm"
                variant="outline"
                spacing={1}
                value={[ledColor]}
                onValueChange={(val) => {
                  if (val.length > 0) setLedColor(val[0] as "#ffbf00" | "#ff2222");
                }}
              >
                <ActionTooltip content="Set signboard LED color to Amber" side="bottom">
                  <ToggleGroupItem
                    value="#ffbf00"
                    aria-label="Set signboard LED color to Amber"
                    className="h-8 text-xs font-semibold px-2.5 data-[pressed]:bg-amber-500/20 data-[pressed]:text-amber-700 dark:data-[pressed]:text-amber-300 data-[pressed]:border-amber-500/40"
                  >
                    Amber
                  </ToggleGroupItem>
                </ActionTooltip>
                <ActionTooltip content="Set signboard LED color to Red" side="bottom">
                  <ToggleGroupItem
                    value="#ff2222"
                    aria-label="Set signboard LED color to Red"
                    className="h-8 text-xs font-semibold px-2.5 data-[pressed]:bg-red-500/20 data-[pressed]:text-red-700 dark:data-[pressed]:text-red-300 data-[pressed]:border-red-500/40"
                  >
                    Red
                  </ToggleGroupItem>
                </ActionTooltip>
              </ToggleGroup>

              {/* Pause / Play */}
              <ActionTooltip
                content={isPaused ? "Resume LED scroll simulation" : "Pause LED scroll simulation"}
                side="bottom"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium px-2.5"
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
                  {isPaused ? "Play" : "Pause"}
                </Button>
              </ActionTooltip>

              {/* JSON Modal */}
              {isMasterUser && (
                <ActionTooltip content="Inspect raw JSON configuration" side="bottom">
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium px-2.5"
                      onClick={async () => {
                        try {
                          const [genStops, genStages] = await Promise.all([
                            generateRouteStopRecords({
                              stops: simulationRouteStops,
                              languages: desiredLanguages,
                              depotStops,
                              getFontFamily: getFontFileByLanguage,
                            }),
                            generateRouteStageAudioRecords({
                              languages: desiredLanguages,
                              stageAudios,
                              getFontFamily: getFontFileByLanguage,
                            }),
                          ]);
                          setValue("stops" as any, genStops);
                          setValue("stage_audios" as any, genStages);
                        } catch (err) {
                          console.warn("Could not regenerate stops/stage audios for JSON preview:", err);
                        }
                        setIsJsonOpen(true);
                      }}
                    >
                      JSON
                    </Button>
                    <JsonViewerDialog
                      open={isJsonOpen}
                      onOpenChange={setIsJsonOpen}
                      title="Route Configuration JSON"
                      data={{
                        ...sanitizeRouteBoards(getValues() as any),
                        stops: getValues("stops" as any) || [],
                        stage_audios: getValues("stage_audios" as any) || [],
                      }}
                    />
                  </div>
                </ActionTooltip>
              )}

              {/* Fullscreen */}
              <ActionTooltip content="Toggle fullscreen editor view" side="bottom">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleFullscreen}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </ActionTooltip>

              {/* Save Route Button */}
              <ActionTooltip
                content={mode === "create" ? "Save new route to database" : "Save updates to route"}
                side="bottom"
              >
                <Button
                  type="submit"
                  onClick={handleSubmit(onSubmit)}
                  size="sm"
                  className="h-8 text-xs font-semibold px-3.5 shadow-xs"
                  disabled={isPreparingSubmit || isCreatingRoute || isUpdatingRoute}
                >
                  {isPreparingSubmit || isCreatingRoute || isUpdatingRoute
                    ? mode === "create"
                      ? "Saving..."
                      : "Updating..."
                    : mode === "create"
                    ? "Save Route"
                    : "Update Route"}
                </Button>
              </ActionTooltip>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TOP CANVAS & LED STAGE SECTION                           */}
          {/* ========================================================= */}
          {simulations.length > 0 && currentSimulation && (
            <div className="flex flex-col flex-none w-full border-b border-border bg-muted/30 px-4 py-2 shadow-2xs">
              {/* Centered Hardware Bezel LED Screen */}
              <div ref={setLedStageEl} className="flex flex-col items-center justify-center w-full py-1">
                <div className="flex flex-col items-center w-fit max-w-full rounded-2xl bg-card p-3 shadow-sm border border-border ring-1 ring-border/50">
                  <div className="flex items-center justify-center p-2 rounded-lg bg-black overflow-hidden shadow-inner border border-border/60 ring-1 ring-black/40">
                    <div
                      style={
                        ledMatrixSize
                          ? {
                              width: (ledMatrixSize.width * zoom) / 100,
                              height: (ledMatrixSize.height * zoom) / 100,
                              transition: "width 0.15s ease-out, height 0.15s ease-out",
                            }
                          : undefined
                      }
                    >
                      <div
                        ref={setLedMatrixEl}
                        className="w-max"
                        style={{
                          transform: `scale(${zoom / 100})`,
                          transformOrigin: "top left",
                          transition: "transform 0.15s ease-out",
                        }}
                      >
                        <DisplayEditor
                          listIndex={safeSimulationIndex}
                          stopScroll={isPaused}
                          ledColor={ledColor}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage Bottom Toolbar */}
              <div className="flex items-center justify-between w-full pt-2 text-xs text-muted-foreground border-t border-border/60">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-semibold text-foreground">{currentBoardItem.label} Signboard</span>
                  <span>•</span>
                  <span className="font-mono">
                    {activeWidth}×{activeHeight} px
                  </span>
                  <span>•</span>
                  <span className="font-mono">Frame #{(selectedSimulationIndex + 1) * 310}</span>
                  <span>•</span>
                  <span className="font-medium">{formatLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Empty state banner when no slides added to current board */}
          {simulations.length === 0 && (
            <div className="flex flex-none items-center justify-center p-6 bg-card/40 border-b border-border text-xs">
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="font-semibold text-foreground text-sm">
                  No Slides Added to {currentBoardItem.label} Board
                </span>
                <span className="text-xs text-muted-foreground">
                  Click "+ Add Slide" in the loop panel below to create your first display slide.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* BOTTOM MULTI-COLUMN WORKSPACE                            */}
          {/* ========================================================= */}
          <div className="flex w-full overflow-hidden flex-1 min-h-0 border-t border-border/40">
            {/* ------------------------------------------------------- */}
            {/* RAIL 0: BOARDS SELECTOR                                 */}
            {/* ------------------------------------------------------- */}
            <div className="flex flex-col flex-none w-[72px] items-center justify-between border-r border-border bg-card py-3 select-none">
              <div className="flex flex-col items-center gap-2 w-full px-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  BOARDS
                </span>
                {BOARD_ITEMS.map((item) => {
                  const isActive = selectedTab === item.id;
                  return (
                    <ActionTooltip
                      key={item.id}
                      content={`Switch to ${item.label} Signboard (${item.letter})`}
                      side="right"
                    >
                      <button
                        type="button"
                        onClick={() => handleTabChange(item.id)}
                        className={cn(
                          "flex flex-col items-center justify-center w-full py-2.5 rounded-xl transition-all cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-border/60"
                        )}
                      >
                        <span className="text-sm font-bold leading-none">{item.letter}</span>
                        <span className="text-[9px] font-bold tracking-tight uppercase mt-1 leading-none">
                          {item.label}
                        </span>
                      </button>
                    </ActionTooltip>
                  );
                })}
              </div>

              <div className="text-[10px] font-mono text-muted-foreground font-semibold tracking-wider">
                V2.0
              </div>
            </div>

            {selectedTab !== Tab.STOPS ? (
              <>
                {/* ------------------------------------------------------- */}
                {/* COLUMN 1: ROUTE SETUP                                   */}
                {/* ------------------------------------------------------- */}
            <div className="flex flex-col flex-none w-[280px] lg:w-[310px] border-r border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex h-11 flex-none items-center justify-between border-b border-border px-4 bg-card">
                <span className="text-sm font-bold text-foreground">Route Setup</span>
                <ActionTooltip
                  content="Correct a data-entry mix-up: swaps the Source and Destination text only. Via order and trip direction are unchanged."
                  side="bottom"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-medium px-2.5"
                    onClick={handleSwapEndpoints}
                  >
                    <Repeat className="h-3.5 w-3.5 mr-1" />
                    Swap
                  </Button>
                </ActionTooltip>
              </div>

              {/* Form Fields */}
              <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-3">
                {/* Split Route Switch */}
                <div className="flex items-center justify-between pt-0.5 pb-0.5">
                  <label
                    htmlFor="split-route-switch"
                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                  >
                    Split Route (e.g. 101/102)
                  </label>
                  <Switch
                    id="split-route-switch"
                    size="sm"
                    checked={Boolean(isSplitRoute)}
                    onCheckedChange={handleToggleSplitRoute}
                  />
                </div>

                {/* Route Number */}
                {!isSplitRoute ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Route No <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="e.g. 335-E"
                      className="h-8 text-xs font-medium"
                      {...register("route_number", {
                        onChange: () => formState.errors.route_number && clearErrors("route_number"),
                      })}
                    />
                    {formState.errors.route_number && (
                      <span className="text-[11px] text-destructive">
                        {formState.errors.route_number.message as string}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        Route #1 <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="e.g. 101"
                        className="h-8 text-xs font-medium"
                        {...register("route_number_1", {
                          onChange: () =>
                            formState.errors.route_number && clearErrors("route_number"),
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        Route #2 <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="e.g. 102"
                        className="h-8 text-xs font-medium"
                        {...register("route_number_2", {
                          onChange: () =>
                            formState.errors.route_number && clearErrors("route_number"),
                        })}
                      />
                    </div>
                    {formState.errors.route_number && (
                      <span className="col-span-2 text-[11px] text-destructive">
                        {formState.errors.route_number.message as string}
                      </span>
                    )}
                  </div>
                )}

                {/* Source Stop Picker */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      Source (Origin)
                    </label>
                    <div className="flex items-center gap-2">
                      {sourceVal && (
                        <button
                          type="button"
                          onClick={() => setValue("source", "", { shouldDirty: true })}
                          className="text-[10px] font-medium text-rose-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                          title="Clear stop selection"
                        >
                          <X className="h-2.5 w-2.5" /> Clear
                        </button>
                      )}
                      {canSelectStops && depotStops.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSourceInputMode((prev) => (prev === "select" ? "manual" : "select"))
                          }
                          className="text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {sourceInputMode === "select" ? (
                            <>
                              <Pencil className="h-2.5 w-2.5" /> Custom
                            </>
                          ) : (
                            <>
                              <ListFilter className="h-2.5 w-2.5" /> Catalog
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {sourceInputMode === "select" && canSelectStops && depotStops.length > 0 ? (
                    <Select
                      value={sourceVal ? sourceVal : null}
                      onValueChange={(val) => {
                        setValue("source", val || "", { shouldDirty: true });
                      }}
                      items={sourceSelectItems}
                    >
                      <SelectTrigger className="w-full h-8 px-2.5 text-xs font-medium">
                        <SelectValue placeholder="Select origin stop..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceSelectItems.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="e.g. KEMPEGOWDA BS"
                      className="h-8 text-xs font-medium"
                      {...register("source")}
                    />
                  )}
                </div>

                {/* Destination Stop Picker */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      Destination (Terminus)
                    </label>
                    <div className="flex items-center gap-2">
                      {destVal && (
                        <button
                          type="button"
                          onClick={() => setValue("destination", "", { shouldDirty: true })}
                          className="text-[10px] font-medium text-rose-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                          title="Clear stop selection"
                        >
                          <X className="h-2.5 w-2.5" /> Clear
                        </button>
                      )}
                      {canSelectStops && depotStops.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDestInputMode((prev) => (prev === "select" ? "manual" : "select"))
                          }
                          className="text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {destInputMode === "select" ? (
                            <>
                              <Pencil className="h-2.5 w-2.5" /> Custom
                            </>
                          ) : (
                            <>
                              <ListFilter className="h-2.5 w-2.5" /> Catalog
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {destInputMode === "select" && canSelectStops && depotStops.length > 0 ? (
                    <Select
                      value={destVal ? destVal : null}
                      onValueChange={(val) => {
                        setValue("destination", val || "", { shouldDirty: true });
                      }}
                      items={destSelectItems}
                    >
                      <SelectTrigger className="w-full h-8 px-2.5 text-xs font-medium">
                        <SelectValue placeholder="Select terminus stop..." />
                      </SelectTrigger>
                      <SelectContent>
                        {destSelectItems.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="e.g. KADUGODI BS"
                      className="h-8 text-xs font-medium"
                      {...register("destination")}
                    />
                  )}
                </div>

                {/* Via (Waypoints) Section */}
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-primary" />
                      Via (Waypoints)
                      {viaStops.length > 0 && (
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                          {viaStops.length}
                        </span>
                      )}
                    </label>
                    {canSelectStops && depotStops.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setViaInputMode((prev) => (prev === "select" ? "manual" : "select"))
                        }
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {viaInputMode === "select" ? (
                          <>
                            <Pencil className="h-2.5 w-2.5" /> Custom
                          </>
                        ) : (
                          <>
                            <ListFilter className="h-2.5 w-2.5" /> Catalog
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Via Adder: Dropdown or Manual */}
                  {viaInputMode === "select" && canSelectStops && depotStops.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={selectedViaPickerId}
                        onValueChange={(val) => {
                          if (val) handleAddViaFromSelect(val);
                        }}
                        items={viaSelectItems}
                      >
                        <SelectTrigger className="w-full h-8 px-2.5 text-xs font-medium">
                          <SelectValue
                            placeholder={
                              availableViaStops.length > 0
                                ? "+ Add via from catalog..."
                                : "All catalog stops selected"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {viaSelectItems.length === 0 ? (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              No remaining catalog stops
                            </div>
                          ) : (
                            viaSelectItems.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Type via stop name..."
                        value={customViaInput}
                        onChange={(e) => setCustomViaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomVia();
                          }
                        }}
                        className="h-8 text-xs font-medium flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2.5 text-xs font-medium shrink-0"
                        onClick={handleAddCustomVia}
                        disabled={!customViaInput.trim()}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  )}

                  {/* Reorderable Via List */}
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {viaStops.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/70 py-2 text-center text-[11px] text-muted-foreground">
                        Direct route (no intermediate via stops)
                      </div>
                    ) : (
                      viaStops.map((via, idx) => {
                        const isDragged = draggedViaIdx === idx;
                        const isDragOver = dragOverViaIdx === idx;
                        return (
                          <div
                            key={via.id || idx}
                            draggable
                            onDragStart={() => handleViaDragStart(idx)}
                            onDragOver={(e) => handleViaDragOver(e, idx)}
                            onDrop={() => handleViaDrop(idx)}
                            className={cn(
                              "flex items-center justify-between gap-1.5 p-1.5 px-2 rounded-md border text-xs transition-colors",
                              isDragOver
                                ? "border-primary bg-primary/10"
                                : isDragged
                                ? "opacity-40 border-dashed border-muted-foreground bg-muted"
                                : "border-border bg-muted/40 hover:bg-muted/80"
                            )}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0" />
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-foreground truncate text-xs">
                                  {via.name}
                                </span>
                                {via.name_kn && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {via.name_kn}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveViaUp(idx)}
                                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                title="Move waypoint up"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === viaStops.length - 1}
                                onClick={() => handleMoveViaDown(idx)}
                                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                title="Move waypoint down"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveVia(idx)}
                                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Remove waypoint"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Route Separator */}
                <div className="space-y-1 pt-1 border-t border-border/60">
                  <label className="text-xs font-semibold text-foreground">Route Separator</label>
                  <Select
                    value={separation || "-"}
                    onValueChange={(val) => {
                      if (val) setValue("separation", val, { shouldDirty: true });
                    }}
                    items={separatorItems}
                  >
                    <SelectTrigger className="w-full h-8 px-2.5 text-xs font-medium">
                      <SelectValue placeholder="Select separator..." />
                    </SelectTrigger>
                    <SelectContent>
                      {separatorItems.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Live Route Journey Sequence Overview */}
                <div className="pt-2 border-t border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-primary" /> Journey Flow
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {1 + viaStops.length + 1} Waypoints
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-1">
                    {/* Origin Stop */}
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-500/20" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {sourceVal || <span className="text-muted-foreground italic">Origin</span>}
                      </span>
                      <span className="ml-auto text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        Source
                      </span>
                    </div>

                    {/* Vias Rail */}
                    {viaStops.length > 0 ? (
                      <div className="ml-1 pl-2.5 border-l-2 border-border/80 space-y-1.5 my-1">
                        {viaStops.map((via, i) => (
                          <div key={via.id || i} className="flex items-center gap-2 py-0.5">
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-xs text-foreground/90 truncate flex-1">
                              {via.name}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                              Via #{i + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-1 pl-2.5 border-l-2 border-dashed border-border/60 py-1 my-0.5">
                        <span className="text-[10px] italic text-muted-foreground/70">
                          Non-stop direct trip
                        </span>
                      </div>
                    )}

                    {/* Terminus Stop */}
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-500/20" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {destVal || <span className="text-muted-foreground italic">Terminus</span>}
                      </span>
                      <span className="ml-auto text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                        Dest
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------- */}
            {/* COLUMN 2: CONTENT & SETTINGS                            */}
            {/* ------------------------------------------------------- */}
            <div className="flex flex-col flex-none w-[380px] lg:w-[430px] border-r border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex h-11 flex-none items-center justify-between border-b border-border px-4 bg-card">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-foreground">Content & Settings</span>
                  <span className="text-xs font-mono font-semibold text-muted-foreground">
                    Slide #{selectedSimulationIndex + 1}/{simulations.length || 1}
                  </span>
                </div>
              </div>

              {/* Content Body */}
              {!currentSimulation ? (
                <div className="flex flex-col items-center justify-center flex-1 p-6 text-center text-muted-foreground">
                  <Layers className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <span className="text-xs font-semibold text-foreground">No Slide Selected</span>
                  <span className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                    Add a slide to this signboard loop from the right panel to configure content and
                    appearance.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Zone Sub-Tabs */}
                  {currentSimulation && currentFormat !== "single" && (
                    <div className="flex flex-none items-center gap-4 border-b border-border/80 w-full px-4 pt-3 bg-card">
                      {isSplitRoute ? (
                        <>
                          <ActionTooltip content="Switch to Route #1 zone editor" side="top">
                            <button
                              type="button"
                              onClick={() => setUserTextZone("routeNumber1")}
                              className={cn(
                                "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                                activeTextZone === "routeNumber1"
                                  ? "border-b-2 border-primary text-primary font-bold"
                                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Route #1
                            </button>
                          </ActionTooltip>
                          <ActionTooltip content="Switch to Route #2 zone editor" side="top">
                            <button
                              type="button"
                              onClick={() => setUserTextZone("routeNumber2")}
                              className={cn(
                                "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                                activeTextZone === "routeNumber2"
                                  ? "border-b-2 border-primary text-primary font-bold"
                                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Route #2
                            </button>
                          </ActionTooltip>
                        </>
                      ) : (
                        <ActionTooltip content="Switch to Route Number zone editor" side="top">
                          <button
                            type="button"
                            onClick={() => setUserTextZone("routeNumber")}
                            className={cn(
                              "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                              activeTextZone === "routeNumber"
                                ? "border-b-2 border-primary text-primary font-bold"
                                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Route No
                          </button>
                        </ActionTooltip>
                      )}

                      {currentFormat === "two" && (
                        <ActionTooltip content="Switch to Destination Text zone editor" side="top">
                          <button
                            type="button"
                            onClick={() => setUserTextZone("text")}
                            className={cn(
                              "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                              activeTextZone === "text"
                                ? "border-b-2 border-primary text-primary font-bold"
                                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Text
                          </button>
                        </ActionTooltip>
                      )}

                      {currentFormat === "three" && (
                        <>
                          <ActionTooltip content="Switch to Upper Line zone editor" side="top">
                            <button
                              type="button"
                              onClick={() => setUserTextZone("upperHalfText")}
                              className={cn(
                                "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                                activeTextZone === "upperHalfText"
                                  ? "border-b-2 border-primary text-primary font-bold"
                                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Upper Line
                            </button>
                          </ActionTooltip>
                          <ActionTooltip content="Switch to Lower Line zone editor" side="top">
                            <button
                              type="button"
                              onClick={() => setUserTextZone("lowerHalfText")}
                              className={cn(
                                "pb-1.5 text-xs font-semibold transition-all cursor-pointer truncate -mb-px",
                                activeTextZone === "lowerHalfText"
                                  ? "border-b-2 border-primary text-primary font-bold"
                                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Lower Line
                            </button>
                          </ActionTooltip>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    {/* SECTION 1: TEXT CONTENT */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Text Content</span>
                        <span className="font-mono text-muted-foreground font-medium">
                          {currentText.length} chars
                        </span>
                      </div>

                      <Controller
                        name={`${pathBase}.text` as any}
                        control={control}
                        render={({ field }) => (
                          <IMEInput
                            langCode={currentLanguage}
                            className="w-full text-xs font-medium h-8"
                            {...field}
                          />
                        )}
                      />

                      {/* Quick tools row (Language | Auto Text | Add Icon) */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={currentLanguage}
                            onValueChange={(val) => {
                              if (!val) return;
                              const nextHeight = Math.min(
                                getDefaultFontHeightForLanguage(val, activeTextZoneKey),
                                maxAllowedFontHeight
                              );
                              setValue(`${pathBase}.fontHeight` as any, nextHeight, { shouldDirty: true });
                              setValue(`${pathBase}.language` as any, val, { shouldDirty: true });
                            }}
                            items={languageItems}
                          >
                            <SelectTrigger className="w-full h-8 px-2.5 text-xs font-medium">
                              <SelectValue placeholder="Select language..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {languageItems.map((l) => (
                                <SelectItem key={l.value} value={l.value} className="text-xs">
                                  {l.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Popover open={showAutoText} onOpenChange={setShowAutoText}>
                          <ActionTooltip
                            content="Auto-generate destination variations & translations"
                            side="top"
                          >
                            <PopoverTrigger
                              type="button"
                              className={cn(
                                "h-8 text-xs font-medium px-2.5 inline-flex items-center justify-center rounded-md border border-input transition-colors cursor-pointer",
                                showAutoText
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-foreground hover:bg-accent"
                              )}
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-500 mr-1" />
                              Auto Text
                            </PopoverTrigger>
                          </ActionTooltip>
                          <PopoverContent
                            side="bottom"
                            align="start"
                            sideOffset={6}
                            className="w-80 max-h-[420px] rounded-xl bg-card border border-border shadow-2xl p-2 flex flex-col font-sans"
                          >
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border px-1">
                              <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                Auto-Text Suggestions
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowAutoText(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <AutoTextGenerator
                              variant="list"
                              route={getValues()}
                              text={currentText}
                              targetLang={currentLanguage}
                              onSelect={(value) => {
                                setValue(`${pathBase}.text` as any, value, { shouldDirty: true });
                                setShowAutoText(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>

                        {iconsAllowed && (
                          <ActionTooltip content="Select and insert transit symbol icon" side="top">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-medium px-2.5"
                              onClick={() => setIsIconPickerOpen(true)}
                            >
                              <span className="mr-1 text-sm">☺</span> Add Icon
                            </Button>
                          </ActionTooltip>
                        )}
                      </div>

                      {/* Selected Icon Settings Panel */}
                      {currentIcon && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted border border-border mt-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-lg text-foreground flex-none">
                              {currentIcon}
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground truncate max-w-[90px]">
                              {currentIcon}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {iconsAllowed && (
                              <ActionTooltip content="Choose different icon symbol" side="top">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2.5 font-medium"
                                  onClick={() => setIsIconPickerOpen(true)}
                                >
                                  Change
                                </Button>
                              </ActionTooltip>
                            )}
                            <ActionTooltip content="Remove icon from slide" side="top">
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7 flex-none"
                                onClick={() => setValue(`${pathBase}.icon` as any, "", { shouldDirty: true })}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </ActionTooltip>
                          </div>
                        </div>
                      )}
                    </div>

                    {currentIcon && iconsAllowed && (
                      <div className="space-y-2">
                        <SettingRow label="Icon Position">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={[currentIconPos || "start"]}
                            onValueChange={(val) => {
                              if (val.length > 0) {
                                const pos = val[0] as "start" | "center" | "end";
                                setZoneField("iconPosition", pos);
                                setZoneField(
                                  "iconWordIndex",
                                  pos === "center" ? Math.max(1, Math.floor(wordsCount / 2)) : undefined
                                );
                              }
                            }}
                          >
                            <ActionTooltip content="Place icon before text" side="top">
                              <ToggleGroupItem value="start" aria-label="Place icon before text" className="flex-1 text-xs">
                                Start
                              </ToggleGroupItem>
                            </ActionTooltip>
                            <ActionTooltip content="Place icon between words" side="top">
                              <ToggleGroupItem value="center" aria-label="Place icon between words" className="flex-1 text-xs">
                                Middle
                              </ToggleGroupItem>
                            </ActionTooltip>
                            <ActionTooltip content="Place icon after text" side="top">
                              <ToggleGroupItem value="end" aria-label="Place icon after text" className="flex-1 text-xs">
                                End
                              </ToggleGroupItem>
                            </ActionTooltip>
                          </ToggleGroup>
                        </SettingRow>
                        {currentIconPos === "center" && (
                          <SettingRow label="After Word">
                            <ToggleGroup
                              size="sm"
                              variant="outline"
                              spacing={1}
                              className="w-full flex flex-wrap"
                              value={currentWordIndex !== undefined ? [String(currentWordIndex)] : []}
                              onValueChange={(val) => {
                                if (val.length > 0) setZoneField("iconWordIndex", Number(val[0]));
                              }}
                            >
                              {Array.from({ length: maxWordIndex }, (_, i) => {
                                const idx = i + 1;
                                const word = wordsList[i];
                                const item = (
                                  <ToggleGroupItem
                                    key={idx}
                                    value={String(idx)}
                                    aria-label={`After word ${idx}`}
                                    className="flex-1 min-w-[28px] text-xs h-7 px-1.5"
                                  >
                                    {idx}
                                  </ToggleGroupItem>
                                );
                                return word ? (
                                  <ActionTooltip key={idx} content={`After "${word}"`} side="top">
                                    {item}
                                  </ActionTooltip>
                                ) : (
                                  item
                                );
                              })}
                            </ToggleGroup>
                          </SettingRow>
                        )}
                        <SettingRow label="Icon Spacing">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={currentIconSpacing !== undefined ? [String(currentIconSpacing)] : ["2"]}
                            onValueChange={(val) => {
                              if (val.length > 0) setZoneField("iconSpacing", Number(val[0]));
                            }}
                          >
                            {[0, 1, 2, 3, 4, 6].map((v) => (
                              <ToggleGroupItem
                                key={v}
                                value={String(v)}
                                aria-label={`Icon spacing ${v}`}
                                className="flex-1 text-xs"
                              >
                                {v}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </SettingRow>
                        <SettingRow label="Icon Width">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={currentIconScale !== undefined ? [String(currentIconScale)] : ["1"]}
                            onValueChange={(val) => {
                              if (val.length > 0) setZoneField("iconWidthScale", Number(val[0]));
                            }}
                          >
                            {[0.75, 1, 1.25, 1.5, 2].map((v) => (
                              <ToggleGroupItem
                                key={v}
                                value={String(v)}
                                aria-label={`Icon width scale ${v}x`}
                                className="flex-1 text-xs px-1"
                              >
                                {v}×
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </SettingRow>
                      </div>
                    )}

                    {/* Material Symbol Picker Modal */}
                    <MaterialSymbolPicker
                      open={isIconPickerOpen}
                      onOpenChange={setIsIconPickerOpen}
                      selectedIcon={watch(`${pathBase}.icon` as any) || ""}
                      onSelectIcon={(iconName) =>
                        setValue(`${pathBase}.icon` as any, iconName, { shouldDirty: true })
                      }
                    />

                    {/* SIGNBOARD & TYPOGRAPHY SETTINGS */}
                    <div className="space-y-2.5 border-t border-border/60 pt-2.5">
                      <SettingRow label="Text Height">
                        {(() => {
                          const sizes = Array.from(new Set([...FONT_HEIGHT_GRID, currentFontHeight]))
                            .filter((size) => size <= maxAllowedFontHeight || size === currentFontHeight)
                            .sort((a, b) => a - b);
                          return (
                            <ToggleGroup
                              size="sm"
                              variant="outline"
                              spacing={1}
                              className="w-full flex flex-wrap"
                              value={[String(currentFontHeight)]}
                              onValueChange={(val) => {
                                if (val.length > 0) setZoneField("fontHeight", Number(val[0]));
                              }}
                            >
                              {sizes.map((size) => (
                                <ToggleGroupItem
                                  key={size}
                                  value={String(size)}
                                  aria-label={`Font height ${size}`}
                                  className="flex-1 min-w-[28px] text-xs h-7 px-1.5"
                                >
                                  {size}
                                </ToggleGroupItem>
                              ))}
                            </ToggleGroup>
                          );
                        })()}
                      </SettingRow>

                      <SettingRow label="Text Weight">
                        <ToggleGroup
                          size="sm"
                          variant="outline"
                          spacing={2}
                          className="w-full flex"
                          value={[currentWeight || "Regular"]}
                          onValueChange={(val) => {
                            if (val.length > 0) setZoneField("fontWeight", val[0] as FontWeight);
                          }}
                        >
                          {FONT_WEIGHTS.map((w) => (
                            <ToggleGroupItem
                              key={w}
                              value={w}
                              aria-label={`Font weight ${w}`}
                              className="flex-1 text-xs"
                            >
                              {w}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </SettingRow>

                      <SettingRow label="Text Alignment">
                        <ToggleGroup
                          size="sm"
                          variant="outline"
                          spacing={2}
                          className="w-full flex"
                          value={[currentPosition || "Center"]}
                          onValueChange={(val) => {
                            if (val.length > 0) setZoneField("position", val[0] as Position);
                          }}
                        >
                          <ActionTooltip content="Align left" side="top">
                            <ToggleGroupItem value="Left" aria-label="Align left" className="flex-1">
                              <AlignLeft className="h-3.5 w-3.5" />
                            </ToggleGroupItem>
                          </ActionTooltip>
                          <ActionTooltip content="Align center" side="top">
                            <ToggleGroupItem value="Center" aria-label="Align center" className="flex-1">
                              <AlignCenter className="h-3.5 w-3.5" />
                            </ToggleGroupItem>
                          </ActionTooltip>
                          <ActionTooltip content="Align right" side="top">
                            <ToggleGroupItem value="Right" aria-label="Align right" className="flex-1">
                              <AlignRight className="h-3.5 w-3.5" />
                            </ToggleGroupItem>
                          </ActionTooltip>
                        </ToggleGroup>
                      </SettingRow>

                      <SettingRow label="Scroll Direction">
                        <ToggleGroup
                          size="sm"
                          variant="outline"
                          spacing={2}
                          className="w-full flex"
                          value={[currentScrollType || "Right To Left"]}
                          onValueChange={(val) => {
                            if (val.length > 0) setZoneField("scrollType", val[0] as ScrollType);
                          }}
                        >
                          <ActionTooltip content="Scroll right to left" side="top">
                            <ToggleGroupItem
                              value="Right To Left"
                              aria-label="Scroll right to left"
                              className="flex-1"
                            >
                              <span className="text-sm leading-none">«</span>
                            </ToggleGroupItem>
                          </ActionTooltip>
                          <ActionTooltip content="Fixed (no scrolling)" side="top">
                            <ToggleGroupItem
                              value="Fixed"
                              aria-label="Fixed (no scrolling)"
                              className="flex-1"
                            >
                              <span className="text-sm leading-none tracking-tighter">⠿</span>
                            </ToggleGroupItem>
                          </ActionTooltip>
                          <ActionTooltip content="Scroll left to right" side="top">
                            <ToggleGroupItem
                              value="Left To Right"
                              aria-label="Scroll left to right"
                              className="flex-1"
                            >
                              <span className="text-sm leading-none">»</span>
                            </ToggleGroupItem>
                          </ActionTooltip>
                        </ToggleGroup>
                      </SettingRow>

                      <SettingRow label="Scroll Speed">
                        <ToggleGroup
                          size="sm"
                          variant="outline"
                          spacing={2}
                          className="w-full flex"
                          value={[String(toSpeedPreset(currentSpeed))]}
                          onValueChange={(val) => {
                            if (val.length > 0) setZoneField("scrollSpeed", Number(val[0]));
                          }}
                          disabled={currentScrollType === "Fixed"}
                        >
                          {SCROLL_SPEED_TOGGLES.map((s) => (
                            <ToggleGroupItem
                              key={s.value}
                              value={String(s.value)}
                              aria-label={`Scroll speed ${s.label}`}
                              disabled={currentScrollType === "Fixed"}
                              className="flex-1 text-xs"
                            >
                              {s.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </SettingRow>

                      {selectedTab !== Tab.INTERNAL && (
                        <SettingRow label="Change Slide Format">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={[currentFormat]}
                            onValueChange={(val) => {
                              if (val.length > 0) handleFormatChange(val[0] as SimulationFormat);
                            }}
                          >
                            <ActionTooltip content="Single line text" side="top">
                              <ToggleGroupItem value="single" aria-label="Single line" className="flex-1 text-xs">
                                Single
                              </ToggleGroupItem>
                            </ActionTooltip>
                            <ActionTooltip content="Route number + text" side="top">
                              <ToggleGroupItem value="two" aria-label="Two line" className="flex-1 text-xs">
                                Two Line
                              </ToggleGroupItem>
                            </ActionTooltip>
                            <ActionTooltip content="Route number + upper & lower lines" side="top">
                              <ToggleGroupItem value="three" aria-label="Three line" className="flex-1 text-xs">
                                Three Line
                              </ToggleGroupItem>
                            </ActionTooltip>
                          </ToggleGroup>
                        </SettingRow>
                      )}
                    </div>

                    {/* ADVANCED RENDERING */}
                    <details className="pt-2 border-t border-border/60">
                      <summary className="text-xs font-semibold text-foreground cursor-pointer select-none">
                        Advanced Rendering
                      </summary>
                      <div className="space-y-2.5 pt-2.5">
                        <SettingRow label="Vertical Align">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={[(watchZoneField("vAlign") as string) || "Center"]}
                            onValueChange={(val) => {
                              if (val.length > 0)
                                setZoneField("vAlign", val[0] as "Center" | "Top" | "Bottom");
                            }}
                          >
                            {["Top", "Center", "Bottom"].map((v) => (
                              <ToggleGroupItem
                                key={v}
                                value={v}
                                aria-label={`Vertical align ${v}`}
                                className="flex-1 text-xs"
                              >
                                {v}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </SettingRow>

                        <SettingRow label="Auto Fit">
                          <ToggleGroup
                            size="sm"
                            variant="outline"
                            spacing={2}
                            className="w-full flex"
                            value={[watchZoneField("autoFit") ? "on" : "off"]}
                            onValueChange={(val) => {
                              if (val.length > 0) setZoneField("autoFit", val[0] === "on");
                            }}
                          >
                            <ToggleGroupItem value="off" aria-label="Auto fit off" className="flex-1 text-xs">
                              Off
                            </ToggleGroupItem>
                            <ActionTooltip content="Shrink text to fit the zone width" side="top">
                              <ToggleGroupItem value="on" aria-label="Auto fit on" className="flex-1 text-xs">
                                On
                              </ToggleGroupItem>
                            </ActionTooltip>
                          </ToggleGroup>
                        </SettingRow>

                        <SettingRow label="Threshold">
                          <NumberField
                            min={0}
                            max={255}
                            placeholder="Auto (0–255)"
                            value={watchZoneField("threshold")}
                            onChange={(v) => setZoneField("threshold", v)}
                          />
                        </SettingRow>

                        <SettingRow label="Space Width">
                          <NumberField
                            min={0}
                            max={16}
                            placeholder="Auto (px)"
                            value={watchZoneField("spaceWidth")}
                            onChange={(v) => setZoneField("spaceWidth", v)}
                          />
                        </SettingRow>
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ------------------------------------------------------- */
          /* STOP ANNOUNCEMENT SIMULATOR PANEL (Tab.STOPS)           */
          /* ------------------------------------------------------- */
          <div className="flex flex-col flex-none w-[420px] lg:w-[420px] xl:w-[420px] border-r border-border bg-card overflow-hidden">
            {/* Simulator Header */}
            <div className="flex h-11 flex-none items-center justify-between border-b border-border px-4 bg-card">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  Stop Announcement Simulator
                </span>
              </div>
              {playbackPhase === "playing_stage" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 animate-pulse">
                  <Radio className="h-3 w-3 animate-pulse" /> Playing Stage
                </span>
              ) : playbackPhase === "playing_stop" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                  <Volume2 className="h-3 w-3 animate-pulse" /> Playing Stop
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                  Idle
                </span>
              )}
            </div>

            {/* Simulator Body (Compact, no-scroll arrangement) */}
            <div className="flex-1 p-3.5 space-y-3 overflow-y-auto">
              {/* Row 0: Desired Route Announcement Languages */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Route Languages ({desiredLanguages.length})
                  </label>
                  <Select
                    value={null}
                    onValueChange={(val) => {
                      if (val) addDesiredLanguage(val);
                    }}
                    items={availableLanguageSelectItems}
                    disabled={availableLanguageSelectItems.length === 0}
                  >
                    <SelectTrigger size="sm" className="w-36 text-xs">
                      <SelectValue
                        placeholder={
                          availableLanguageSelectItems.length === 0
                            ? "All Added"
                            : "+ Add Language"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent align="end" className="max-h-56">
                      {availableLanguageSelectItems.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} className="text-xs">
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Language Chips */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {desiredLanguages.map((code) => {
                    const langObj = AVAILABLE_LANGUAGES.find((l) => l.code === code);
                    const label = langObj?.label || code.toUpperCase();
                    return (
                      <Badge key={code} variant="secondary">
                        <span>{label}</span>
                        {desiredLanguages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDesiredLanguage(code)}
                            className="cursor-pointer opacity-70 hover:opacity-100 inline-flex items-center ml-0.5"
                            title={`Remove ${label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Row 1: Route Stop & Filtered Announcement Language */}
              <div className="grid grid-cols-12 gap-2.5 items-end">
                {/* 1. Stop Selector */}
                <div className="col-span-7 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Route Stop
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {effectiveSimStops.length} stops
                    </span>
                  </div>

                  {effectiveSimStops.length === 0 ? (
                    <div className="p-2 rounded-md border border-dashed border-border bg-muted/20 text-[11px] text-muted-foreground text-center">
                      No route stops found
                    </div>
                  ) : (
                    <Select
                      value={simStopId}
                      onValueChange={(val) => {
                        if (val) setSimStopId(val);
                      }}
                      items={simStopSelectItems}
                    >
                      <SelectTrigger className="w-full h-8 px-2.5 text-xs bg-background">
                        <SelectValue placeholder="Select a stop..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {effectiveSimStops.map((stop) => {
                          const hasAudio = !!stop.stopAudioUrl;
                          return (
                            <SelectItem key={stop.id} value={stop.id} className="text-xs py-1.5">
                              <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-medium text-foreground truncate">{stop.label}</span>
                                  {stop.name_kn && (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      ({stop.name_kn})
                                    </span>
                                  )}
                                </div>
                                <div className="shrink-0 ml-auto">
                                  {hasAudio ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">
                                      <Volume2 className="h-2.5 w-2.5" /> Audio
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground bg-muted border border-border px-1 py-0.5 rounded">
                                      <VolumeX className="h-2.5 w-2.5" /> None
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* 2. Language Selector (Filtered) */}
                <div className="col-span-5 space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Language
                  </label>
                  <Select
                    value={simLanguage}
                    onValueChange={(val) => {
                      if (val) setSimLanguage(val);
                    }}
                    items={filteredSimLanguageItems}
                  >
                    <SelectTrigger className="w-full h-8 px-2.5 text-xs bg-background">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {filteredSimLanguageItems.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Announcement Stage Tabs */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Announcement Stage
                </label>
                <Tabs
                  value={simStage}
                  onValueChange={(val) => {
                    if (val) setSimStage(val as "current" | "next" | "arriving");
                  }}
                  className="w-full"
                >
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="current" className="text-xs">
                      Current Stop
                    </TabsTrigger>
                    <TabsTrigger value="next" className="text-xs">
                      Next Stop
                    </TabsTrigger>
                    <TabsTrigger value="arriving" className="text-xs">
                      Arriving Stop
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Row 3: Live Output Preview & Audio Controls */}
              <div className="flex flex-col rounded-xl border border-border bg-card p-3 space-y-2.5">
                {/* Audio Readiness Badges Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Live Announcement
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                        stageAudioUrl
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      )}
                    >
                      {stageAudioUrl ? (
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      )}
                      Stage {stageAudioUrl ? "Audio Ready" : "Missing"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                        stopAudioUrl
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      )}
                    >
                      {stopAudioUrl ? (
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      )}
                      Stop {stopAudioUrl ? "Audio Ready" : "Missing"}
                    </span>
                  </div>
                </div>

                {/* Announcement Display Preview Box */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 font-mono text-xs font-semibold text-foreground border border-border min-h-[34px]">
                  <Volume2
                    className={cn(
                      "h-4 w-4 shrink-0",
                      playbackPhase !== "idle" ? "text-primary animate-pulse" : "text-muted-foreground"
                    )}
                  />
                  <span className="truncate flex-1 select-all">
                    {selectedSimStop
                      ? simAnnouncementText || computeAnnouncementText(selectedSimStop, simStage, simLanguage)
                      : "—"}
                  </span>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="flex-1 h-8 text-xs font-semibold cursor-pointer"
                    onClick={() => playChainedAudio(stageAudioUrl, stopAudioUrl)}
                    disabled={!stageAudioUrl && !stopAudioUrl}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Replay Announcement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium px-4 cursor-pointer text-foreground"
                    onClick={stopChainedAudio}
                    disabled={playbackPhase === "idle"}
                  >
                    <Square className="h-3 w-3 mr-1.5" /> Stop
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

            {/* ------------------------------------------------------- */}
            {/* COLUMN 3: SLIDES LOOP                                   */}
            {/* ------------------------------------------------------- */}
            <div className="flex flex-col flex-1 min-w-[340px] bg-background overflow-hidden">
              {/* Header */}
              <div className="flex min-h-11 flex-none flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-4 py-1.5 bg-card">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-foreground">
                    {selectedTab === Tab.STOPS ? "Stop Announcement Simulation" : "Slides Loop"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-foreground border border-border font-mono text-[11px] font-bold">
                    {simulations.length}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedTab === Tab.STOPS ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                      <Radio className="h-3 w-3 animate-pulse" /> Live Simulator
                    </div>
                  ) : (
                    <ActionTooltip
                      content={
                        isCycling
                          ? "Stop the automatic slide preview"
                          : "Preview the loop: the LED board steps through each slide automatically (3.5s per slide)"
                      }
                      side="bottom"
                    >
                      <Button
                        variant={isCycling ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs font-medium px-2.5"
                        disabled={!isCycling && simulations.length <= 1}
                        onClick={() => setIsCycling(!isCycling)}
                      >
                        {isCycling ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                        {isCycling ? "Stop Playing" : "Play Slides"}
                      </Button>
                    </ActionTooltip>
                  )}

                  {/* Add Slide Dropdown */}
                  {selectedTab !== Tab.STOPS && (
                    <DropdownMenu>
                      <ActionTooltip content="Add a new slide to this signboard loop" side="bottom">
                        <DropdownMenuTrigger
                          type="button"
                          className="h-7 text-xs font-semibold px-2.5 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Slide
                        </DropdownMenuTrigger>
                      </ActionTooltip>
                      <DropdownMenuContent align="end" className="min-w-[200px]">
                        {selectedTab !== Tab.INTERNAL && (
                          <>
                            <DropdownMenuItem onClick={() => handleAddSlide("single")}>
                              <Layers className="h-3.5 w-3.5 text-primary mr-2" />
                              <span>Add Single-Line Route</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddSlide("two")}>
                              <Columns className="h-3.5 w-3.5 text-primary mr-2" />
                              <span>Add Two-Line Route</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddSlide("three")}>
                              <Layers className="h-3.5 w-3.5 text-primary mr-2" />
                              <span>Add Three-Line Route</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => handleAddSlide("single", "slogan")}>
                          <MessageSquare className="h-3.5 w-3.5 text-amber-500 mr-2" />
                          <span>Add Slogan / Announcement</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddSlide("single", "special message")}>
                          <Mic className="h-3.5 w-3.5 text-amber-500 mr-2" />
                          <span>Add Special Message</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Copy Slide Dropdown */}
                  {selectedTab !== Tab.INTERNAL && selectedTab !== Tab.STOPS && simulations.length > 0 && currentSimulation && (
                    <DropdownMenu>
                      <ActionTooltip content="Copy the selected slide to another signboard" side="bottom">
                        <DropdownMenuTrigger
                          type="button"
                          className="h-7 text-xs font-medium px-2.5 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy Slide
                        </DropdownMenuTrigger>
                      </ActionTooltip>
                      <DropdownMenuContent align="end" className="min-w-[170px]">
                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          Copy Slide #{safeSimulationIndex + 1} To:
                        </DropdownMenuLabel>
                        {BOARD_ITEMS.filter(
                          (b) => b.id !== selectedTab && b.id !== Tab.STOPS && b.id !== Tab.INTERNAL
                        ).map((b) => (
                          <DropdownMenuItem key={b.id} onClick={() => handleCopySlideToBoard(b.id)}>
                            <span className="w-4 text-center font-bold text-[11px] text-foreground mr-1.5">
                              {b.letter}
                            </span>
                            <span>{b.label} Signboard</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Copy All Dropdown */}
                  {selectedTab !== Tab.INTERNAL && selectedTab !== Tab.STOPS && simulations.length > 0 && (
                    <DropdownMenu>
                      <ActionTooltip content="Copy all slides to another signboard display" side="bottom">
                        <DropdownMenuTrigger
                          type="button"
                          className="h-7 text-xs font-medium px-2.5 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy All
                        </DropdownMenuTrigger>
                      </ActionTooltip>
                      <DropdownMenuContent align="end" className="min-w-[170px]">
                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          Copy All Slides To:
                        </DropdownMenuLabel>
                        {BOARD_ITEMS.filter(
                          (b) => b.id !== selectedTab && b.id !== Tab.STOPS && b.id !== Tab.INTERNAL
                        ).map((b) => (
                          <DropdownMenuItem key={b.id} onClick={() => handleCopyAllToBoard(b.id)}>
                            <span className="w-4 text-center font-bold text-[11px] text-foreground mr-1.5">
                              {b.letter}
                            </span>
                            <span>{b.label} Display</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {selectedTab !== Tab.STOPS && (
                    <ActionTooltip content="Delete all slides from current signboard loop" side="bottom">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs font-medium px-2.5"
                        onClick={handleClearAllSlides}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Clear All
                      </Button>
                    </ActionTooltip>
                  )}
                </div>
              </div>

              {/* Board Size row */}
              <div className="flex flex-none flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-card/60 px-4 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {currentBoardItem.label} Board Size
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Height</span>
                  <div className="w-28">
                    <ToggleGroup
                      size="sm"
                      variant="outline"
                      spacing={2}
                      className="w-full flex"
                      value={[String(activeHeight)]}
                      onValueChange={(val) => {
                        if (val.length > 0)
                          handleHeightChange(Number(val[0]) as (typeof HEIGHT_OPTIONS)[number]);
                      }}
                      disabled={simulations.length === 0}
                    >
                      {HEIGHT_OPTIONS.map((h) => (
                        <ActionTooltip key={h} content="Applies to all slides on this board" side="top">
                          <ToggleGroupItem
                            value={String(h)}
                            aria-label={`Height ${h}`}
                            disabled={simulations.length === 0}
                            className="flex-1 text-xs"
                          >
                            {h}
                          </ToggleGroupItem>
                        </ActionTooltip>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Width</span>
                  <div className="w-72">
                    <ToggleGroup
                      size="sm"
                      variant="outline"
                      spacing={1}
                      className="w-full flex"
                      value={[String(activeWidth)]}
                      onValueChange={(val) => {
                        if (val.length > 0)
                          handleWidthChange(Number(val[0]) as (typeof WIDTH_OPTIONS)[number]);
                      }}
                      disabled={simulations.length === 0}
                    >
                      {WIDTH_OPTIONS.map((w) => (
                        <ActionTooltip key={w} content="Applies to all slides on this board" side="top">
                          <ToggleGroupItem
                            value={String(w)}
                            aria-label={`Width ${w}`}
                            disabled={simulations.length === 0}
                            className="flex-1 text-xs px-1"
                          >
                            {w}
                          </ToggleGroupItem>
                        </ActionTooltip>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
              </div>

              {/* Slides Loop Card Stack */}
              <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-3">
                {simulations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card my-8">
                    <span className="text-sm font-semibold text-foreground mb-1">
                      No Slides in Loop Sequence
                    </span>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      Add your first destination slide to start the signboard playback loop.
                    </p>
                  </div>
                ) : (
                  simulations.map((sim, index) => {
                    const isSelected = index === selectedSimulationIndex;
                    const format = sim.format || "two";
                    const simType = sim.type || "route";
                    const w = sim.width || activeWidth;
                    const h = sim.height || activeHeight;
                    const texts = (sim.texts || {}) as any;

                    const routeNumText = isSplitRoute
                      ? `${texts?.routeNumber1?.text || ""}/${texts?.routeNumber2?.text || ""}`
                      : texts?.sideText?.text ||
                        texts?.routeNumber?.text ||
                        routeNumber ||
                        "";
                    const destText = texts?.text?.text || "";
                    const singleText = texts?.text?.text || "";

                    return (
                      <div
                        key={`${selectedTab}_slide_${index}`}
                        onClick={() => setSelectedSimulationIndex(index)}
                        className={cn(
                          "flex flex-col rounded-xl border p-3 cursor-pointer transition-all shadow-xs",
                          isSelected
                            ? "bg-card border-primary ring-2 ring-primary shadow-md"
                            : "bg-card border-border hover:border-muted-foreground hover:shadow-sm"
                        )}
                      >
                        {/* Slide Card Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded font-mono font-bold text-xs",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              #{index + 1}
                            </span>
                            <span className="text-xs font-bold text-foreground capitalize">
                              {format === "two"
                                ? "Two Line"
                                : format === "three"
                                ? "Three Line"
                                : "Single Line"}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize font-medium">
                              • {simType}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground font-medium">
                              • {w}×{h}
                            </span>
                            {sim.audioFileUrl && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                                <Volume2 className="h-2.5 w-2.5" /> PAS Audio
                              </span>
                            )}
                          </div>

                          {/* Reorder & Action Buttons */}
                          {selectedTab === Tab.STOPS ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Live Simulator Slide
                            </span>
                          ) : (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ActionTooltip content="Move slide up in playback sequence" side="top">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 text-foreground"
                                  disabled={index === 0}
                                  onClick={() => handleMoveSlide(index, "up")}
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </Button>
                              </ActionTooltip>
                              <ActionTooltip content="Move slide down in playback sequence" side="top">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 text-foreground"
                                  disabled={index === simulations.length - 1}
                                  onClick={() => handleMoveSlide(index, "down")}
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                              </ActionTooltip>
                              <ActionTooltip content="Duplicate this slide" side="top">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 text-foreground"
                                  onClick={() => handleDuplicateSlide(index)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </ActionTooltip>
                              <ActionTooltip content="Delete this slide from loop" side="top">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRemoveSlide(index)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </ActionTooltip>
                            </div>
                          )}
                        </div>

                        {/* Slide Card Body Zones */}
                        {format === "two" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col p-2.5 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                ROUTE NUMBER ZONE
                              </span>
                              <span className="text-xs font-mono font-bold text-foreground truncate">
                                {routeNumText || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                                Font: {texts.sideText?.fontHeight || 14}px •{" "}
                                {texts.sideText?.position || "Center"} •{" "}
                                {texts.sideText?.scrollType || "Fixed"}
                              </span>
                            </div>

                            <div className="flex flex-col p-2.5 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                DESTINATION TEXT ZONE
                              </span>
                              <span className="text-xs font-semibold text-foreground truncate">
                                {destText || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                                Font: {texts.text?.fontHeight || 14}px (
                                {texts.text?.fontWeight || "Bold"}) • Scroll:{" "}
                                {texts.text?.scrollType || "Right To Left"} • Lang:{" "}
                                {(texts.text?.language || "en").toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ) : format === "single" ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col p-2.5 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                {selectedTab === Tab.STOPS ? "ANNOUNCEMENT SCROLL TEXT" : "DESTINATION TEXT ZONE"}
                              </span>
                              <span className="text-xs font-semibold text-foreground truncate">
                                {singleText || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                                Font: {texts.text?.fontHeight || 14}px (
                                {texts.text?.fontWeight || "Bold"}) • Scroll:{" "}
                                {texts.text?.scrollType || "Right To Left"} • Speed: {texts.text?.scrollSpeed ?? 4} • Lang:{" "}
                                {(texts.text?.language || "en").toUpperCase()}
                              </span>
                            </div>

                            {selectedTab === Tab.STOPS ? (
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                {stageAudioUrl ? (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <Volume2 className="h-3 w-3 shrink-0" /> Stage Audio: {matchedStageAudio ? "Database" : "Preset"}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    <VolumeX className="h-3 w-3 shrink-0" /> Stage Audio: None
                                  </div>
                                )}
                                {stopAudioUrl ? (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <Volume2 className="h-3 w-3 shrink-0" /> Stop Audio: Ready
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    <VolumeX className="h-3 w-3 shrink-0" /> Stop Audio: None
                                  </div>
                                )}
                              </div>
                            ) : (
                              sim.audioFileUrl && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 font-mono">
                                  <Volume2 className="h-3 w-3 text-amber-500 flex-none" />
                                  <span className="truncate">
                                    TTS: {texts.text?.text} ({sim.audioFileName || "audio.mp3"})
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="flex flex-col p-2 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                ROUTE ZONE
                              </span>
                              <span className="text-xs font-mono font-bold text-foreground truncate">
                                {routeNumText || "—"}
                              </span>
                            </div>
                            <div className="flex flex-col p-2 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                UPPER LINE
                              </span>
                              <span className="text-xs font-medium text-foreground truncate">
                                {texts.upperHalfText?.text || "—"}
                              </span>
                            </div>
                            <div className="flex flex-col p-2 rounded-lg bg-muted/60 border border-border">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                LOWER LINE
                              </span>
                              <span className="text-xs font-medium text-foreground truncate">
                                {texts.lowerHalfText?.text || "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Confirmation Dialog on Unsaved Exit */}
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogContent className="flex p-6 w-[90vw] max-w-[360px] font-sans gap-4 flex-col bg-card rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground">
                  Unsaved Changes
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  You have unsaved changes. Are you sure you want to go back without saving?
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 w-full pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-medium"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Keep Editing
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-8 text-xs font-medium"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    navigate(-1);
                  }}
                >
                  Go Back Without Saving
                </Button>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs font-medium"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    handleSubmit(onSubmit)();
                  }}
                >
                  Save and Exit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  }
);

RouteCreationLayout.displayName = "RouteCreationLayout";
export default RouteCreationLayout;
