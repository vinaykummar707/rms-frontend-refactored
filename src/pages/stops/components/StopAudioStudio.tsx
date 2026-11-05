import React, { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { notify } from "@/core/notifications/notificationService";
import {
  INDIAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_RATE,
  generateStopAudioFile,
} from "@/features/stops/services/edgeTtsService";
import type { IStopAudio } from "@/shared/types/stop";
import {
  Upload,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileAudio,
  X,
  Languages,
  Gauge,
  Volume2,
} from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export interface StopAudioStudioProps {
  stopName: string;
  existingAudio?: IStopAudio | null;
  selectedAudioFile: File | null;
  onSelectAudioFile: (file: File | null) => void;
  markedDeleteExistingAudio: boolean;
  onSetMarkedDeleteExistingAudio: (val: boolean) => void;
  audioFileError?: string;
  onSetAudioFileError?: (err: string) => void;
}

export function StopAudioStudio({
  stopName,
  existingAudio,
  selectedAudioFile,
  onSelectAudioFile,
  markedDeleteExistingAudio,
  onSetMarkedDeleteExistingAudio,
  audioFileError = "",
  onSetAudioFileError,
}: StopAudioStudioProps) {
  // Edge-TTS Generation States
  const [speechText, setSpeechText] = useState(stopName || "");
  const [ttsLanguage, setTtsLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [ttsGender, setTtsGender] = useState<"female" | "male">("female");
  const [ttsRate, setTtsRate] = useState<string>(DEFAULT_RATE);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Audio Playback
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected file object URL for preview
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);

  // Synchronize speechText when stopName prop changes (e.g. user edits name in Step 1)
  useEffect(() => {
    if (stopName) {
      setSpeechText(stopName);
    }
  }, [stopName]);

  // Create preview URL when a new file is chosen / generated
  useEffect(() => {
    if (selectedAudioFile) {
      const url = URL.createObjectURL(selectedAudioFile);
      setSelectedFileUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setSelectedFileUrl(null);
    }
  }, [selectedAudioFile]);

  // Stop playback when component unmounts
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute("src");
      }
    };
  }, []);

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

  // Play / Pause toggle
  const togglePlayAudio = (url: string) => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.onended = () => setPlayingAudioUrl(null);
      audioPlayerRef.current.onerror = () => setPlayingAudioUrl(null);
    }

    if (playingAudioUrl === url) {
      audioPlayerRef.current.pause();
      setPlayingAudioUrl(null);
      return;
    }

    audioPlayerRef.current.src = url;
    audioPlayerRef.current
      .play()
      .then(() => setPlayingAudioUrl(url))
      .catch((err) => {
        console.warn("Audio playback failed:", err);
        setPlayingAudioUrl(null);
      });
  };

  // Audio File Picker handler (Strictly restricted to MP3 and WAV)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isMp3 = ext === "mp3" || file.type.includes("mpeg") || file.type.includes("mp3");
    const isWav = ext === "wav" || file.type.includes("wav") || file.type.includes("wave");

    if (!isMp3 && !isWav) {
      onSetAudioFileError?.("Only .mp3 and .wav audio files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      onSetAudioFileError?.("Audio file size must be less than 20MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    onSetAudioFileError?.("");
    onSelectAudioFile(file);
    onSetMarkedDeleteExistingAudio(false);
  };

  // Trigger Edge-TTS Synthesis
  const handleGenerateAudioTts = async () => {
    const textToSpeak = speechText.trim() || stopName.trim();
    if (!textToSpeak) {
      onSetAudioFileError?.("Please provide a stop name to generate audio.");
      return;
    }

    try {
      setIsSynthesizing(true);
      onSetAudioFileError?.("");
      const file = await generateStopAudioFile(textToSpeak, {
        language: ttsLanguage,
        gender: ttsGender,
        rate: ttsRate,
      });

      onSelectAudioFile(file);
      onSetMarkedDeleteExistingAudio(false);
      notify.success(`Generated announcement audio for "${textToSpeak}" using Edge-TTS!`);

      // Auto-preview playback
      const tempUrl = URL.createObjectURL(file);
      togglePlayAudio(tempUrl);
    } catch (err: any) {
      console.error("[StopAudioStudio] TTS generation error:", err);
      onSetAudioFileError?.(err.message || "Failed to generate audio via Edge-TTS server.");
      notify.error(err.message || "TTS generation failed. Please verify the local server is running.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input strictly restricted to .mp3 and .wav */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Case A: Already has existing audio and not marked deleted */}
      {existingAudio && !markedDeleteExistingAudio && !selectedAudioFile && (
        <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in-50">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileAudio className="h-4 w-4" />
            </div>
            <div className="truncate">
              <span className="text-xs font-medium text-foreground truncate block">
                {existingAudio.file_name || "stop-audio.mp3"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatFileSize(existingAudio.file_size)} • Current announcement audio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={playingAudioUrl === existingAudio.url ? "default" : "outline"}
              className="h-8 text-xs px-2.5 gap-1.5 font-medium"
              onClick={() => togglePlayAudio(existingAudio.url)}
            >
              {playingAudioUrl === existingAudio.url ? (
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs px-2.5"
              title="Replace Audio"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Replace</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remove Audio"
              onClick={() => {
                if (audioPlayerRef.current) audioPlayerRef.current.pause();
                setPlayingAudioUrl(null);
                onSetMarkedDeleteExistingAudio(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Case B: New audio file selected or synthesized */}
      {selectedAudioFile && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in-50">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileAudio className="h-4 w-4" />
            </div>
            <div className="truncate">
              <span className="text-xs font-medium text-foreground truncate block">
                {selectedAudioFile.name}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {formatFileSize(selectedAudioFile.size)} • Ready to save
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedFileUrl && (
              <Button
                type="button"
                size="sm"
                variant={playingAudioUrl === selectedFileUrl ? "default" : "outline"}
                className="h-8 text-xs px-2.5 gap-1.5 font-medium"
                onClick={() => togglePlayAudio(selectedFileUrl)}
              >
                {playingAudioUrl === selectedFileUrl ? (
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
              title="Cancel file selection"
              onClick={() => {
                if (audioPlayerRef.current) audioPlayerRef.current.pause();
                setPlayingAudioUrl(null);
                onSelectAudioFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Case C: Marked existing audio deleted */}
      {markedDeleteExistingAudio && !selectedAudioFile && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-center justify-between gap-2 animate-in fade-in-50">
          <span className="text-[11px] text-destructive">
            Existing audio file will be deleted upon saving.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => onSetMarkedDeleteExistingAudio(false)}
          >
            Undo
          </Button>
        </div>
      )}

      {/* Edge-TTS Studio Configuration Box */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">
                On-Demand AI Audio Generation (Microsoft Edge-TTS)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Configure voice and pronunciation to synthesize public address announcement audio.
              </p>
            </div>
          </div>
        </div>

        {/* All fields in a single row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
          {/* Announcement Text */}
          <div className="flex-1 min-w-[170px] space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              <span>Announcement Text</span>
            </label>
            <Input
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder="e.g. Kempegowda Bus Station"
              className="h-8 text-xs font-medium"
            />
          </div>

          {/* Language Dropdown */}
          <div className="w-full sm:w-[150px] shrink-0 space-y-1">
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
          <div className="w-full sm:w-[104px] shrink-0 space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Voice
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
          <div className="w-full sm:w-[125px] shrink-0 space-y-1">
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
              onClick={handleGenerateAudioTts}
              disabled={isSynthesizing || !speechText.trim()}
              className="h-8 text-xs gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs px-3 w-full sm:w-auto"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating...</span>
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
            Max 20MB. Audio announcement is optional.
          </span>
        </div>
      </div>

      <FieldErrorText message={audioFileError} />
    </div>
  );
}

export default StopAudioStudio;

