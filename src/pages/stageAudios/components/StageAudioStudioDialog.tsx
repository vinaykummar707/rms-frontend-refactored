import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  INDIAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_RATE,
  resolveVoice,
} from "@/features/stops/services/edgeTtsService";
import {
  generateStageAudioFile,
  checkStageAudioDuplicate,
  slugifyText,
} from "@/features/stageAudios/services/stageAudioService";
import {
  getStagePreset,
  getDefaultReferenceText,
} from "@/features/stageAudios/services/stageAudioPresets";
import { notify } from "@/core/notifications/notificationService";
import type { ILanguageOption } from "@/features/stops/services/edgeTtsService";
import type { IStageAudio, StageType } from "@/shared/types/stageAudio";
import { STAGE_TYPES } from "@/shared/types/stageAudio";
import {
  Sparkles,
  Play,
  Pause,
  FileAudio,
  X,
  Loader2,
  Save,
  Languages,
  Gauge,
  AlertCircle,
  Pencil,
  FileText,
  Radio,
  Lightbulb,
} from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface StageAudioStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLanguage: ILanguageOption | null;
  targetStageType: StageType | null;
  audio?: IStageAudio | null;
  onSave: (
    payload: {
      language: string;
      stageType: StageType;
      referenceText: string;
      announcementText: string;
      file: File | null;
      metadata?: { voice?: string; speed?: string };
    },
    existingAudio?: IStageAudio
  ) => Promise<void>;
}

