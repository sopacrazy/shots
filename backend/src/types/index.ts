export type ProjectStatus =
  | 'draft'
  | 'generating_script'
  | 'script_ready'
  | 'generating_narration'
  | 'narration_ready'
  | 'generating_images'
  | 'images_ready'
  | 'rendering'
  | 'completed'
  | 'error';

export interface Project {
  id: string;
  title: string | null;
  folder_id: string | null;
  topic: string;
  niche: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Script {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  duration_seconds: number;
  voice_tone: string;
  narration_speed: string;
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  description: string;
  image_prompt: string;
  image_url: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface Narration {
  id: string;
  project_id: string;
  audio_url: string;
  voice_id: string;
  script_text: string;
  duration_seconds: number | null;
  created_at: string;
}

export interface ExportMetadata {
  id: string;
  project_id: string;
  video_title: string;
  description: string;
  hashtags: string[];
  end_card_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  created_at: string;
}

export interface GenerateScriptRequest {
  topic: string;
  niche?: string;
  duration_target?: number;
  voice_tone?: string;
  narration_speed?: string;
}

export interface GenerateScriptResponse {
  script: Script;
  scenes: Scene[];
  metadata: Pick<ExportMetadata, 'video_title' | 'description' | 'hashtags'>;
}

export interface GenerateNarrationRequest {
  voice_id?: string;
  speed?: number;
}

export interface GenerateImagesRequest {
  visual_style?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
}

export interface Folder {
  id: string; name: string; emoji: string; color: string;
  default_voice_id: string | null; default_language: string | null; created_at: string;
}
