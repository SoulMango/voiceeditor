import { useCallback, useState, useEffect } from 'react';
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Trash2, GripVertical, Download, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { exportSegments } from '../../api/editor';
import { useTaskPolling } from '../../hooks/useTaskPolling';
import type { Segment } from '../../types/editor';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function SortableSegmentCard({
  segment,
  onPlay,
  onDelete,
}: {
  segment: Segment;
  onPlay: (start: number, end: number) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg p-3 flex items-center gap-2"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
        </p>
        {segment.label && (
          <p className="text-sm truncate mt-0.5">{segment.label}</p>
        )}
      </div>
      <button
        onClick={() => onPlay(segment.start_time, segment.end_time)}
        className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onDelete(segment.id)}
        className="p-1 rounded hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-text-secondary)]"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SegmentTimeline({
  onPlay,
  onDelete,
  onReorder,
  projectId,
  audioId,
}: {
  onPlay: (start: number, end: number) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  projectId: string;
  audioId: string;
}) {
  const { segments, activeStem } = useEditorStore();
  const sorted = [...segments].sort((a, b) => a.sort_order - b.sort_order);
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const exportTask = useTaskPolling(exportTaskId);

  // Require 5px drag distance before activating — prevents click hijack on buttons
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = sorted.map((s) => s.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      const newIds = [...ids];
      newIds.splice(oldIndex, 1);
      newIds.splice(newIndex, 0, active.id as string);
      onReorder(newIds);
    },
    [sorted, onReorder],
  );

  const handleExport = async () => {
    try {
      const { task_id } = await exportSegments(projectId, audioId, 'wav', activeStem);
      setExportTaskId(task_id);
    } catch (e) {
      alert(`Export failed: ${e}`);
    }
  };

  // Handle export task completion
  useEffect(() => {
    if (exportTask?.status === 'completed' && exportTaskId) {
      const taskId = exportTaskId;
      setExportTaskId(null);
      // Trigger download
      const link = document.createElement('a');
      link.href = `/api/editor/${projectId}/export/${taskId}`;
      link.download = 'export.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportTask?.status === 'failed' && exportTaskId) {
      setExportTaskId(null);
      alert(`Export failed: ${exportTask.error ?? 'Unknown error'}`);
    }
  }, [exportTask?.status]);

  const isExporting = !!exportTaskId;

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Segments ({sorted.length})
        </h3>
        {sorted.length > 0 && (
          isExporting ? (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Loader2 className="w-3 h-3 animate-spin" /> Exporting...
            </span>
          ) : (
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
          )
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Select a region on the waveform and click "Cut Selection" to create segments.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sorted.map((seg) => (
                <SortableSegmentCard key={seg.id} segment={seg} onPlay={onPlay} onDelete={onDelete} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
