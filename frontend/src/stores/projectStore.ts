import { create } from 'zustand';
import type { Project, ProjectDetail } from '../types/project';
import * as projectApi from '../api/projects';

interface ProjectStore {
  projects: Project[];
  currentProject: ProjectDetail | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    const projects = await projectApi.fetchProjects();
    set({ projects, loading: false });
  },

  fetchProject: async (id: string) => {
    set({ loading: true });
    const project = await projectApi.fetchProject(id);
    set({ currentProject: project, loading: false });
  },

  createProject: async (name: string, description = '') => {
    const project = await projectApi.createProject(name, description);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  deleteProject: async (id: string) => {
    await projectApi.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  clearCurrent: () => set({ currentProject: null }),
}));
