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
  checkPremadeAudioDuplicate,
  generatePremadeAudioFile,
  slugifyText,
} from "@/features/premadeAudios/services/premadeAudioService";
import { notify } from "@/core/notifications/notificationService";
import type { IPremadeAudio } from "@/shared/types/premadeAudio";
import {
  Volume2,
  Sparkles,
  Upload,
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
} from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface PremadeAudioStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audio?: IPremadeAudio | null;
  onSave: (
    payload: {
      referenceText: string;
      announcementText: string;
      file: File | null;
      metadata?: { language?: string; voice?: string; speed?: string };
    },
    existingAudio?: IPremadeAudio
  ) => Promise<void>;
}

export function PremadeAudioStudioDialog({
  open,
  onOpenChange,
  audio,
  onSave,
}: PremadeAudioStudioDialogProps) {
  const isEdit = Boolean(audio);

  const [referenceText, setReferenceText] = useState("");
  const [referenceTextError, setReferenceTextError] = useState("");

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementTextError, setAnnouncementTextError] = useState("");

  const [ttsLanguage, setTtsLanguage] = useState<string>(DEFAULT_LANGUAGE);
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

  // Initialize or reset state on open/audio change
  useEffect(() => {
    if (open) {
      if (audio) {
        setReferenceText(audio.reference_text || "");
        setAnnouncementText(audio.announcement_text || audio.reference_text || "");
        setTtsLanguage(audio.language || DEFAULT_LANGUAGE);
        setTtsRate(audio.speed || DEFAULT_RATE);
      } else {
        setReferenceText("");
        setAnnouncementText("");
        setTtsLanguage(DEFAULT_LANGUAGE);
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
  }, [open, audio]);

  // Handle object URL creation & cleanup for preview
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

  // Clean audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute("src");
      }
    };
  }, []);

  // For existing audio in edit mode, compute display filename reflecting Reference Title prefix
  const displayExistingFileName = useMemo(() => {
    if (!audio) return "";
    const ext = audio.file_name?.split(".").pop() || "mp3";
    if (referenceText.trim()) {
      const slug = slugifyText(referenceText.trim());
      return `${slug}.${ext}`;
    }
    return audio.file_name;
  }, [audio, referenceText]);

  // Keep preview audio file name prefix strictly synchronized with Reference Title / Name
  useEffect(() => {
    if (selectedFile && referenceText.trim()) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "mp3";
      const slug = slugifyText(referenceText.trim()) || "premade-audio";
      if (!selectedFile.name.startsWith(`${slug}-`)) {
        const timestampMatch = selectedFile.name.match(/-(\d+)\.[^.]+$/);
        const ts = timestampMatch ? timestampMatch[1] : Date.now();
        const renamed = new File([selectedFile], `${slug}-${ts}.${ext}`, {
          type: selectedFile.type,
        });
        setSelectedFile(renamed);
      }
    }
  }, [referenceText]);

  const languageItems = useMemo(
    () =>
      INDIAN_LANGUAGES.map((l) => ({
        value: l.code,
        label: `${l.name} (${l.nativeName})`,
      })),
    []
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
          console.warn("[PremadeAudioStudioDialog] Playback error:", err);
          setIsPlayingAudio(false);
        });
    }
  };

  // Generate with Edge-TTS using announcementText for speech and referenceText for file prefix
  const handleGenerate = async () => {
    const trimmedRefText = referenceText.trim();
    const trimmedAnnounceText = announcementText.trim();

    let hasError = false;
    if (!trimmedRefText) {
      setReferenceTextError("Please enter Reference Title / Name (used for audio file prefix).");
      hasError = true;
    } else {
      setReferenceTextError("");
    }

    if (!trimmedAnnounceText) {
      setAnnouncementTextError("Please enter announcement speech text to synthesize.");
      hasError = true;
    } else {
      setAnnouncementTextError("");
    }

    if (hasError) return;
    setGeneralError("");

    try {
      setIsSynthesizing(true);
      const file = await generatePremadeAudioFile(
        trimmedAnnounceText,
        trimmedRefText,
        {
          language: ttsLanguage,
          gender: ttsGender,
          rate: ttsRate,
        }
      );

      setSelectedFile(file);
      notify.success("Synthesized audio announcement using Edge-TTS!");

      // Auto play preview
      const tempUrl = URL.createObjectURL(file);
      togglePlayAudio(tempUrl);
    } catch (err: any) {
      console.error("[PremadeAudioStudioDialog] TTS error:", err);
      setGeneralError(err.message || "Failed to generate audio via Edge-TTS server.");
      notify.error(err.message || "TTS synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Handle direct file upload (.mp3, .wav)
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

    const refSlug = referenceText.trim() ? slugifyText(referenceText.trim()) : "";
    const namedFile = refSlug
      ? new File([file], `${refSlug}-${Date.now()}.${ext}`, { type: file.type })
      : file;

    setGeneralError("");
    setSelectedFile(namedFile);

    // If reference text is empty, prefill with file basename
    if (!referenceText.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      setReferenceText(baseName);
    }
    if (!announcementText.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      setAnnouncementText(baseName);
    }
  };

  // Validate duplicate & save
  const handleSave = async () => {
    const trimmedRefText = referenceText.trim();
    const trimmedAnnounceText = announcementText.trim() || trimmedRefText;

    let hasError = false;
    if (!trimmedRefText) {
      setReferenceTextError("Reference title / text is required.");
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

    // Require an audio file when creating
    if (!isEdit && !selectedFile) {
      setGeneralError("Please synthesize or upload an audio file first.");
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsCheckingDuplicate(true);
      setGeneralError("");

      // Duplicate check: verify no record with same reference_text exists
      const isDuplicate = await checkPremadeAudioDuplicate(
        trimmedRefText,
        audio?.id
      );

      if (isDuplicate) {
        setReferenceTextError(
          `A premade audio with reference text "${trimmedRefText}" already exists. Please choose a distinct title.`
        );
        setIsCheckingDuplicate(false);
        return;
      }

      setIsSaving(true);

      const voiceName = resolveVoice(ttsLanguage, ttsGender);

      await onSave(
        {
          referenceText: trimmedRefText,
          announcementText: trimmedAnnounceText,
          file: selectedFile,
          metadata: {
            language: ttsLanguage,
            voice: voiceName,
            speed: ttsRate,
          },
        },
        audio || undefined
      );

      onOpenChange(false);
    } catch (err: any) {
      console.error("[PremadeAudioStudioDialog] Save error:", err);
      setGeneralError(err.message || "Failed to save premade audio.");
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
        {/* Hidden file input strictly restricted to .mp3 and .wav */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
          className="hidden"
          onChange={handleFileChange}
        />

        <DialogHeader className="pb-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              {isEdit ? <Pencil className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {isEdit ? "Edit Premade Audio" : "Generate or Upload Premade Audio"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEdit
                  ? "Update reference identification, announcement speech text, or regenerate audio."
                  : "Synthesize public address announcements using Edge-TTS or upload pre-recorded audio."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2.5">
          {/* Reference Text (Title used for inventory identification & file naming) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="ref-text" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Reference Title / Name *</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Used for table inventory record and file name
              </span>
            </div>
            <Input
              id="ref-text"
              value={referenceText}
              onChange={(e) => {
                setReferenceText(e.target.value);
                if (referenceTextError) setReferenceTextError("");
              }}
              placeholder="e.g. Majestic Arrival Announcement or Route 335E Interchange"
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

          {/* Announcement Speech Text (Actual words synthesized into audio) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="announce-text" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Announcement Speech Text (Spoken by Edge-TTS) *</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Actual speech text synthesized into audio
              </span>
            </div>
            <Textarea
              id="announce-text"
              rows={2}
              value={announcementText}
              onChange={(e) => {
                setAnnouncementText(e.target.value);
                if (announcementTextError) setAnnouncementTextError("");
              }}
              placeholder="e.g. Attention passengers, the next stop is Majestic Bus Station. Please alight towards the left."
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

          {/* Edge-TTS Studio Configuration Box (Single Row) */}
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
                  Select dialect, neural voice gender, and transit pacing rate.
                </p>
              </div>
            </div>

            {/* Single Row Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 pt-0.5">
              {/* Language Dropdown */}
              <div className="flex-1 min-w-[170px] space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Languages className="h-3 w-3" />
                  <span>Language</span>
                </label>
                <Select
                  value={ttsLanguage}
                  onValueChange={(val) => {
                    if (val) setTtsLanguage(val);
                  }}
                  items={languageItems}
                >
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {INDIAN_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{lang.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {lang.nativeName}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Gender Toggle */}
              <div className="w-full sm:w-[110px] shrink-0 space-y-1">
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
              <div className="w-full sm:w-[130px] shrink-0 space-y-1">
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

              {/* Generate Button */}
              <div className="shrink-0 space-y-1">
                <span className="text-[11px] font-semibold invisible hidden sm:block">
                  Action
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isSynthesizing}
                  className="h-8 text-xs gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs px-3 w-full sm:w-auto"
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
              </div>
            </div>
          </div>

          {/* Case 1: Newly Generated or Selected File */}
          {selectedFile && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in-50">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-medium text-foreground truncate block">
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

          {/* Case 2: Existing Audio in Edit Mode (if no new file generated yet) */}
          {isEdit && audio && !selectedFile && (
            <div className="rounded-lg border border-border bg-card p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-8 w-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-medium text-foreground truncate block">
                    {displayExistingFileName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatFileSize(audio.file_size)} • Current saved announcement audio
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
                      <span>Play</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Upload Custom Audio Bar */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 font-medium shadow-2xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Custom Audio (.mp3, .wav)</span>
              </Button>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Max 20MB. Audio file is stored in public inventory.
              </span>
            </div>
          </div>

          {generalError && (
            <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{generalError}</span>
            </p>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end sm:justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={
              isSaving ||
              isCheckingDuplicate ||
              isSynthesizing ||
              (!isEdit && !selectedFile) ||
              !referenceText.trim()
            }
            className="text-xs font-semibold gap-1.5 shadow-xs"
          >
            {isCheckingDuplicate ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Checking Duplicates...</span>
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{isEdit ? "Save Changes" : "Save to Audio Inventory"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PremadeAudioStudioDialog;
