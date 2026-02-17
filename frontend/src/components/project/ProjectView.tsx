import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music, Clock, Mic, FileAudio, Scissors } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import ImportPanel from '../import/ImportPanel';
import type { AudioFile } from '../../types/project';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AudioFileCard({ audio, projectId }: { audio: AudioFile; projectId: string }) {
  const navigate = useNavigate();

  const sourceIcon = {
    youtube: <Music className="w-4 h-4 text-red-400" />,
    recording: <Mic className="w-4 h-4 text-green-400" />,
    upload: <FileAudio className="w-4 h-4 text-blue-400" />,
  }[audio.source_type ?? 'upload'] ?? <FileAudio className="w-4 h-4 text-blue-400" />;

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 flex items-center gap-4">
      <div className="p-2 rounded-lg bg-[var(--color-bg-tertiary)]">{sourceIcon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{audio.original_name ?? audio.filename}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(audio.duration)}
          </span>
          <span>{audio.source_type}</span>
          {audio.has_transcript && <span className="text-[var(--color-success)]">STT</span>}
          {audio.has_separation && <span className="text-[var(--color-warning)]">Separated</span>}
        </div>
      </div>
      <button
        onClick={() => navigate(`/editor/${projectId}/${audio.id}`)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]"
      >
        <Scissors className="w-3.5 h-3.5" />
        Edit
      </button>
    </div>
  );
}

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, fetchProject } = useProjectStore();

  useEffect(() => {
    if (projectId) fetchProject(projectId);
  }, [projectId, fetchProject]);

  if (!currentProject) {
    return <div className="text-[var(--color-text-secondary)]">Loading...</div>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-1">{currentProject.name}</h2>
      {currentProject.description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{currentProject.description}</p>
      )}

      <ImportPanel projectId={currentProject.id} onImported={() => fetchProject(currentProject.id)} />

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-3">Audio Files</h3>
        {currentProject.audio_files.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No audio files yet. Import from YouTube, upload a file, or record system audio.
          </p>
        ) : (
          <div className="space-y-3">
            {currentProject.audio_files.map((audio) => (
              <AudioFileCard key={audio.id} audio={audio} projectId={currentProject.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
