import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { uploadAudio } from '../../api/audio';

export default function FileUpload({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      await uploadAudio(projectId, file);
      onImported();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, onImported]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-text-secondary)]'
        }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 mx-auto text-[var(--color-accent)] animate-spin" />
        ) : (
          <Upload className="w-8 h-8 mx-auto text-[var(--color-text-secondary)]" />
        )}
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {uploading ? 'Uploading...' : 'Drop audio file here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">WAV, MP3, FLAC, M4A, OGG</p>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
