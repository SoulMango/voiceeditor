export interface WordTimestamp {
  start: number;
  end: number;
  word: string;
  probability: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

export interface TranscriptionResult {
  audio_id: string;
  language: string;
  segments: TranscriptSegment[];
}

export interface Segment {
  id: string;
  project_id: string;
  audio_id: string;
  start_time: number;
  end_time: number;
  label: string;
  sort_order: number;
  created_at: string;
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}
