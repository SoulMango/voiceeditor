import { create } from 'zustand';
import type { Segment, TranscriptionResult } from '../types/editor';

interface EditorStore {
  segments: Segment[];
  transcript: TranscriptionResult | null;
  activeStem: string;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  playbackRate: number;
  selectedRegion: { start: number; end: number } | null;

  setSegments: (segments: Segment[]) => void;
  addSegment: (segment: Segment) => void;
  removeSegment: (id: string) => void;
  reorderSegments: (ids: string[]) => void;
  setTranscript: (transcript: TranscriptionResult | null) => void;
  setActiveStem: (stem: string) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setSelectedRegion: (region: { start: number; end: number } | null) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  segments: [],
  transcript: null,
  activeStem: 'original',
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  playbackRate: 1,
  selectedRegion: null,

  setSegments: (segments) => set({ segments }),
  addSegment: (segment) => set((state) => ({ segments: [...state.segments, segment] })),
  removeSegment: (id) => set((state) => ({ segments: state.segments.filter((s) => s.id !== id) })),
  reorderSegments: (ids) =>
    set((state) => {
      const segmentMap = new Map(state.segments.map((s) => [s.id, s]));
      const reordered = ids.map((id, i) => ({ ...segmentMap.get(id)!, sort_order: i }));
      return { segments: reordered };
    }),
  setTranscript: (transcript) => set({ transcript }),
  setActiveStem: (activeStem) => set({ activeStem }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
  reset: () =>
    set({
      segments: [],
      transcript: null,
      activeStem: 'original',
      currentTime: 0,
      isPlaying: false,
      duration: 0,
      playbackRate: 1,
      selectedRegion: null,
    }),
}));
