import { useState, useMemo, useRef, useCallback } from "react";
import { stopCrud } from "../api/stopCrud";
import {
  generateStopAudio,
  deleteStopCascade,
  deleteAudioFileAndRecord,
  generateBulkStopAudio,
  deleteAllStopsForDepot,
  exportStopsToCSV,
  importStopsFromCSV,
} from "../services/stopService";
import { sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IStop, IStopWithAudio, IStopCreate, IStopUpdate } from "@/shared/types/stop";

export function useStops(depotId?: string, organizationId?: string) {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [generatingStopId, setGeneratingStopId] = useState<string | null>(null);

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

  const handleCreate = async (payload: IStopCreate, voice: string = "meera") => {
    try {
      const created = await createStopMutation.mutateAsync(payload);
      notify.success("Stop created successfully");

      // Auto-generate audio for new stop
      if (created?.id && created?.name) {
        try {
          await generateStopAudio(created.name, created.id, "en-IN", voice);
          notify.success(`Audio generated for "${created.name}"`);
        } catch (audioErr: any) {
          notify.warning(`Stop created, but audio generation failed: ${audioErr.message}`);
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
    nameChanged: boolean = false,
    existingAudio?: { id?: string; url?: string },
    voice: string = "meera"
  ) => {
    try {
      const updated = await updateStopMutation.mutateAsync({ id, payload });
      notify.success("Stop updated successfully");

      // If stop name was updated, regenerate audio to match new name
      if (nameChanged && payload.name) {
        if (existingAudio?.url) {
          try {
            await deleteAudioFileAndRecord(existingAudio.url, id, existingAudio.id);
          } catch (delErr) {
            console.warn("Could not delete old audio file:", delErr);
          }
        }

        try {
          await generateStopAudio(payload.name, id, "en-IN", voice);
          notify.success(`Audio re-generated for "${payload.name}"`);
        } catch (genErr: any) {
          notify.warning(`Stop updated, but audio regeneration failed: ${genErr.message}`);
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

  const handleGenerateAudio = async (stop: IStop, voice: string = "meera") => {
    if (!stop.id || !stop.name) return;
    try {
      setGeneratingStopId(stop.id);
      notify.info(`Generating audio for "${stop.name}"...`);
      await generateStopAudio(stop.name, stop.id, "en-IN", voice);
      notify.success(`Audio generated for "${stop.name}"`);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Audio generation failed");
      throw err;
    } finally {
      setGeneratingStopId(null);
    }
  };

  const handleGenerateAll = async () => {
    const target = filteredStops.filter((s) => {
      const hasAud = Array.isArray(s.stop_audios) ? s.stop_audios.length > 0 : Boolean(s.stop_audios?.url);
      return !hasAud;
    });

    const listToRun = target.length > 0 ? target : filteredStops;
    if (listToRun.length === 0) {
      notify.info("No stops available to generate audio.");
      return;
    }

    try {
      setIsGeneratingAll(true);
      const res = await generateBulkStopAudio(listToRun, (current, total) => {
        setGenProgress({ current, total });
      });
      notify.success(`Generated audio for ${res.successCount} of ${res.total} stops.`);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Bulk audio generation failed");
    } finally {
      setIsGeneratingAll(false);
      setGenProgress(null);
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
    playAudio,
    stopAudio,
    generatingStopId,
    isGeneratingAll,
    genProgress,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleGenerateAudio,
    handleGenerateAll,
    handleDeleteAll,
    handleExportCSV,
    handleImportCSV,
    refetch,
  };
}

