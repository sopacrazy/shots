import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Folder, Settings, Trash2, Pencil, X, Check, Loader2,
  Video, Play, CheckCircle, Clock, Download, AlertTriangle, Clapperboard,
} from 'lucide-react';
import { api, type ApiProject, type ApiFolder, type ApiMetadata, type Voice } from '@/src/lib/api';
import type { FolderDefaults } from '@/src/types';

interface ProjectsViewProps {
  onStartProject: (defaults?: FolderDefaults) => void;
  onEditProject: (project: ApiProject) => void;
}

const LANGUAGES = [
  { code: 'pt', label: '🇧🇷 Português (Brasil)' },
  { code: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'ar', label: '🇸🇦 العربية' },
];

const FOLDER_COLORS = [
  '#7B61FF', '#00E5FF', '#FF6B6B', '#FFB347', '#51CF66',
  '#FF69B4', '#4DABF7', '#A9E34B', '#FF8CC8', '#74C0FC',
];

const FOLDER_EMOJIS = ['📁', '🎬', '🚀', '⭐', '🔥', '💡', '🎯', '🌊', '👑', '🎪'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  generating_script: 'Gerando roteiro...',
  script_ready: 'Roteiro pronto',
  generating_narration: 'Gerando narração...',
  narration_ready: 'Narração pronta',
  generating_images: 'Gerando imagens...',
  images_ready: 'Imagens prontas',
  rendering: 'Renderizando...',
  completed: 'Concluído',
  error: 'Erro',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days} dia${days > 1 ? 's' : ''}`;
}

interface PreviewModal {
  project: ApiProject;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  metadata: ApiMetadata | null;
}

export default function ProjectsView({ onStartProject, onEditProject }: ProjectsViewProps) {
  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [voices, setVoices] = useState<Voice[]>([]);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState('#7B61FF');
  const [newFolderVoice, setNewFolderVoice] = useState('');
  const [newFolderLang, setNewFolderLang] = useState('pt');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [editingFolder, setEditingFolder] = useState<ApiFolder | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editVoice, setEditVoice] = useState('');
  const [editLang, setEditLang] = useState('pt');
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  const [deleteFolder, setDeleteFolder] = useState<ApiFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const [preview, setPreview] = useState<PreviewModal | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [deleteProject, setDeleteProject] = useState<ApiProject | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const [movingProject, setMovingProject] = useState<ApiProject | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      const [f, p, v] = await Promise.all([
        api.folders.list().catch(() => [] as ApiFolder[]),
        api.projects.list().catch(() => [] as ApiProject[]),
        api.narration.voices().catch(() => [] as Voice[]),
      ]);
      setFolders(f);
      setProjects(p);
      setVoices(v);
      setIsLoading(false);
    };
    loadAll();
  }, []);


  const filteredProjects = selectedFolder === null
    ? projects
    : projects.filter(p => p.folder_id === selectedFolder);

  const projectCountInFolder = (folderId: string) =>
    projects.filter(p => p.folder_id === folderId).length;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const folder = await api.folders.create(
        newFolderName.trim(), newFolderEmoji, newFolderColor,
        newFolderVoice || undefined, newFolderLang,
      );
      setFolders(prev => [...prev, folder]);
      setShowCreateFolder(false);
      setNewFolderName(''); setNewFolderEmoji('📁'); setNewFolderColor('#7B61FF');
      setNewFolderVoice(''); setNewFolderLang('pt');
    } catch { /* ignore */ }
    finally { setIsCreatingFolder(false); }
  };

  const handleSaveFolder = async () => {
    if (!editingFolder) return;
    setIsSavingFolder(true);
    try {
      const updated = await api.folders.update(editingFolder.id, {
        name: editName, emoji: editEmoji, color: editColor,
        default_voice_id: editVoice || null,
        default_language: editLang,
      });
      setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
      setEditingFolder(null);
    } catch { /* ignore */ }
    finally { setIsSavingFolder(false); }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolder) return;
    setIsDeletingFolder(true);
    await api.folders.delete(deleteFolder.id).catch(() => {});
    setFolders(prev => prev.filter(f => f.id !== deleteFolder.id));
    setProjects(prev => prev.map(p => p.folder_id === deleteFolder.id ? { ...p, folder_id: null } : p));
    if (selectedFolder === deleteFolder.id) setSelectedFolder(null);
    setDeleteFolder(null);
    setIsDeletingFolder(false);
  };

  const handleDeleteProject = async () => {
    if (!deleteProject) return;
    setIsDeletingProject(true);
    await api.projects.delete(deleteProject.id).catch(() => {});
    setProjects(prev => prev.filter(p => p.id !== deleteProject.id));
    setDeleteProject(null);
    setIsDeletingProject(false);
  };

  const handleMoveProject = async (folderId: string | null) => {
    if (!movingProject) return;
    await api.projects.moveToFolder(movingProject.id, folderId).catch(() => {});
    setProjects(prev => prev.map(p => p.id === movingProject.id ? { ...p, folder_id: folderId } : p));
    setMovingProject(null);
  };

  const handleOpenPreview = async (p: ApiProject) => {
    setPreviewLoading(true);
    setPreview({ project: p, videoUrl: null, thumbnailUrl: p.thumbnail_url ?? null, metadata: null });
    try {
      const data = await api.projects.get(p.id);
      setPreview({
        project: p,
        videoUrl: data.metadata?.video_url ?? null,
        thumbnailUrl: data.metadata?.thumbnail_url ?? p.thumbnail_url ?? null,
        metadata: data.metadata,
      });
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-3xl font-display font-semibold mb-1">Meus Projetos</h2>
          <p className="text-gray-400 text-sm">{projects.length} projeto{projects.length !== 1 ? 's' : ''} no total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-300 transition-colors"
          >
            <Folder className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Pasta</span>
          </button>
          <button
            onClick={() => {
              const folder = folders.find(f => f.id === selectedFolder);
              onStartProject(folder ? {
                folderId: folder.id,
                folderName: folder.name,
                folderEmoji: folder.emoji,
                defaultVoiceId: folder.default_voice_id ?? undefined,
                defaultVoiceName: voices.find(v => v.voice_id === folder.default_voice_id)?.name,
                defaultLanguage: folder.default_language ?? undefined,
              } : undefined);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B61FF] to-[#00E5FF] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(123,97,255,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Short</span>
          </button>
        </div>
      </div>

      {/* Pastas */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pastas</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* "Todos" */}
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-200 ${
              selectedFolder === null
                ? 'bg-[#7B61FF]/20 border-[#7B61FF]/50 text-white'
                : 'bg-[#141415]/50 border-[#ffffff0a] text-gray-400 hover:bg-[#1A1A1E] hover:text-white'
            }`}
          >
            <span className="text-lg">🗂️</span>
            <div className="text-left">
              <p className="text-sm font-semibold leading-none">Todos</p>
              <p className="text-xs opacity-60 mt-0.5">{projects.length} projetos</p>
            </div>
          </button>

          {/* Pastas reais — sem dropdown, gear abre modal direto */}
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id === selectedFolder ? null : folder.id)}
              className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-200 ${
                selectedFolder === folder.id
                  ? 'text-white'
                  : 'bg-[#141415]/50 border-[#ffffff0a] text-gray-400 hover:bg-[#1A1A1E] hover:text-white'
              }`}
              style={selectedFolder === folder.id ? {
                background: `${folder.color}22`,
                borderColor: `${folder.color}80`,
              } : undefined}
            >
              <span className="text-lg">{folder.emoji}</span>
              <div className="text-left">
                <p className="text-sm font-semibold leading-none">{folder.name}</p>
                <p className="text-xs opacity-60 mt-0.5">{projectCountInFolder(folder.id)} projetos</p>
              </div>
            </button>
          ))}

          {/* Botão nova pasta inline */}
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-[#ffffff15] text-gray-600 hover:text-gray-400 hover:border-[#ffffff30] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Nova pasta</span>
          </button>
        </div>
      </div>

      {/* Header da pasta selecionada */}
      <AnimatePresence>
        {selectedFolder && (() => {
          const folder = folders.find(f => f.id === selectedFolder);
          if (!folder) return null;
          const voiceName = voices.find(v => v.voice_id === folder.default_voice_id)?.name;
          const langLabel = LANGUAGES.find(l => l.code === folder.default_language)?.label?.replace(/^.\s/, '');
          return (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border"
              style={{ background: `${folder.color}12`, borderColor: `${folder.color}35` }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-4xl flex-shrink-0">{folder.emoji}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-lg leading-tight truncate">{folder.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{projectCountInFolder(folder.id)} projeto{projectCountInFolder(folder.id) !== 1 ? 's' : ''}</span>
                    {langLabel && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span>🌐</span> {langLabel}
                      </span>
                    )}
                    {voiceName && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span>🎙️</span> {voiceName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingFolder(folder);
                    setEditName(folder.name);
                    setEditEmoji(folder.emoji);
                    setEditColor(folder.color);
                    setEditVoice(folder.default_voice_id ?? '');
                    setEditLang(folder.default_language ?? 'pt');
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors border border-white/5"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </button>
                <button
                  onClick={() => setDeleteFolder(folder)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-colors border border-white/5"
                  title="Excluir pasta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Grade de projetos */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Carregando projetos...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-600">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center">
              <Clapperboard className="w-10 h-10 opacity-30" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-400 mb-1">Nenhum projeto aqui</p>
              <p className="text-sm text-gray-600">
                {selectedFolder ? 'Mova projetos para esta pasta ou crie um novo.' : 'Crie seu primeiro short agora!'}
              </p>
            </div>
            <button
              onClick={() => onStartProject()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B61FF]/20 border border-[#7B61FF]/30 text-[#7B61FF] font-medium text-sm hover:bg-[#7B61FF]/30 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                folders={folders}
                onView={p.status === 'completed' ? () => handleOpenPreview(p) : undefined}
                onEdit={() => onEditProject(p)}
                onDelete={() => setDeleteProject(p)}
                onMove={() => setMovingProject(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal — Criar pasta */}
      <AnimatePresence>
        {showCreateFolder && (
          <ModalOverlay onClose={() => setShowCreateFolder(false)}>
            <h3 className="text-xl font-display font-semibold mb-6">Nova Pasta</h3>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nome</label>
                <input autoFocus type="text" placeholder="Ex: Saúde e Bem-estar" value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full bg-[#0A0A0B] border border-[#ffffff15] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B61FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_EMOJIS.map(e => (
                    <button key={e} onClick={() => setNewFolderEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${newFolderEmoji === e ? 'bg-[#7B61FF]/30 ring-2 ring-[#7B61FF]' : 'bg-white/5 hover:bg-white/10'}`}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map(c => (
                    <button key={c} onClick={() => setNewFolderColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${newFolderColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

                            <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateFolder(false)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || isCreatingFolder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white font-semibold transition-colors disabled:opacity-40"
                >
                  {isCreatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Criar
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Modal — Editar pasta */}
      <AnimatePresence>
        {editingFolder && (
          <ModalOverlay onClose={() => setEditingFolder(null)}>
            <h3 className="text-xl font-display font-semibold mb-6">Configurações da Pasta</h3>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nome</label>
                <input autoFocus type="text" value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveFolder()}
                  className="w-full bg-[#0A0A0B] border border-[#ffffff15] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#7B61FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_EMOJIS.map(e => (
                    <button key={e} onClick={() => setEditEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${editEmoji === e ? 'bg-[#7B61FF]/30 ring-2 ring-[#7B61FF]' : 'bg-white/5 hover:bg-white/10'}`}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${editColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

                            <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingFolder(null)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveFolder} disabled={!editName.trim() || isSavingFolder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white font-semibold transition-colors disabled:opacity-40"
                >
                  {isSavingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Modal — Confirmar exclusão de pasta */}
      <AnimatePresence>
        {deleteFolder && (
          <ModalOverlay onClose={() => setDeleteFolder(null)}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-display font-semibold mb-2">Excluir Pasta</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A pasta <span className="text-white font-medium">"{deleteFolder.name}"</span> será removida.
                  Os projetos dentro dela <span className="text-white">não serão excluídos</span> — apenas ficarão sem pasta.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteFolder(null)} disabled={isDeletingFolder} className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteFolder} disabled={isDeletingFolder} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors disabled:opacity-60">
                {isDeletingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Modal — Confirmar exclusão de projeto */}
      <AnimatePresence>
        {deleteProject && (
          <ModalOverlay onClose={() => setDeleteProject(null)}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-display font-semibold mb-2">Excluir Projeto</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Tem certeza? <span className="text-white font-medium">"{deleteProject.title ?? deleteProject.topic}"</span> será removido permanentemente.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteProject(null)} disabled={isDeletingProject} className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteProject} disabled={isDeletingProject} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors disabled:opacity-60">
                {isDeletingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Modal — Mover para pasta */}
      <AnimatePresence>
        {movingProject && (
          <ModalOverlay onClose={() => setMovingProject(null)}>
            <h3 className="text-xl font-display font-semibold mb-4">Mover para pasta</h3>
            <p className="text-sm text-gray-400 mb-5">
              Projeto: <span className="text-white">{movingProject.title ?? movingProject.topic}</span>
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              <button
                onClick={() => handleMoveProject(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  !movingProject.folder_id ? 'bg-[#7B61FF]/20 border border-[#7B61FF]/40 text-white' : 'hover:bg-white/5 text-gray-400'
                }`}
              >
                <span className="text-xl">🗂️</span>
                <span className="font-medium">Sem pasta</span>
                {!movingProject.folder_id && <Check className="w-4 h-4 ml-auto text-[#7B61FF]" />}
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleMoveProject(f.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    movingProject.folder_id === f.id ? 'border text-white' : 'hover:bg-white/5 text-gray-400'
                  }`}
                  style={movingProject.folder_id === f.id ? {
                    background: `${f.color}22`, borderColor: `${f.color}60`,
                  } : undefined}
                >
                  <span className="text-xl">{f.emoji}</span>
                  <span className="font-medium">{f.name}</span>
                  {movingProject.folder_id === f.id && <Check className="w-4 h-4 ml-auto" style={{ color: f.color }} />}
                </button>
              ))}
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Modal — Preview do vídeo */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 24 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#141415] border border-[#ffffff15] rounded-3xl overflow-hidden shadow-2xl w-full max-w-3xl flex flex-col md:flex-row"
            >
              <div className="md:w-[260px] flex-shrink-0 bg-black flex items-center justify-center">
                {previewLoading ? (
                  <div className="w-[260px] aspect-[9/16] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#7B61FF] animate-spin" />
                  </div>
                ) : preview.videoUrl ? (
                  <video src={preview.videoUrl} className="w-full aspect-[9/16] object-cover" controls autoPlay loop playsInline />
                ) : preview.thumbnailUrl ? (
                  <img src={preview.thumbnailUrl} alt="" className="w-full aspect-[9/16] object-cover" />
                ) : (
                  <div className="w-[260px] aspect-[9/16] flex items-center justify-center text-gray-700">
                    <Video className="w-12 h-12 opacity-20" />
                  </div>
                )}
              </div>
              <div className="flex-1 p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-display font-semibold leading-snug">
                    {preview.project.title ?? preview.project.topic}
                  </h3>
                  <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {preview.metadata?.description && (
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">{preview.metadata.description}</p>
                )}
                {preview.metadata?.hashtags && preview.metadata.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.metadata.hashtags.slice(0, 6).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-[#7B61FF]/10 text-[#7B61FF] text-xs border border-[#7B61FF]/20">
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-white/5">
                  {preview.videoUrl && (
                    <a href={preview.videoUrl} download target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Baixar MP4
                    </a>
                  )}
                  <button
                    onClick={() => { setPreview(null); onEditProject(preview.project); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-sm transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Editar Projeto
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProjectCard({
  project, index, folders, onView, onEdit, onDelete, onMove,
}: {
  project: ApiProject;
  index: number;
  folders: ApiFolder[];
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isDone = project.status === 'completed';
  const isProgress = ['generating_script','generating_narration','generating_images','rendering','script_ready','narration_ready','images_ready'].includes(project.status);
  const folder = folders.find(f => f.id === project.folder_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#141415]/50 border border-[#ffffff0a] hover:border-[#7B61FF]/30 transition-all duration-200 hover:shadow-[0_0_20px_rgba(123,97,255,0.1)]"
    >
      {/* Thumbnail 9:16 */}
      <div
        className="relative w-full aspect-[9/16] bg-[#0A0A0B] cursor-pointer"
        onClick={onView}
      >
        {project.thumbnail_url && !imgError ? (
          <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isDone
              ? <CheckCircle className="w-8 h-8 text-emerald-400 opacity-40" />
              : isProgress
                ? <Loader2 className="w-8 h-8 text-yellow-400 opacity-40 animate-spin" />
                : <Video className="w-8 h-8 text-gray-700" />
            }
          </div>
        )}

        {/* Overlay hover com play */}
        {isDone && onView && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Badge de pasta */}
        {folder && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm"
            style={{ background: `${folder.color}40`, color: folder.color, border: `1px solid ${folder.color}50` }}
          >
            <span className="text-[10px]">{folder.emoji}</span>
          </div>
        )}

        {/* Botões de ação */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-[#7B61FF]/60 text-white transition-colors"
            title="Editar"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMove(); }}
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 text-white transition-colors"
            title="Mover para pasta"
          >
            <Folder className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-rose-500/60 text-white transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-medium text-white truncate leading-snug mb-1">
          {project.title ?? project.topic}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${
              isDone ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
              : isProgress ? 'bg-yellow-500 shadow-[0_0_6px_#eab308] animate-pulse'
              : project.status === 'error' ? 'bg-rose-500'
              : 'bg-gray-500'
            }`} />
            <span className="text-[10px] text-gray-500">
              {STATUS_LABEL[project.status] ?? project.status}
            </span>
          </div>
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(project.created_at).replace('Há ', '')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#141415] border border-[#ffffff15] rounded-3xl p-8 max-w-md w-full shadow-2xl"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
