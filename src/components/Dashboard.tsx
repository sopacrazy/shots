import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Video, CheckCircle, FolderHeart, Plus, Clock, Loader2, Trash2, AlertTriangle, X, Pencil, Clapperboard, Sparkles, Download, Maximize2 } from 'lucide-react';
import type React from 'react';
import { api, type ApiProject, type ApiMetadata } from '@/src/lib/api';

import type { FolderDefaults } from '@/src/types';

interface DashboardProps {
  onStartProject: (defaults?: FolderDefaults) => void;
  onEditProject: (project: ApiProject) => void;
}

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

const STATUS_COLOR: Record<string, 'done' | 'progress' | 'draft' | 'error'> = {
  completed: 'done',
  script_ready: 'progress',
  narration_ready: 'progress',
  images_ready: 'progress',
  generating_script: 'progress',
  generating_narration: 'progress',
  generating_images: 'progress',
  rendering: 'progress',
  draft: 'draft',
  error: 'error',
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

export default function Dashboard({ onStartProject, onEditProject }: DashboardProps) {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<ApiProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preview, setPreview] = useState<PreviewModal | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.projects.list()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

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
    } catch { /* mantém o modal aberto sem dados */ }
    finally { setPreviewLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    await api.projects.delete(deleteConfirm.id).catch(() => {});
    setProjects(prev => prev.filter(p => p.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    setIsDeleting(false);
  };

  const completed = projects.filter(p => p.status === 'completed').length;
  const inProgress = projects.filter(p =>
    ['generating_script','generating_narration','generating_images','rendering','script_ready','narration_ready','images_ready'].includes(p.status)
  ).length;
  const drafts = projects.filter(p => p.status === 'draft').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 lg:space-y-10 pb-20"
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-3xl font-display font-semibold mb-2">Bem-vindo de volta!</h2>
          <p className="text-gray-400">Pronto para criar o próximo conteúdo viral?</p>
        </div>
        <button
          onClick={() => onStartProject()}
          className="group relative flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B61FF] text-white font-semibold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(123,97,255,0.4)]"
        >
          <Clapperboard className="w-5 h-5" />
          <span>Criar Novo Short</span>
        </button>
      </header>

      {/* Métricas reais */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <MetricCard icon={<Video className="w-5 h-5 text-[#7B61FF]" />} label="Total de Projetos" value={String(projects.length)} />
        <MetricCard icon={<Clock className="w-5 h-5 text-yellow-400" />} label="Em Andamento" value={String(inProgress)} />
        <MetricCard icon={<CheckCircle className="w-5 h-5 text-emerald-400" />} label="Concluídos" value={String(completed)} />
        <MetricCard icon={<FolderHeart className="w-5 h-5 text-pink-400" />} label="Rascunhos" value={String(drafts)} />
      </section>

      {/* Banner de ação */}
      <section
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A1A1E] to-[#0A0A0B] border border-[#ffffff0a] p-5 sm:p-10 cursor-pointer group"
        onClick={() => onStartProject()}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#00E5FF]/10 to-[#7B61FF]/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7B61FF]/20 border border-[#7B61FF]/30 text-[#00E5FF] text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles className="w-3 h-3" />
              Produção manual
            </div>
            <h3 className="text-xl sm:text-3xl font-display font-semibold mb-3 sm:mb-4">Editor de Shorts</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Monte vídeos curtos com seu roteiro, imagens e narração. Organize as cenas e exporte em MP4.
            </p>
            <div className="flex items-center gap-2 text-[#00E5FF] font-medium group-hover:gap-4 transition-all">
              <span>Iniciar Fluxo de Criação</span>
              <Play className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div className="hidden lg:flex items-center justify-center relative w-64 h-64">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#7B61FF] to-[#00E5FF] opacity-20 blur-3xl animate-pulse" />
            <Plus className="w-20 h-20 text-white/10" />
          </div>
        </div>
      </section>

      {/* Histórico real */}
      <section>
        <h3 className="text-xl font-display font-semibold mb-6 flex items-center gap-2">
          Histórico Recente
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Carregando projetos...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-3">
            <Video className="w-12 h-12 opacity-20" />
            <p>Nenhum projeto ainda. Crie seu primeiro short!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {projects.slice(0, 8).map(p => (
              <HistoryItem
                key={p.id}
                title={p.title ?? p.topic}
                status={STATUS_COLOR[p.status] ?? 'draft'}
                statusLabel={STATUS_LABEL[p.status] ?? p.status}
                date={timeAgo(p.created_at)}
                thumbnailUrl={p.thumbnail_url ?? null}
                onDelete={() => setDeleteConfirm(p)}
                onEdit={() => onEditProject(p)}
                onView={p.status === 'completed' ? () => handleOpenPreview(p) : undefined}
              />
            ))}
          </div>
        )}
      </section>
      {/* Modal de preview do vídeo */}
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
              {/* Lado esquerdo — vídeo / thumbnail */}
              <div className="md:w-[260px] flex-shrink-0 bg-black flex items-center justify-center relative">
                {previewLoading ? (
                  <div className="w-[260px] aspect-[9/16] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#7B61FF] animate-spin" />
                  </div>
                ) : preview.videoUrl ? (
                  <video
                    src={preview.videoUrl}
                    className="w-full aspect-[9/16] object-cover"
                    controls
                    autoPlay
                    loop
                    playsInline
                  />
                ) : preview.thumbnailUrl ? (
                  <img src={preview.thumbnailUrl} alt="" className="w-full aspect-[9/16] object-cover" />
                ) : (
                  <div className="w-[260px] aspect-[9/16] flex items-center justify-center text-gray-700">
                    <Video className="w-12 h-12 opacity-20" />
                  </div>
                )}
              </div>

              {/* Lado direito — info */}
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
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
                    {preview.metadata.description}
                  </p>
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
                    <a
                      href={preview.videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
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

      {/* Modal de confirmação de exclusão */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#141415] border border-rose-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-semibold mb-2">Excluir Projeto</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Tem certeza que deseja excluir <span className="text-white font-medium">"{deleteConfirm.title ?? deleteConfirm.topic}"</span>?
                    Isso vai remover o roteiro, imagens, narração e vídeo permanentemente.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors disabled:opacity-60"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#141415]/50 border border-[#ffffff0a] rounded-2xl p-6 backdrop-blur-sm hover:bg-[#141415] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <h4 className="text-2xl font-display font-semibold">{value}</h4>
    </div>
  );
}

function HistoryItem({
  title, status, statusLabel, date, thumbnailUrl, onDelete, onEdit, onView,
}: {
  title: string;
  status: 'done' | 'progress' | 'draft' | 'error';
  statusLabel: string;
  date: string;
  thumbnailUrl: string | null;
  onDelete: () => void;
  onEdit: () => void;
  onView?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl bg-[#141415]/30 border border-[#ffffff0a] hover:bg-[#141415] transition-colors cursor-pointer group"
      onClick={onView}
    >
      {/* Thumbnail 9:16 */}
      <div className="w-14 h-[84px] rounded-xl bg-[#2A2A2D] flex-shrink-0 relative overflow-hidden">
        {thumbnailUrl ? (
          <>
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
            {status === 'done' && onView && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {status === 'done'     ? <CheckCircle className="w-5 h-5 text-emerald-400 opacity-60" />
            : status === 'progress' ? <Loader2 className="w-5 h-5 text-yellow-400 opacity-60 animate-spin" />
            : <Video className="w-5 h-5 text-gray-600" />}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate mb-1 text-white group-hover:text-[#00E5FF] transition-colors">
          {title}
        </h4>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {statusLabel}</span>
          <span>•</span>
          <span>{date}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-[#7B61FF]/20 text-[#7B61FF] transition-all"
          title="Editar projeto"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-all"
          title="Excluir projeto"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {status === 'done'     && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] ml-1" />}
        {status === 'progress' && <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_#eab308] animate-pulse ml-1" />}
        {status === 'draft'    && <div className="w-2 h-2 rounded-full bg-gray-500 ml-1" />}
        {status === 'error'    && <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] ml-1" />}
      </div>
    </div>
  );
}
