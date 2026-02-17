import api from './client';
import type { TaskStatus } from '../types/editor';

export async function importFromYoutube(url: string, projectId: string): Promise<{ task_id: string }> {
  const { data } = await api.post('/audio/youtube', { url, project_id: projectId });
  return data;
}

export async function uploadAudio(projectId: string, file: File): Promise<{ audio_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);
  const { data } = await api.post('/audio/upload', formData);
  return data;
}

export async function startRecording(projectId: string, deviceName = 'BlackHole 16ch'): Promise<{ recording_id: string }> {
  const { data } = await api.post('/audio/record/start', { project_id: projectId, device_name: deviceName });
  return data;
}

export async function stopRecording(recordingId: string): Promise<{ audio_id: string }> {
  const { data } = await api.post('/audio/record/stop', { recording_id: recordingId });
  return data;
}

export async function fetchWaveform(audioId: string): Promise<number[]> {
  const { data } = await api.get(`/audio/${audioId}/waveform`);
  return data;
}

export function getAudioFileUrl(audioId: string): string {
  return `/api/audio/${audioId}/file`;
}

export async function fetchTaskStatus(taskId: string): Promise<TaskStatus> {
  const { data } = await api.get(`/tasks/${taskId}`);
  return data;
}
