import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Wand2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/src/lib/api';
import type { ProjectContext } from '@/src/types';

interface Step4PreviewProps {
  project: ProjectContext;
  onNext: () => void;
  onBack: () => void;
}

type RenderStatus = 'idle' | 'queued' | 'started' | 'rendering' | 'completed' | 'error';

export default function Step4Preview({ project, onNext, onBack }: Step4PreviewProps) {
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle');
  const [renderMessage, setRenderMessage] = useState('');
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoBuffered, setVideoBuffered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Verifica se já tem vídeo renderizado ao entrar na tela
  useEffect(() => {
    api.projects.get(project.projectId).then(data => {
      if (data.project.status === 'completed' && data.metadata?.video_url) {
        setVideoUrl(data.metadata.video_url ?? null);
        setRenderStatus('completed');
      }
    }).catch(() => {});
  }, [project.projectId]);

  const handleRender = async () => {
    setError(null);
    setRenderStatus('queued');
    setRenderMessage('Adicionando à fila de renderização...');

    let settled = false;
    const es = api.render.streamStatus(project.projectId);
    eventSourceRef.current?.close();
    eventSourceRef.current = es;
    es.onopen = async () => {
      try {
        const result = await api.render.start(project.projectId);
        if (result.videoUrl && !settled) {
          settled = true; es.close(); setVideoUrl(api.mediaUrl(result.videoUrl)); setRenderStatus('completed');
        }
      } catch (err) {
        if (!settled) { settled = true; es.close(); setError(err instanceof Error ? err.message : 'Erro ao iniciar renderização'); setRenderStatus('error'); }
      }
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          type: string; message: string; videoUrl?: string; status?: string; progress?: number;
        };

        if (data.type === 'queued') {
          setRenderStatus('queued');
          setRenderMessage(data.message);
          setRenderProgress(0);
        } else if (data.type === 'started') {
          setRenderStatus('started');
          setRenderMessage('Montando cenas com Remotion...');
          setRenderProgress(0);
        } else if (data.type === 'progress') {
          setRenderStatus('rendering');
          setRenderProgress(data.progress ?? 0);
          setRenderMessage(`Renderizando frames...`);
        } else if (data.type === 'completed') {
          settled = true;
          setRenderStatus('completed');
          setRenderMessage('Vídeo renderizado com sucesso!');
          setRenderProgress(100);
          setVideoUrl(data.videoUrl ? api.mediaUrl(data.videoUrl) : null);
          setVideoLoading(true);
          es.close();
          // Gera thumbnail em background — estará pronta quando o usuário chegar no Export

        } else if (data.type === 'error') {
          settled = true;
          setRenderStatus('error');
          setError(data.message);
          es.close();
        } else if (data.type === 'current_status' && data.status === 'completed') {
          settled = true;
          es.close();
          api.projects.get(project.projectId).then(d => { setVideoUrl(d.metadata?.video_url ?? null); setRenderStatus('completed'); }).catch(err => { setError(err.message); setRenderStatus('error'); });
        }
      } catch {}
    };

    es.onerror = () => {
      // SSE fecha automaticamente ao terminar — ignora erros de fechamento
      if (!settled) {
        settled = true; es.close();
        setRenderStatus('error');
        setError('Conexão SSE perdida. Verifique o status no dashboard.');
      }
    };

    return () => es.close();
  };

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  const isRendering = ['queued', 'started', 'rendering'].includes(renderStatus);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="max-w-6xl mx-auto flex flex-col items-center"
    >
      <div className="w-full flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:text-white transition-colors uppercase text-xs font-semibold tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider">
          <span className="text-emerald-400">Etapa 4 de 5 — Preview</span>
        </div>
        <div className="w-24" />
      </div>

      <div className="flex-1 w-full flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12">

        {/* Preview do phone */}
        <div className="relative w-[220px] h-[440px] sm:w-[280px] sm:h-[560px] rounded-[2.5rem] bg-black border-[8px] border-[#1A1A1E] shadow-[0_0_50px_rgba(0,0,0,0.5),_inset_0_0_20px_rgba(255,255,255,0.05)] overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-50" />

          {videoUrl && renderStatus === 'completed' ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-cover"
                controls
                loop
                playsInline
                preload="auto"
                onCanPlay={() => setVideoLoading(false)}
                onProgress={() => {
                  const v = videoRef.current;
                  if (v && v.duration && v.buffered.length > 0) {
                    setVideoBuffered(Math.round((v.buffered.end(0) / v.duration) * 100));
                  }
                }}
              />
              {videoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-3">
                  <Loader2 className="w-8 h-8 text-[#7B61FF] animate-spin" />
                  <span className="text-xs text-gray-400">Carregando vídeo...</span>
                  {videoBuffered > 0 && (
                    <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7B61FF]" style={{ width: `${videoBuffered}%` }} />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : isRendering ? (
            /* Animação de renderizando */
            <div className="absolute inset-0 bg-[#0A0A0B] flex flex-col items-center justify-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-[#7B61FF]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#7B61FF] border-r-[#00E5FF] border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-t-[#00E5FF]/50 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-[#7B61FF] uppercase tracking-widest animate-pulse">Renderizando</span>
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-gradient-to-t from-[#7B61FF] to-[#00E5FF]"
                      style={{
                        height: `${12 + Math.random() * 20}px`,
                        animationName: 'none',
                        opacity: 0.6 + (i * 0.1),
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Estado idle — aguardando iniciar */
            <div className="absolute inset-0 bg-[#0A0A0B] flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7B61FF]/20 to-[#00E5FF]/20 border border-white/10 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-[#7B61FF]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white mb-1">Pronto para renderizar</p>
                <p className="text-xs text-gray-500 leading-relaxed">Clique em "Renderizar" para montar seu short</p>
              </div>
            </div>
          )}
        </div>

        {/* Painel de controle */}
        <div className="flex-1 w-full max-w-xl flex flex-col gap-6">

          <div>
            <h2 className="text-xl sm:text-3xl font-display font-bold mb-3">
              {renderStatus === 'completed' ? 'Vídeo Pronto! 🎉' : 'Renderizar o Short'}
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {renderStatus === 'completed'
                ? 'Seu short foi montado com Remotion e está pronto para exportação.'
                : 'Monte as cenas com suas imagens e áudio. As legendas são distribuídas pelo tempo do vídeo, com sincronização aproximada.'}
            </p>
          </div>

          {/* Detalhes do que vai renderizar */}
          {renderStatus === 'idle' && (
            <div className="bg-[#141415]/80 border border-[#ffffff1a] rounded-2xl p-5 space-y-3">
              <h4 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">O que será gerado</h4>
              {[
                '🎬 Cenas com Ken Burns (zoom cinematográfico)',
                '🎵 Áudio enviado por você',
                '✍️ Legendas animadas com tempo aproximado',
                '📱 Vídeo vertical 1080×1920 (9:16)',
                '🎞️ MP4 comprimido pronto para upload',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status da renderização */}
          {isRendering && (
            <div className="bg-[#141415]/80 border border-[#7B61FF]/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#7B61FF] animate-spin" />
                  <span className="font-semibold text-[#7B61FF]">Renderizando...</span>
                </div>
                {renderProgress > 0 && (
                  <span className="text-2xl font-display font-bold text-white">
                    {renderProgress}<span className="text-sm text-gray-400">%</span>
                  </span>
                )}
              </div>
              {renderProgress > 0 && (
                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#7B61FF] to-[#00E5FF] transition-all duration-300 rounded-full"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              )}
              <p className="text-sm text-gray-300">{renderMessage}</p>
              <p className="text-xs text-gray-500 mt-2">Não feche esta janela.</p>
            </div>
          )}

          {renderStatus === 'completed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400">Renderização concluída!</p>
                <p className="text-sm text-gray-400 mt-1">Vídeo disponível no preview ao lado.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          {/* Botões de ação */}
          {renderStatus !== 'completed' && (
            <button
              onClick={handleRender}
              disabled={isRendering}
              className="w-full flex items-center justify-center gap-2 px-8 py-5 rounded-2xl bg-gradient-to-r from-[#7B61FF] to-[#00E5FF] text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(123,97,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {isRendering ? (
                <><Loader2 className="w-6 h-6 animate-spin" /><span>Renderizando...</span></>
              ) : (
                <><Wand2 className="w-6 h-6" /><span>Renderizar Vídeo</span></>
              )}
            </button>
          )}

          {renderStatus === 'completed' && (
            <button
              onClick={onNext}
              className="w-full flex items-center justify-center gap-2 px-8 py-5 rounded-2xl bg-gradient-to-r from-[#00E5FF] to-[#7B61FF] text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(0,229,255,0.3)]"
            >
              <CheckCircle className="w-6 h-6" />
              <span>Ir para Exportação</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
