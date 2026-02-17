import api from './client';

export async function startSeparation(audioId: string, model = 'htdemucs'): Promise<{ task_id: string }> {
  const { data } = await api.post('/separation/start', { audio_id: audioId, model });
  return data;
}

export async function fetchSeparation(audioId: string): Promise<{ audio_id: string; stems: string[] }> {
  const { data } = await api.get(`/separation/${audioId}`);
  return data;
}

export function getStemFileUrl(audioId: string, stem: string): string {
  return `/api/separation/${audioId}/${stem}`;
}
