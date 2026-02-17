import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { importFromYoutube } from '../../api/audio';
import { useTaskPolling } from '../../hooks/useTaskPolling';

export default function YouTubeImport({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [url, setUrl] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const task = useTaskPolling(taskId);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setError('');
    try {
      const { task_id } = await importFromYoutube(url.trim(), projectId);
      setTaskId(task_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start extraction');
    }
  };

  useEffect(() => {
    if (task?.status === 'completed') {
      setTaskId(null);
      setUrl('');
      onImported();
    }
  }, [task?.status, onImported]);

  const isProcessing = task?.status === 'pending' || task?.status === 'running';

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isProcessing}
          className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !url.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Extract
        </button>
      </div>

      {isProcessing && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
            <span>Extracting audio...</span>
            <span>{Math.round((task?.progress ?? 0) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${(task?.progress ?? 0) * 100}%` }}
            />
          </div>
        </div>
      )}

      {task?.status === 'failed' && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{task.error}</p>
      )}
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
