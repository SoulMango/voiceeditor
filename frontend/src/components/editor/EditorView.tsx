import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Scissors, Loader2, Download } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.js';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { getAudioFileUrl } from '../../api/audio';
import { startTranscription, fetchTranscription } from '../../api/transcription';
import { startSeparation, fetchSeparation, getStemFileUrl } from '../../api/separation';
import { fetchSegments, createSegment, deleteSegment, reorderSegments as apiReorderSegments } from '../../api/editor';
import { useTaskPolling } from '../../hooks/useTaskPolling';
import TranscriptPanel from './TranscriptPanel';
import SegmentTimeline from './SegmentTimeline';
import type { AudioFile } from '../../types/project';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export default function EditorView() {
  const { projectId, audioId } = useParams<{ projectId: string; audioId: string }>();
  const navigate = useNavigate();
  const { currentProject, fetchProject } = useProjectStore();
  const store = useEditorStore();

  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);

  const [audio, setAudio] = useState<AudioFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sttTaskId, setSttTaskId] = useState<string | null>(null);
  const [sepTaskId, setSepTaskId] = useState<string | null>(null);
  const [stems, setStems] = useState<string[]>([]);

  const sttTask = useTaskPolling(sttTaskId);
  const sepTask = useTaskPolling(sepTaskId);

  // Load project & audio info
  useEffect(() => {
    if (projectId && !currentProject) fetchProject(projectId);
  }, [projectId, currentProject, fetchProject]);

  useEffect(() => {
    if (currentProject && audioId) {
      const found = currentProject.audio_files.find((a) => a.id === audioId);
      setAudio(found ?? null);
    }
  }, [currentProject, audioId]);

  // Initialize wavesurfer
  useEffect(() => {
    if (!waveformRef.current || !audioId) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const audioUrl = store.activeStem === 'original'
      ? getAudioFileUrl(audioId)
      : getStemFileUrl(audioId, store.activeStem);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4a90d9',
      progressColor: '#1a5276',
      cursorColor: '#f59e0b',
      cursorWidth: 2,
      height: 150,
      url: audioUrl,
      plugins: [regions],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      store.setDuration(ws.getDuration());
      setLoading(false);
    });

    ws.on('timeupdate', (time) => {
      store.setCurrentTime(time);
    });

    ws.on('play', () => store.setIsPlaying(true));
    ws.on('pause', () => store.setIsPlaying(false));

    // Enable drag-to-select region
    regions.enableDragSelection({ color: 'rgba(59, 130, 246, 0.3)' });

    regions.on('region-created', (region: Region) => {
      // Remove other regions to keep only one selection at a time
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id) r.remove();
      });
      store.setSelectedRegion({ start: region.start, end: region.end });
    });

    regions.on('region-updated', (region: Region) => {
      store.setSelectedRegion({ start: region.start, end: region.end });
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
      store.reset();
    };
  }, [audioId, store.activeStem]);

  // Load segments
  useEffect(() => {
    if (!projectId) return;
    fetchSegments(projectId).then((segs) => store.setSegments(segs));
  }, [projectId]);

  // Load transcript if available
  useEffect(() => {
    if (!audioId || !audio?.has_transcript) return;
    fetchTranscription(audioId).then((t) => store.setTranscript(t));
  }, [audioId, audio?.has_transcript]);

  // Load stems if available
  useEffect(() => {
    if (!audioId || !audio?.has_separation) return;
    fetchSeparation(audioId).then((s) => setStems(s.stems));
  }, [audioId, audio?.has_separation]);

  // Handle STT task completion/failure
  useEffect(() => {
    if (sttTask?.status === 'completed' && audioId) {
      setSttTaskId(null);
      fetchTranscription(audioId).then((t) => store.setTranscript(t));
      if (projectId) fetchProject(projectId);
    } else if (sttTask?.status === 'failed') {
      setSttTaskId(null);
      alert(`STT failed: ${sttTask.error ?? 'Unknown error'}`);
    }
  }, [sttTask?.status]);

  // Handle separation task completion/failure
  useEffect(() => {
    if (sepTask?.status === 'completed' && audioId) {
      setSepTaskId(null);
      fetchSeparation(audioId).then((s) => setStems(s.stems));
      if (projectId) fetchProject(projectId);
    } else if (sepTask?.status === 'failed') {
      setSepTaskId(null);
      alert(`Separation failed: ${sepTask.error ?? 'Unknown error'}`);
    }
  }, [sepTask?.status]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const skip = useCallback((delta: number) => {
    if (!wsRef.current) return;
    const newTime = Math.max(0, Math.min(store.currentTime + delta, store.duration));
    wsRef.current.seekTo(newTime / store.duration);
  }, [store.currentTime, store.duration]);

  const seekTo = useCallback((time: number) => {
    if (!wsRef.current || store.duration === 0) return;
    wsRef.current.seekTo(time / store.duration);
  }, [store.duration]);

  const handleCut = useCallback(async () => {
    if (!store.selectedRegion || !projectId || !audioId) return;
    const { start, end } = store.selectedRegion;
    const words = store.transcript?.segments
      .flatMap((s) => s.words)
      .filter((w) => w.start >= start && w.end <= end)
      .map((w) => w.word)
      .join(' ') ?? '';
    const segment = await createSegment(projectId, audioId, start, end, words);
    store.addSegment(segment);
    store.setSelectedRegion(null);
    regionsRef.current?.getRegions().forEach((r) => r.remove());
  }, [store.selectedRegion, projectId, audioId, store.transcript]);

  const handleDeleteSegment = useCallback(async (segId: string) => {
    if (!projectId) return;
    await deleteSegment(projectId, segId);
    store.removeSegment(segId);
  }, [projectId]);

  const handleReorder = useCallback(async (ids: string[]) => {
    if (!projectId) return;
    store.reorderSegments(ids);
    await apiReorderSegments(projectId, ids);
  }, [projectId]);

  const handleStartSTT = async () => {
    if (!audioId) return;
    const { task_id } = await startTranscription(audioId);
    setSttTaskId(task_id);
  };

  const handleStartSeparation = async () => {
    if (!audioId) return;
    const { task_id } = await startSeparation(audioId);
    setSepTaskId(task_id);
  };

  const playSegment = useCallback((start: number, end: number) => {
    if (!wsRef.current || store.duration === 0) return;
    wsRef.current.seekTo(start / store.duration);
    wsRef.current.play();
    const checkEnd = () => {
      if (wsRef.current && wsRef.current.getCurrentTime() >= end) {
        wsRef.current.pause();
        wsRef.current.un('timeupdate', checkEnd);
      }
    };
    wsRef.current.on('timeupdate', checkEnd);
  }, [store.duration]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold truncate flex-1">{audio?.original_name ?? audio?.filename ?? 'Loading...'}</h2>

        {/* Stem selector */}
        {stems.length > 0 && (
          <select
            value={store.activeStem}
            onChange={(e) => store.setActiveStem(e.target.value)}
            className="px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)]"
          >
            <option value="original">Original</option>
            {stems.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        )}

        {/* Action buttons */}
        {!audio?.has_transcript && !sttTaskId && (
          <button onClick={handleStartSTT} className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]">
            Generate STT
          </button>
        )}
        {sttTaskId && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Transcribing...
          </span>
        )}
        {!audio?.has_separation && !sepTaskId && (
          <button onClick={handleStartSeparation} className="px-3 py-1.5 text-xs bg-[var(--color-warning)] text-black rounded hover:opacity-90">
            Remove Background
          </button>
        )}
        {sepTaskId && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Separating...
          </span>
        )}

        {/* Download buttons */}
        <div className="flex items-center gap-1 ml-2 border-l border-[var(--color-border)] pl-2">
          <a
            href={`/api/audio/${audioId}/file`}
            download
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded hover:bg-[var(--color-border)]"
          >
            <Download className="w-3 h-3" />
            Audio
          </a>
          {audio?.has_transcript && (
            <>
              <a
                href={`/api/transcription/${audioId}/download?format=txt`}
                download
                className="flex items-center gap-1 px-2 py-1.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded hover:bg-[var(--color-border)]"
              >
                <Download className="w-3 h-3" />
                TXT
              </a>
              <a
                href={`/api/transcription/${audioId}/download?format=srt`}
                download
                className="flex items-center gap-1 px-2 py-1.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded hover:bg-[var(--color-border)]"
              >
                <Download className="w-3 h-3" />
                SRT
              </a>
            </>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
        <div ref={waveformRef} className="w-full" />
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => skip(-5)} className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
          <SkipBack className="w-5 h-5" />
        </button>
        <button onClick={togglePlay} className="p-3 rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]">
          {store.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button onClick={() => skip(5)} className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
          <SkipForward className="w-5 h-5" />
        </button>
        <span className="text-sm font-mono text-[var(--color-text-secondary)] ml-4">
          {formatTime(store.currentTime)} / {formatTime(store.duration)}
        </span>

        {store.selectedRegion && (
          <button
            onClick={handleCut}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-4 text-sm bg-[var(--color-success)] text-white rounded hover:opacity-90"
          >
            <Scissors className="w-4 h-4" />
            Cut Selection
          </button>
        )}
      </div>

      {/* Transcript + Segments */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          <TranscriptPanel onSeek={seekTo} audioId={audioId!} />
        </div>
        <div className="w-80 shrink-0 overflow-y-auto">
          <SegmentTimeline
            onPlay={playSegment}
            onDelete={handleDeleteSegment}
            onReorder={handleReorder}
            projectId={projectId!}
          />
        </div>
      </div>
    </div>
  );
}
