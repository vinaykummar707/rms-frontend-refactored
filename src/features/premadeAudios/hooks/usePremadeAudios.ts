import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { premadeAudioCrud } from "../api/premadeAudioCrud";
import {
  deletePremadeAudio,
  uploadPremadeAudioFile,
  generateAndUploadPremadeAudio,
  updatePremadeAudio,
} from "../services/premadeAudioService";
import type { SynthesizeOptions } from "@/features/stops/services/edgeTtsService";
import type { IPremadeAudio } from "@/shared/types/premadeAudio";
import { notify } from "@/core/notifications/notificationService";

export function usePremadeAudios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Audio Playback Player Reference
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingAudioUrl(null);
      audioRef.current.onerror = () => setPlayingAudioUrl(null);
    }
    return audioRef.current;
  }, []);

  const playAudio = useCallback(
    (url: string) => {
      const audio = getAudioElement();
      if (!audio) return;

      if (playingAudioUrl === url) {
        audio.pause();
        setPlayingAudioUrl(null);
        return;
      }

      audio.src = url;
      audio
        .play()
        .then(() => setPlayingAudioUrl(url))
        .catch((err) => {
          console.warn("[usePremadeAudios] Playback failed:", err);
          setPlayingAudioUrl(null);
        });
    },
    [getAudioElement, playingAudioUrl]
  );

  const stopAudio = useCallback(() => {
    const audio = getAudioElement();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setPlayingAudioUrl(null);
  }, [getAudioElement]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      }
    };
  }, []);

  // Fetch all premade audios ordered by created_at DESC
  const {
    data: premadeAudioData,
    isLoading,
    refetch,
    error,
  } = premadeAudioCrud.useList({
    orderBy: { column: "created_at", ascending: false },
  });

  const audios: IPremadeAudio[] = useMemo(() => {
    return (premadeAudioData?.data as IPremadeAudio[]) || [];
  }, [premadeAudioData]);

  // Filtered audios by search term (searches reference_text, announcement_text, file_name, language)
  const filteredAudios = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return audios;

    return audios.filter(
      (a) =>
        a.reference_text.toLowerCase().includes(q) ||
        (a.announcement_text && a.announcement_text.toLowerCase().includes(q)) ||
        a.file_name.toLowerCase().includes(q) ||
        (a.language && a.language.toLowerCase().includes(q)) ||
        (a.voice && a.voice.toLowerCase().includes(q))
    );
  }, [audios, searchTerm]);

  // Upload an audio file with reference text & optional announcement text
  const handleUpload = async (
    file: File,
    referenceText: string,
    metadata?: { announcementText?: string; language?: string; voice?: string; speed?: string }
  ) => {
    try {
      setIsUploading(true);
      const created = await uploadPremadeAudioFile(file, referenceText, metadata);
      notify.success(`Premade audio "${created.reference_text}" saved successfully!`);
      await refetch();
      return created;
    } catch (err: any) {
      notify.error(err.message || "Failed to upload premade audio.");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Generate with Edge-TTS using spoken announcement text, and save with reference text
  const handleGenerate = async (
    announcementText: string,
    referenceText: string,
    options?: SynthesizeOptions
  ) => {
    try {
      setIsGenerating(true);
      notify.info(`Generating audio announcement for "${referenceText}"...`);
      const created = await generateAndUploadPremadeAudio(
        announcementText,
        referenceText,
        options
      );
      notify.success(`Premade audio "${created.reference_text}" generated and saved!`);
      await refetch();
      return created;
    } catch (err: any) {
      notify.error(err.message || "Failed to generate premade audio.");
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Update existing premade audio record
  const handleUpdate = async (
    id: string,
    payload: {
      referenceText: string;
      announcementText?: string;
      file?: File | null;
      language?: string;
      voice?: string;
      speed?: string;
    },
    existingAudio?: IPremadeAudio
  ) => {
    try {
      setIsUploading(true);
      const updated = await updatePremadeAudio(id, payload, existingAudio);
      notify.success(`Updated premade audio "${updated.reference_text}"`);
      await refetch();
      return updated;
    } catch (err: any) {
      notify.error(err.message || "Failed to update premade audio.");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Delete audio from storage & database
  const handleDelete = async (audio: IPremadeAudio) => {
    try {
      setIsDeleting(true);
      stopAudio();
      await deletePremadeAudio(audio);
      notify.success(`Deleted audio "${audio.reference_text}"`);
      await refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete audio.");
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    audios,
    filteredAudios,
    isLoading,
    isDeleting,
    isUploading,
    isGenerating,
    searchTerm,
    setSearchTerm,
    playingAudioUrl,
    playAudio,
    stopAudio,
    handleUpload,
    handleGenerate,
    handleUpdate,
    handleDelete,
    refetch,
    error,
  };
}
