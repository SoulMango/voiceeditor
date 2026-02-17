import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

export default function Sidebar() {
  const { projects, fetchProjects, createProject, deleteProject } = useProjectStore();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const project = await createProject(newName.trim());
    setNewName('');
    setShowNew(false);
    navigate(`/projects/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    await deleteProject(id);
    if (projectId === id) navigate('/');
  };

  return (
    <aside className="w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col shrink-0">
      <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Projects</span>
        <button
          onClick={() => setShowNew(!showNew)}
          className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showNew && (
        <div className="p-3 border-b border-[var(--color-border)]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Project name..."
            autoFocus
            className="w-full px-2 py-1.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNew(false); setNewName(''); }}
              className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[var(--color-bg-tertiary)] group ${
              projectId === project.id ? 'bg-[var(--color-bg-tertiary)]' : ''
            }`}
          >
            <FolderOpen className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
            <span className="text-sm truncate flex-1">{project.name}</span>
            <button
              onClick={(e) => handleDelete(e, project.id)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-text-secondary)]"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
