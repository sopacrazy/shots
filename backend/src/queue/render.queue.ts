import PQueue from 'p-queue';
import { renderVideo } from '../workers/render.worker.js';
import { store } from '../services/local.service.js';

// Máximo 1 renderização simultânea (Chrome headless é pesado)
const queue = new PQueue({ concurrency: 1 });

// Map de listeners SSE por projectId
const sseClients = new Map<string, Set<(data: RenderEvent) => void>>();

export interface RenderEvent {
  type: 'queued' | 'started' | 'progress' | 'completed' | 'error';
  projectId: string;
  message: string;
  videoUrl?: string;
  queueSize?: number;
  progress?: number;
}

export function subscribeToRender(
  projectId: string,
  callback: (event: RenderEvent) => void
): () => void {
  if (!sseClients.has(projectId)) {
    sseClients.set(projectId, new Set());
  }
  sseClients.get(projectId)!.add(callback);

  // Retorna função de unsubscribe
  return () => {
    sseClients.get(projectId)?.delete(callback);
    if (!sseClients.get(projectId)?.size) sseClients.delete(projectId);
  };
}

function emit(event: RenderEvent) {
  const clients = sseClients.get(event.projectId);
  if (clients) {
    clients.forEach((cb) => cb(event));
  }
}

export function enqueueRender(projectId: string): void {
  const position = queue.size + queue.pending + 1;

  emit({
    type: 'queued',
    projectId,
    message: `Na fila — posição ${position}`,
    queueSize: queue.size,
  });

  queue.add(async () => {
    emit({ type: 'started', projectId, message: 'Renderização iniciada...' });

    try {
      const videoUrl = await renderVideo(projectId, (pct) => {
        emit({ type: 'progress', projectId, message: `Renderizando... ${pct}%`, progress: pct });
      });

      emit({
        type: 'completed',
        projectId,
        message: 'Vídeo renderizado com sucesso!',
        videoUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`[Queue] Erro ao renderizar ${projectId}:`, message);

      try {
        await store.change(db => {
          const p = db.projects.find(p => p.id === projectId);
          if (p) { p.status = 'error'; p.updated_at = new Date().toISOString(); }
        });
      } catch { /* ignora erro de atualização */ }

      emit({ type: 'error', projectId, message });
    }
  });
}

export function getQueueStatus() {
  return {
    pending: queue.size,
    running: queue.pending,
    isPaused: queue.isPaused,
  };
}