export function StageAudioStudioDialog({
  open,
  onOpenChange,
  targetLanguage,
  targetStageType,
  audio,
  onSave,
}: StageAudioStudioDialogProps) {
  const isEdit = Boolean(audio);

  const [languageCode, setLanguageCode] = useState<string>(DEFAULT_LANGUAGE);
  const [stageType, setStageType] = useState<StageType>("next_stop");

  const [referenceText, setReferenceText] = useState("");
  const [referenceTextError, setReferenceTextError] = useState("");

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementTextError, setAnnouncementTextError] = useState("");

  const [ttsGender, setTtsGender] = useState<"female" | "male">("female");
  const [ttsRate, setTtsRate] = useState<string>(DEFAULT_RATE);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or reset state on open/target changes
  useEffect(() => {
    if (open) {
      if (audio) {
        setLanguageCode(audio.language);
        setStageType(audio.stage_type);
        setReferenceText(audio.reference_text || "");
        setAnnouncementText(audio.announcement_text || "");
        setTtsRate(audio.speed || DEFAULT_RATE);
      } else {
        const lang = targetLanguage?.code || DEFAULT_LANGUAGE;
        const stage = targetStageType || "next_stop";
        const langObj =
          targetLanguage || INDIAN_LANGUAGES.find((l) => l.code === lang);

        setLanguageCode(lang);
        setStageType(stage);

        const defaultRef = getDefaultReferenceText(
          langObj?.name || "English",
          stage
        );
        const defaultPreset = getStagePreset(lang, stage);

        setReferenceText(defaultRef);
        setAnnouncementText(defaultPreset);
        setTtsGender("female");
        setTtsRate(DEFAULT_RATE);
      }

      setReferenceTextError("");
      setAnnouncementTextError("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsPlayingAudio(false);
      setIsSynthesizing(false);
      setIsCheckingDuplicate(false);
      setIsSaving(false);
      setGeneralError("");
    }
  }, [open, audio, targetLanguage, targetStageType]);

  // Object URL cleanup for preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  // Player cleanup
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute("src");
      }
    };
  }, []);

  // Sync selectedFile name prefix when referenceText changes
  useEffect(() => {
    if (selectedFile && referenceText.trim()) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "mp3";
      const slug = slugifyText(referenceText.trim()) || stageType;
      if (!selectedFile.name.startsWith(`${slug}-`)) {
        const timestampMatch = selectedFile.name.match(/-(\d+)\.[^.]+$/);
        const ts = timestampMatch ? timestampMatch[1] : Date.now();
        const renamed = new File([selectedFile], `${slug}-${ts}.${ext}`, {
          type: selectedFile.type,
        });
        setSelectedFile(renamed);
      }
    }
  }, [referenceText, stageType]);

  // Current language metadata
  const currentLanguage = useMemo(
    () =>
      INDIAN_LANGUAGES.find((l) => l.code === languageCode) ||
      INDIAN_LANGUAGES[0],
    [languageCode]
  );

  const currentStageMeta = useMemo(
    () => STAGE_TYPES.find((s) => s.type === stageType) || STAGE_TYPES[0],
    [stageType]
  );

  const nativePreset = useMemo(
    () => getStagePreset(languageCode, stageType),
    [languageCode, stageType]
  );

  const speedItems = useMemo(
    () => [
      { value: "-8%", label: "0.90x (Clear)" },
      { value: "-4%", label: "0.95x (Transit)" },
      { value: "+0%", label: "1.00x (Normal)" },
      { value: "+5%", label: "1.05x (Fast)" },
    ],
    []
  );

  const displayExistingFileName = useMemo(() => {
    if (!audio) return "";
    const ext = audio.file_name?.split(".").pop() || "mp3";
    if (referenceText.trim()) {
      const slug = slugifyText(referenceText.trim());
      return `${slug}.${ext}`;
    }
    return audio.file_name;
  }, [audio, referenceText]);

  const togglePlayAudio = (url: string) => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.onended = () => setIsPlayingAudio(false);
      audioPlayerRef.current.onerror = () => setIsPlayingAudio(false);
    }

    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.warn("[StageAudioStudioDialog] Playback error:", err);
          setIsPlayingAudio(false);
        });
    }
  };

  // Synthesize via Edge-TTS
  const handleGenerate = async () => {
    const trimmedRefText = referenceText.trim();
    const trimmedAnnounceText = announcementText.trim();

    let hasError = false;
    if (!trimmedRefText) {
      setReferenceTextError("Reference title is required.");
      hasError = true;
    } else {
      setReferenceTextError("");
    }

    if (!trimmedAnnounceText) {
      setAnnouncementTextError("Announcement speech text is required.");
      hasError = true;
    } else {
      setAnnouncementTextError("");
    }

    if (hasError) return;
    setGeneralError("");

    try {
      setIsSynthesizing(true);
      const file = await generateStageAudioFile(
        trimmedAnnounceText,
        trimmedRefText,
        stageType,
        {
          language: languageCode,
          gender: ttsGender,
          rate: ttsRate,
        }
      );

      setSelectedFile(file);
      notify.success("Synthesized stage audio announcement via Edge-TTS!");

      // Auto play preview
      const tempUrl = URL.createObjectURL(file);
      togglePlayAudio(tempUrl);
    } catch (err: any) {
      console.error("[StageAudioStudioDialog] TTS error:", err);
      setGeneralError(err.message || "Failed to generate audio via Edge-TTS.");
      notify.error(err.message || "TTS synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Direct file upload (.mp3, .wav)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isMp3 = ext === "mp3" || file.type.includes("mpeg") || file.type.includes("mp3");
    const isWav = ext === "wav" || file.type.includes("wav") || file.type.includes("wave");

    if (!isMp3 && !isWav) {
      setGeneralError("Only .mp3 and .wav audio files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setGeneralError("Audio file size must be less than 20MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const refSlug = referenceText.trim() ? slugifyText(referenceText.trim()) : stageType;
    const namedFile = new File([file], `${refSlug}-${Date.now()}.${ext}`, {
      type: file.type,
    });

    setGeneralError("");
    setSelectedFile(namedFile);
  };

  // Save / Update validation
  const handleSave = async () => {
    const trimmedRefText = referenceText.trim();
    const trimmedAnnounceText = announcementText.trim();

    let hasError = false;
    if (!trimmedRefText) {
      setReferenceTextError("Reference title is required.");
      hasError = true;
    } else {
      setReferenceTextError("");
    }

    if (!trimmedAnnounceText) {
      setAnnouncementTextError("Announcement speech text is required.");
      hasError = true;
    } else {
      setAnnouncementTextError("");
    }

    if (!isEdit && !selectedFile) {
      setGeneralError("Please synthesize or upload an audio file first.");
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsCheckingDuplicate(true);
      setGeneralError("");

      // Duplicate validation
      const isDuplicate = await checkStageAudioDuplicate(
        languageCode,
        stageType,
        audio?.id
      );

      if (isDuplicate) {
        setGeneralError(
          `An audio announcement for stage "${stageType}" in "${languageCode}" already exists. Please edit the existing record instead.`
        );
        setIsCheckingDuplicate(false);
        return;
      }

      setIsSaving(true);
      const voiceName = resolveVoice(languageCode, ttsGender);

      await onSave(
        {
          language: languageCode,
          stageType,
          referenceText: trimmedRefText,
          announcementText: trimmedAnnounceText,
          file: selectedFile,
          metadata: {
            voice: voiceName,
            speed: ttsRate,
          },
        },
        audio || undefined
      );

      onOpenChange(false);
    } catch (err: any) {
      console.error("[StageAudioStudioDialog] Save error:", err);
      setGeneralError(err.message || "Failed to save stage audio.");
    } finally {
      setIsCheckingDuplicate(false);
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (isSaving || isSynthesizing || isCheckingDuplicate)) return;
        onOpenChange(next);
      }}
      disablePointerDismissal={true}
    >
      <DialogContent className="sm:max-w-3xl p-5 max-h-[90vh] overflow-y-auto">
        <input
          type="file"
          ref={fileInputRef}
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Dialog Header */}
        <DialogHeader className="pb-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {isEdit ? <Pencil className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{isEdit ? "Edit Stage Audio" : "Configure Stage Audio"}</span>
                <Badge
                  variant="outline"
                  className={cn("text-xs font-semibold px-2 py-0.5", currentStageMeta.color)}
                >
                  {currentStageMeta.label}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Waypoint stage announcement leading clip for {currentLanguage.name} ({currentLanguage.nativeName})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2.5">
          {/* Row 1: Language & Stage Selection Badges */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Target Language:</span>
              <span className="font-bold text-foreground">{currentLanguage.name}</span>
              <span className="text-muted-foreground font-medium">({currentLanguage.nativeName})</span>
            </div>
            <Badge variant="secondary" className="font-mono text-xs uppercase px-1.5">
              {languageCode}
            </Badge>
          </div>

          {/* Row 2: Reference Title / Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-ref-text" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Reference Title / Name *</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Used for table inventory record and file name prefix
              </span>
            </div>
            <Input
              id="stage-ref-text"
              value={referenceText}
              onChange={(e) => {
                setReferenceText(e.target.value);
                if (referenceTextError) setReferenceTextError("");
              }}
              placeholder="e.g. Kannada - Next Stop Is"
              className={cn(
                "h-8 text-xs font-medium",
                referenceTextError && "border-destructive focus-visible:ring-destructive/20"
              )}
              autoFocus
            />
            {referenceTextError && (
              <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{referenceTextError}</span>
              </p>
            )}
          </div>

          {/* Row 3: Announcement Speech Text & Native Preset Suggestion */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-announce-text" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Announcement Speech Text (Spoken by Edge-TTS) *</span>
              </Label>

              {nativePreset && (
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementText(nativePreset);
                    if (announcementTextError) setAnnouncementTextError("");
                  }}
                  className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded transition-colors"
                  title={`Insert preset: "${nativePreset}"`}
                >
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  <span>Use Native Preset: <strong>"{nativePreset}"</strong></span>
                </button>
              )}
            </div>
            <Textarea
              id="stage-announce-text"
              rows={2}
              value={announcementText}
              onChange={(e) => {
                setAnnouncementText(e.target.value);
                if (announcementTextError) setAnnouncementTextError("");
              }}
              placeholder={`e.g. ${nativePreset || "Next stop is"}`}
              className={cn(
                "text-xs font-medium resize-none",
                announcementTextError && "border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {announcementTextError && (
              <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{announcementTextError}</span>
              </p>
            )}
          </div>

          {/* Row 4: Single Row Edge-TTS Studio Configuration Box */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
              <div className="h-6 w-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Edge-TTS Speech Synthesis Engine
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Synthesize natural audio using neural voice or upload pre-recorded audio.
                </p>
              </div>
            </div>

            {/* Single Row Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 pt-0.5">
              {/* Voice Gender Toggle */}
              <div className="flex-1 space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Voice Gender
                </label>
                <div className="flex items-center rounded-lg border border-border bg-background p-0.5 h-8">
                  <button
                    type="button"
                    onClick={() => setTtsGender("female")}
                    className={cn(
                      "flex-1 text-xs py-1 rounded-md font-medium transition-all",
                      ttsGender === "female"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setTtsGender("male")}
                    className={cn(
                      "flex-1 text-xs py-1 rounded-md font-medium transition-all",
                      ttsGender === "male"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Male
                  </button>
                </div>
              </div>

              {/* Speed / Pacing */}
              <div className="w-full sm:w-[140px] shrink-0 space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  <span>Speed</span>
                </label>
                <Select
                  value={ttsRate}
                  onValueChange={(val) => {
                    if (val) setTtsRate(val);
                  }}
                  items={speedItems}
                >
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue placeholder="Select Speed" />
                  </SelectTrigger>
                  <SelectContent>
                    {speedItems.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons: Generate & Direct Upload */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isSynthesizing}
                  className="h-8 text-xs gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs px-3"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Generate</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs px-2.5 gap-1.5"
                  title="Upload studio .mp3 or .wav"
                >
                  <FileAudio className="h-3.5 w-3.5" />
                  <span>Upload</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Row 5: Preview Box - Case 1: Newly Generated or Uploaded */}
          {selectedFile && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in-50">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-medium text-foreground truncate block font-mono">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    {formatFileSize(selectedFile.size)} • Ready to save
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {previewUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isPlayingAudio ? "default" : "outline"}
                    className="h-8 text-xs px-2.5 gap-1.5 font-medium"
                    onClick={() => togglePlayAudio(previewUrl)}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Preview</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs px-2 text-muted-foreground hover:text-destructive"
                  title="Remove selection"
                  onClick={() => {
                    if (audioPlayerRef.current) audioPlayerRef.current.pause();
                    setIsPlayingAudio(false);
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Row 5: Preview Box - Case 2: Existing Audio in Edit Mode */}
          {isEdit && audio && !selectedFile && (
            <div className="rounded-lg border border-border bg-card p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-8 w-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-medium text-foreground truncate block font-mono">
                    {displayExistingFileName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatFileSize(audio.file_size)} • Current saved stage audio
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={isPlayingAudio ? "default" : "outline"}
                  className="h-8 text-xs px-2.5 gap-1.5 font-medium"
                  onClick={() => togglePlayAudio(audio.url)}
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>Preview</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {generalError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 flex items-center gap-2 text-destructive text-xs animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}
        </div>

        {/* Footer strictly with ZERO Cancel button */}
        <DialogFooter className="pt-2 border-t border-border flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isCheckingDuplicate || isSynthesizing}
            className="h-8 text-xs font-semibold gap-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : isCheckingDuplicate ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{isEdit ? "Update Stage Audio" : "Save to Stage Matrix"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StageAudioStudioDialog;
