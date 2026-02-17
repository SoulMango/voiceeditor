import { AudioWaveform } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center px-4 shrink-0">
      <AudioWaveform className="w-6 h-6 text-[var(--color-accent)] mr-2" />
      <h1 className="text-lg font-bold">Voice Editor</h1>
    </header>
  );
}
