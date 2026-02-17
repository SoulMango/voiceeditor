import api from './client';
import type { TranscriptionResult } from '../types/editor';

export async function startTranscription(audioId: string, language?: string, modelSize = 'base'): Promise<{ task_id: string }> {
  const { data } = await api.post('/transcription/start', {
    audio_id: audioId,
    language,
    model_size: modelSize,
  });
  return data;
}

export async function fetchTranscription(audioId: string): Promise<TranscriptionResult> {
  const { data } = await api.get(`/transcription/${audioId}`);
  return data;
}

export async function updateTranscriptionSegment(
  audioId: string,
  segmentIndex: number,
  text: string,
): Promise<TranscriptionResult> {
  const { data } = await api.put(`/transcription/${audioId}`, {
    segment_index: segmentIndex,
    text,
  });
  return data;
}
