import { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
import { startRecording, stopRecording } from '../../api/audio';

export default function SystemRecorder({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recordingIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStart = async () => {
    setError('');
    try {
      const { recording_id } = await startRecording(projectId);
      recordingIdRef.current = recording_id;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  };

  const handleStop = async () => {
    if (!recordingIdRef.current) return;
    if (timerRef.current !== null) clearInterval(timerRef.current);
    try {
      await stopRecording(recordingIdRef.current);
      recordingIdRef.current = null;
      setRecording(false);
      onImported();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to stop recording');
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        {recording ? (
          <>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-danger)] text-white rounded hover:opacity-90"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--color-danger)] rounded-full animate-pulse" />
              <span className="text-sm font-mono">{formatElapsed(elapsed)}</span>
            </div>
          </>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
        Records system audio via BlackHole. Make sure you have a Multi-Output Device set up in Audio MIDI Setup that includes both your speakers and BlackHole.
      </p>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
