import { useState, useMemo, useRef, useCallback } from "react";
import { stopCrud } from "../api/stopCrud";
import {
  deleteStopCascade,
  deleteAudioFileAndRecord,
  deleteAllStopsForDepot,
  deleteSelectedStops,
  exportStopsToCSV,
  importStopsFromCSV,
  uploadStopAudio,
} from "../services/stopService";
import {
  generateAndUploadStopAudio,
  type SynthesizeOptions,
} from "../services/edgeTtsService";
import { sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IStopWithAudio, IStopCreate, IStopUpdate } from "@/shared/types/stop";

export function useStops(depotId?: string, organizationId?: string) {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const [generatingStopId, setGeneratingStopId] = useState<string | null>(null);
  const isGeneratingAll = false;
  const genProgress = null;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazy audio element init
  const getAudioElement = useCallback(() => {
    if (!audioRef.current && typeof window !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingAudioUrl(null);
      audioRef.current.onerror = () => setPlayingAudioUrl(null);
    }
    return audioRef.current;
  }, []);

  const { useList, useCreate, useUpdate } = stopCrud;

  const {
    data: stopsData,
    isLoading,
    isError,
    refetch,
  } = useList({
    filters: {
      depot_id: depotId || "",
      organization_id: organizationId || "",
    },
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
    skip: !depotId || !organizationId,
  });

  const stops = useMemo(() => {
    const list = (stopsData?.data as IStopWithAudio[]) || [];
    return sortByLatestCreated(list);
  }, [stopsData]);

  const filteredStops = useMemo(() => {
    if (!searchTerm.trim()) return stops;
    const term = searchTerm.toLowerCase();
    return stops.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        (s as any).name_kn?.toLowerCase().includes(term)
    );
  }, [stops, searchTerm]);

  const playAudio = useCallback(
    (url: string) => {
      const audio = getAudioElement();
      if (!audio || !url) return;

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
          console.warn("Audio playback prevented or failed:", err);
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
      audio.load();
    }
    setPlayingAudioUrl(null);
  }, [getAudioElement]);

  const createStopMutation = useCreate();
  const updateStopMutation = useUpdate();

  const handleCreate = async (payload: IStopCreate, audioFile?: File | null) => {
    try {
      const created = await createStopMutation.mutateAsync(payload);
      notify.success("Stop created successfully");

      // If user uploaded an audio file during creation
      if (created?.id && audioFile) {
        try {
          await uploadStopAudio(audioFile, created.id);
          notify.success(`Audio uploaded for "${created.name}"`);
        } catch (audioErr: any) {
          notify.warning(`Stop created, but audio upload failed: ${audioErr.message}`);
        }
      }

      refetch();
      return created;
    } catch (err: any) {
      notify.error(err.message || "Failed to create stop");
      throw err;
    }
  };

  const handleUpdate = async (
    id: string,
    payload: IStopUpdate,
    newAudioFile?: File | null,
    deleteExistingAudio?: boolean,
    existingAudio?: { id?: string; url?: string }
  ) => {
    try {
      const updated = await updateStopMutation.mutateAsync({ id, payload });
      notify.success("Stop updated successfully");

      // If existing audio should be removed
      if (deleteExistingAudio && existingAudio?.url) {
        try {
          await deleteAudioFileAndRecord(existingAudio.url, id, existingAudio.id);
          notify.info("Previous audio removed");
        } catch (delErr: any) {
          console.warn("Could not delete existing audio file:", delErr);
        }
      }

      // If user provided a new audio file to upload
      if (newAudioFile) {
        if (existingAudio?.url && !deleteExistingAudio) {
          try {
            await deleteAudioFileAndRecord(existingAudio.url, id, existingAudio.id);
          } catch (delErr: any) {
            console.warn("Could not remove previous audio before replacing:", delErr);
          }
        }

        try {
          await uploadStopAudio(newAudioFile, id);
          notify.success("Audio file uploaded successfully");
        } catch (uploadErr: any) {
          notify.warning(`Stop updated, but audio upload failed: ${uploadErr.message}`);
        }
      }

      refetch();
      return updated;
    } catch (err: any) {
      notify.error(err.message || "Failed to update stop");
      throw err;
    }
  };

  const handleDelete = async (stop: IStopWithAudio) => {
    try {
      stopAudio();
      const firstAudio = Array.isArray(stop.stop_audios) ? stop.stop_audios[0] : stop.stop_audios;
      await deleteStopCascade(stop.id, firstAudio?.url, firstAudio?.id);
      notify.success("Stop deleted successfully");
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete stop");
      throw err;
    }
  };

  const handleUploadAudio = async (stop: IStopWithAudio, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isMp3 = ext === "mp3" || file.type.includes("mpeg") || file.type.includes("mp3");
    const isWav = ext === "wav" || file.type.includes("wav") || file.type.includes("wave");

    if (!isMp3 && !isWav) {
      notify.error("Only .mp3 and .wav audio files are allowed.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      notify.error("Audio file size must be less than 20MB.");
      return;
    }

    try {
      setUploadingStopId(stop.id);
      stopAudio();

      const existing = Array.isArray(stop.stop_audios) ? stop.stop_audios[0] : stop.stop_audios;
      if (existing?.url) {
        try {
          await deleteAudioFileAndRecord(existing.url, stop.id, existing.id);
        } catch (delErr) {
          console.warn("Could not delete previous audio before uploading new:", delErr);
        }
      }

      await uploadStopAudio(file, stop.id);
      notify.success(`Audio uploaded successfully for "${stop.name}"`);
      await refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to upload audio file");
      throw err;
    } finally {
      setUploadingStopId(null);
    }
  };

  const handleDeleteAudio = async (stop: IStopWithAudio) => {
    const firstAudio = Array.isArray(stop.stop_audios) ? stop.stop_audios[0] : stop.stop_audios;
    if (!firstAudio?.url) return;
    try {
      stopAudio();
      await deleteAudioFileAndRecord(firstAudio.url, stop.id, firstAudio.id);
      notify.success(`Audio removed for "${stop.name}"`);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to remove audio");
      throw err;
    }
  };

  const handleGenerateAudio = async (
    stop: IStopWithAudio,
    options?: SynthesizeOptions
  ) => {
    try {
      setGeneratingStopId(stop.id);
      notify.info(`Generating announcement for "${stop.name}" using Edge-TTS...`);
      const result = await generateAndUploadStopAudio(stop.name, stop.id, options);
      notify.success(`Audio generated and attached for "${stop.name}"`);
      await refetch();
      if (result.fileUrl) {
        playAudio(result.fileUrl);
      }
    } catch (err: any) {
      notify.error(err.message || "Failed to generate audio announcement");
    } finally {
      setGeneratingStopId(null);
    }
  };

  const handleGenerateAll = async () => {
    // Placeholder as requested by user
    notify.info("On-demand audio generation is coming soon. Please upload audio files directly.");
  };

  const handleDeleteSelected = async (stopIds: string[]) => {
    if (!stopIds.length) return;
    try {
      stopAudio();
      await deleteSelectedStops(stopIds, stops);
      notify.success(`${stopIds.length} stop(s) deleted successfully`);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete selected stops");
      throw err;
    }
  };

  const handleDeleteAll = async () => {
    if (!depotId) return;
    try {
      stopAudio();
      await deleteAllStopsForDepot(depotId);
      notify.success("All stops deleted successfully for depot");
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete all stops");
      throw err;
    }
  };

  const handleExportCSV = () => {
    return exportStopsToCSV(filteredStops);
  };

  const handleImportCSV = async (csvText: string) => {
    if (!depotId || !organizationId) throw new Error("Depot and Organization required");
    const count = await importStopsFromCSV(csvText, depotId, organizationId);
    notify.success(`Imported ${count} stops successfully`);
    refetch();
    return count;
  };

  return {
    stops,
    filteredStops,
    isLoading,
    isError,
    searchTerm,
    setSearchTerm,
    playingAudioUrl,
    uploadingStopId,
    playAudio,
    stopAudio,
    generatingStopId,
    isGeneratingAll,
    genProgress,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleDeleteAudio,
    handleUploadAudio,
    handleDeleteSelected,
    handleGenerateAudio,
    handleGenerateAll,
    handleDeleteAll,
    handleExportCSV,
    handleImportCSV,
    refetch,
  };
}

