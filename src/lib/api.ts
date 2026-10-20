// Cliente de API — todas as chamadas ao backend passam por aqui

export interface ImageGenEvent {
  type: 'started' | 'generating' | 'scene_done' | 'scene_error' | 'completed';
  total?: number;
  completed?: number;
  scene_number?: number;
  scene_id?: string;
  image_url?: string;
  error?: string;
  message?: string;
  results?: Array<{ scene_number: number; image_url: string | null; error?: string }>;
  success?: boolean;
}

export interface ApiScript {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  duration_seconds: number;
  voice_tone: string;
  narration_speed: string;
}

export interface ApiScene {
  id: string;
  project_id: string;
  scene_number: number;
  description: string;
  image_prompt: string;
  image_url: string | null;
  duration_seconds: number;
}

export interface ApiMetadata {
  video_title: string;
  description: string;
  hashtags: string[];
  video_url?: string | null;
  thumbnail_url?: string | null;
  end_card_url?: string | null;
}

export interface ApiProject {
  id: string;
  title: string | null;
  topic: string;
  niche: string | null;
  status: string;
  created_at: string;
  thumbnail_url?: string | null;
  folder_id?: string | null;
}

export interface ApiFolder {
  id: string;
  name: string;
  emoji: string;
  color: string;
  default_voice_id: string | null;
  default_language: string | null;
  created_at: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export interface GenerateScriptResult {
  script: ApiScript;
  scenes: ApiScene[];
  metadata: ApiMetadata;
}

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function mediaUrl(url: string) {
  return url.startsWith('/api/files/') && import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}${url}` : url;
}
function resolveMedia(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveMedia);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,val]) => [key, typeof val === 'string' && /_url$/.test(key) ? mediaUrl(val) : resolveMedia(val)]));
  return value;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return resolveMedia(data) as T;
}

export const api = {
  mediaUrl,
  manual: {
    saveScript: (id: string, data: { title: string; hook: string; body: string; cta: string; description: string; hashtags: string; scenes: { description: string; duration_seconds: number }[] }) =>
      request(`/projects/${id}/script`, { method: 'PUT', body: JSON.stringify(data) }),
    file: (file: File): Promise<{ fileBase64: string; mimeType: string }> => new Promise((resolve, reject) => {
      if (file.size > 25 * 1024 * 1024) return reject(new Error('Limite de 25 MB por arquivo'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
      reader.onload = () => resolve({ fileBase64: String(reader.result).split(',')[1], mimeType: file.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : file.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : file.type });
      reader.readAsDataURL(file);
    }),
    image: (id: string, sceneId: string, data: object) => request<ApiScene>(`/projects/${id}/images/${sceneId}`, { method: 'PUT', body: JSON.stringify(data) }),
    audio: (id: string, data: object) => request<{ audio_url: string }>(`/projects/${id}/narration`, { method: 'PUT', body: JSON.stringify(data) }),
    endcard: (id: string, data: object) => request<{ url: string }>(`/projects/${id}/endcard`, { method: 'POST', body: JSON.stringify(data) }),
    thumbnail: (id: string, data: object) => request<{ thumbnail_url: string }>(`/projects/${id}/thumbnail`, { method: 'POST', body: JSON.stringify(data) }),
  },
  projects: {
    list: (folderId?: string | 'none') =>
      request<ApiProject[]>(`/projects${folderId ? `?folder_id=${folderId}` : ''}`),

    moveToFolder: (id: string, folderId: string | null) =>
      request<ApiProject>(`/projects/${id}/folder`, {
        method: 'PATCH',
        body: JSON.stringify({ folder_id: folderId }),
      }),

    create: (topic: string, niche?: string) =>
      request<ApiProject>('/projects', {
        method: 'POST',
        body: JSON.stringify({ topic, niche }),
      }),

    get: (id: string) =>
      request<{
        project: ApiProject;
        script: ApiScript | null;
        scenes: ApiScene[];
        narration: unknown | null;
        metadata: ApiMetadata | null;
      }>(`/projects/${id}`),

    delete: (id: string) =>
      fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' }),

    uploadEndCard: (id: string, imageBase64: string, mimeType: string) =>
      request<{ url: string }>(`/projects/${id}/endcard`, {
        method: 'POST',
        body: JSON.stringify({ imageBase64, mimeType }),
      }),


  },

  narration: { voices: () => request<Voice[]>('/voices') },

  render: {
    start: (projectId: string) =>
      request<{ message: string; videoUrl?: string; queue?: object }>(
        `/projects/${projectId}/render`,
        { method: 'POST' }
      ),

    // Abre SSE stream — retorna EventSource já conectado
    streamStatus: (projectId: string): EventSource =>
      new EventSource(`${API_BASE}/projects/${projectId}/render/status`),
  },

  folders: {
    list: () => request<ApiFolder[]>('/folders'),
    create: (name: string, emoji: string, color: string, defaultVoiceId?: string, defaultLanguage?: string) =>
      request<ApiFolder>('/folders', {
        method: 'POST',
        body: JSON.stringify({ name, emoji, color, default_voice_id: defaultVoiceId ?? null, default_language: defaultLanguage ?? 'pt' }),
      }),
    update: (id: string, updates: Partial<Pick<ApiFolder, 'name' | 'emoji' | 'color' | 'default_voice_id' | 'default_language'>>) =>
      request<ApiFolder>(`/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetch(`${API_BASE}/folders/${id}`, { method: 'DELETE' }),
  },

  health: () => request<{ status: string; services: Record<string, boolean> }>('/health'),
};

export interface ThemeSuggestion {
  title: string;
  description: string;
  emoji: string;
  niche: string;
  hook: string;
}
