import { useState } from 'react';
import { Youtube, Upload, Mic } from 'lucide-react';
import YouTubeImport from './YouTubeImport';
import FileUpload from './FileUpload';
import SystemRecorder from './SystemRecorder';

type Tab = 'youtube' | 'upload' | 'record';

export default function ImportPanel({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('youtube');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
    { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'record', label: 'System Record', icon: <Mic className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="flex border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {activeTab === 'youtube' && <YouTubeImport projectId={projectId} onImported={onImported} />}
        {activeTab === 'upload' && <FileUpload projectId={projectId} onImported={onImported} />}
        {activeTab === 'record' && <SystemRecorder projectId={projectId} onImported={onImported} />}
      </div>
    </div>
  );
}
