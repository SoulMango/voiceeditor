export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  audio_files: AudioFile[];
}

export interface AudioFile {
  id: string;
  project_id: string;
  filename: string;
  original_name: string | null;
  duration: number | null;
  sample_rate: number | null;
  source_type: string | null;
  source_url: string | null;
  has_transcript: boolean;
  has_separation: boolean;
  created_at: string;
}
