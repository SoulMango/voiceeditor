import api from './client';
import type { Segment } from '../types/editor';

export async function fetchSegments(projectId: string): Promise<Segment[]> {
  const { data } = await api.get(`/editor/${projectId}/segments`);
  return data;
}

export async function createSegment(projectId: string, audioId: string, startTime: number, endTime: number, label = ''): Promise<Segment> {
  const { data } = await api.post(`/editor/${projectId}/segments`, {
    audio_id: audioId,
    start_time: startTime,
    end_time: endTime,
    label,
  });
  return data;
}

export async function deleteSegment(projectId: string, segmentId: string): Promise<void> {
  await api.delete(`/editor/${projectId}/segments/${segmentId}`);
}

export async function reorderSegments(projectId: string, segmentIds: string[]): Promise<void> {
  await api.put(`/editor/${projectId}/segments/reorder`, { segment_ids: segmentIds });
}

export async function exportSegments(projectId: string, format = 'wav', stem = 'original'): Promise<{ task_id: string }> {
  const { data } = await api.post(`/editor/${projectId}/export`, { format, stem });
  return data;
}
