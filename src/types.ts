export enum AppStep {
  DASHBOARD = 'DASHBOARD',
  PROJECTS = 'PROJECTS',
  TOPIC_SELECTION = 'TOPIC_SELECTION',
  AUTO_GENERATION = 'AUTO_GENERATION',
  SCRIPT_GENERATION = 'SCRIPT_GENERATION',
  PRODUCTION_ELEMENTS = 'PRODUCTION_ELEMENTS',
  PREVIEW = 'PREVIEW',
  EXPORT = 'EXPORT',
}

export interface ProjectContext {
  projectId: string;
  topic: string;
  niche?: string;
  folderId?: string;
  folderName?: string;
  folderEmoji?: string;
  defaultVoiceId?: string;
  defaultVoiceName?: string;
  defaultLanguage?: string;
}

export interface FolderDefaults {
  folderId?: string;
  folderName?: string;
  folderEmoji?: string;
  defaultVoiceId?: string;
  defaultVoiceName?: string;
  defaultLanguage?: string;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  'pt':    'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'en':    'English',
  'es':    'Español',
  'fr':    'Français',
  'de':    'Deutsch',
  'it':    'Italiano',
  'ja':    '日本語',
  'ko':    '한국어',
  'zh':    '中文',
  'ar':    'العربية',
};
