import api from './client';
import type { Project, ProjectDetail } from '../types/project';

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await api.get('/projects');
  return data;
}

export async function createProject(name: string, description = ''): Promise<Project> {
  const { data } = await api.post('/projects', { name, description });
  return data;
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  const { data } = await api.get(`/projects/${id}`);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
