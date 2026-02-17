import { useRef, useEffect, useState, useCallback } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { updateTranscriptionSegment } from '../../api/transcription';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SegmentRow({
  segment,
  segmentIndex,
  isActive,
  audioId,
  onSeek,
  activeRef,
}: {
  segment: { start: number; end: number; text: string; words: { start: number; end: number; word: string; probability: number }[] };
  segmentIndex: number;
  isActive: boolean;
  audioId: string;
  onSeek: (time: number) => void;
  activeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(segment.text);
  const [saving, setSaving] = useState(false);
  const setTranscript = useEditorStore((s) => s.setTranscript);
  const currentTime = useEditorStore((s) => s.currentTime);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    if (editText === segment.text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTranscriptionSegment(audioId, segmentIndex, editText);
      setTranscript(updated);
      setEditing(false);
    } catch {
      // revert on failure
      setEditText(segment.text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [editText, segment.text, audioId, segmentIndex, setTranscript]);

  const handleCancel = () => {
    setEditText(segment.text);
    setEditing(false);
  };

  return (
    <div
      ref={isActive ? activeRef : undefined}
      className={`flex gap-3 p-2.5 rounded-lg transition-colors group ${
        isActive
          ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30'
          : 'hover:bg-[var(--color-bg-primary)] border border-transparent'
      }`}
    >
      {/* Timestamp column */}
      <button
        onClick={() => onSeek(segment.start)}
        className="shrink-0 w-20 text-left"
      >
        <span className={`text-xs font-mono ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>
          {formatTime(segment.start)}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)] block font-mono">
          {formatTime(segment.end)}
        </span>
      </button>

      {/* Text column */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') handleCancel();
              }}
              rows={Math.max(2, editText.split('\n').length)}
              className="w-full px-2 py-1.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded text-[var(--color-text-primary)] resize-none focus:outline-none"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--color-success)] text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded hover:text-[var(--color-text-primary)]"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <p className="text-sm leading-relaxed flex-1">
              {/* If text was manually edited (differs from words), show plain text */}
              {segment.text !== segment.words.map((w) => w.word).join(' ') ? (
                <span
                  onClick={() => onSeek(segment.start)}
                  className="cursor-pointer hover:bg-[var(--color-bg-tertiary)] px-0.5 rounded"
                >
                  {segment.text}
                </span>
              ) : (
                segment.words.map((word, wi) => {
                  const wordActive = currentTime >= word.start && currentTime < word.end;
                  return (
                    <span
                      key={wi}
                      onClick={() => onSeek(word.start)}
                      className={`cursor-pointer px-0.5 rounded transition-colors ${
                        wordActive
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {word.word}{' '}
                    </span>
                  );
                })
              )}
            </p>
            <button
              onClick={() => { setEditText(segment.text); setEditing(true); }}
              className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TranscriptPanel({ onSeek, audioId }: { onSeek: (time: number) => void; audioId: string }) {
  const { transcript, currentTime } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;

      if (elTop < viewTop || elBottom > viewBottom) {
        container.scrollTo({ top: elTop - container.clientHeight / 3, behavior: 'smooth' });
      }
    }
  }, [currentTime]);

  if (!transcript) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 h-full">
        <p className="text-sm text-[var(--color-text-secondary)]">
          No transcript available. Click "Generate STT" to create one.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 h-full overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Transcript
        </h3>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {transcript.language} / {transcript.segments.length} segments
        </span>
      </div>

      <div className="space-y-1">
        {transcript.segments.map((segment, i) => {
          const isActive = currentTime >= segment.start && currentTime < segment.end;
          return (
            <SegmentRow
              key={i}
              segment={segment}
              segmentIndex={i}
              isActive={isActive}
              audioId={audioId}
              onSeek={onSeek}
              activeRef={activeRef}
            />
          );
        })}
      </div>
    </div>
  );
}
