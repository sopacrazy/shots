import type { ProjectContext } from '@/src/types';
import { LANGUAGE_LABELS } from '@/src/types';

interface Props {
  project: ProjectContext;
}

export default function FolderContextBanner({ project }: Props) {
  if (!project.folderId) return null;

  const langLabel = project.defaultLanguage
    ? LANGUAGE_LABELS[project.defaultLanguage] ?? project.defaultLanguage
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#141415]/80 border border-[#ffffff0a] mb-6">
      <span className="text-xs text-gray-500 font-medium mr-1">Criando em:</span>

      {/* Pasta */}
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7B61FF]/15 border border-[#7B61FF]/25 text-[#7B61FF] text-xs font-semibold">
        <span>{project.folderEmoji ?? '📁'}</span>
        <span>{project.folderName}</span>
      </span>

      {/* Idioma */}
      {langLabel && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] text-xs font-medium">
          <span>🌐</span>
          <span>{langLabel}</span>
        </span>
      )}

      {/* Narrador */}
      {project.defaultVoiceName && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span>🎙️</span>
          <span>{project.defaultVoiceName}</span>
        </span>
      )}
    </div>
  );
}
