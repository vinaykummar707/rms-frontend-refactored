import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { stageAudioCrud } from "../api/stageAudioCrud";
import {
  uploadStageAudioFile,
  updateStageAudio,
  deleteStageAudio,
} from "../services/stageAudioService";
import { INDIAN_LANGUAGES } from "@/features/stops/services/edgeTtsService";
import type {
  IStageAudio,
  StageType,
  IStageMatrixRow,
} from "@/shared/types/stageAudio";
import { notify } from "@/core/notifications/notificationService";

export function useStageAudios() {
  const { useList } = stageAudioCrud;
  const {
    data: stageAudiosResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useList({
    orderBy: { column: "created_at", ascending: true },
  });

  const stageAudios = (stageAudiosResponse?.data as IStageAudio[]) || [];

  // Audio preview player state
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute("src");
      }
    };
  }, []);

  const togglePlayAudio = useCallback((url: string) => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.onended = () => setPlayingAudioUrl(null);
      audioPlayerRef.current.onerror = () => setPlayingAudioUrl(null);
    }

    if (playingAudioUrl === url) {
      audioPlayerRef.current.pause();
      setPlayingAudioUrl(null);
    } else {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current
        .play()
        .then(() => setPlayingAudioUrl(url))
        .catch((err) => {
          console.warn("[useStageAudios] Playback error:", err);
          setPlayingAudioUrl(null);
          notify.error("Unable to play audio preview.");
        });
    }
  }, [playingAudioUrl]);

  // Build 11-row matrix mapped against INDIAN_LANGUAGES
  const matrixRows = useMemo<IStageMatrixRow[]>(() => {
    const audioLookup = new Map<string, IStageAudio>();
    for (const audio of stageAudios) {
      const key = `${audio.language.toLowerCase()}::${audio.stage_type.toLowerCase()}`;
      audioLookup.set(key, audio);
    }

    return INDIAN_LANGUAGES.map((lang) => {
      const langKey = lang.code.toLowerCase();
      return {
        language: lang,
        cells: {
          current_stop: audioLookup.get(`${langKey}::current_stop`) || null,
          next_stop: audioLookup.get(`${langKey}::next_stop`) || null,
          arriving_stop: audioLookup.get(`${langKey}::arriving_stop`) || null,
        },
      };
    });
  }, [stageAudios]);

  // KPI Statistics
  const totalSlots = INDIAN_LANGUAGES.length * 3; // 33
  const configuredCount = stageAudios.length;
  const coveragePercent = Math.min(
    100,
    Math.round((configuredCount / Math.max(1, totalSlots)) * 100)
  );

  // Mutations
  const handleCreate = async (
    file: File,
    language: string,
    stageType: StageType,
    referenceText: string,
    metadata: {
      announcementText: string;
      stageLabel?: string;
      voice?: string;
      speed?: string;
      createdBy?: string;
    }
  ): Promise<IStageAudio> => {
    try {
      const created = await uploadStageAudioFile(
        file,
        language,
        stageType,
        referenceText,
        metadata
      );
      notify.success(
        `Added "${referenceText}" for ${language} (${stageType}) successfully!`
      );
      await refetch();
      return created;
    } catch (err: any) {
      notify.error(err.message || "Failed to create stage audio.");
      throw err;
    }
  };

  const handleUpdate = async (
    id: string,
    updates: {
      referenceText: string;
      announcementText: string;
      file?: File | null;
      language?: string;
      stageType?: StageType;
      voice?: string;
      speed?: string;
    },
    existingAudio?: IStageAudio
  ): Promise<IStageAudio> => {
    try {
      const updated = await updateStageAudio(id, updates, existingAudio);
      notify.success(`Updated stage audio announcement successfully!`);
      await refetch();
      return updated;
    } catch (err: any) {
      notify.error(err.message || "Failed to update stage audio.");
      throw err;
    }
  };

  const handleDelete = async (audio: IStageAudio): Promise<void> => {
    try {
      if (playingAudioUrl === audio.url) {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        setPlayingAudioUrl(null);
      }
      await deleteStageAudio(audio.id, audio.storage_path);
      notify.success(
        `Deleted stage audio for ${audio.language} (${audio.stage_type}).`
      );
      await refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete stage audio.");
      throw err;
    }
  };

  return {
    stageAudios,
    matrixRows,
    totalSlots,
    configuredCount,
    coveragePercent,
    isLoading,
    isError,
    error,
    refetch,
    playingAudioUrl,
    togglePlayAudio,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}

export default useStageAudios;

