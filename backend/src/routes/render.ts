import { route } from '../services/manual.service.js';
import { Router } from 'express';
import { enqueueRender, subscribeToRender, getQueueStatus } from '../queue/render.queue.js';
import { store, projectIn, problem } from '../services/local.service.js';

const router = Router({ mergeParams: true });

// POST /api/projects/:projectId/render — enfileira renderização
router.post('/', route(async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const cached = await store.change(db => {
    const project = projectIn(db,projectId,true);
    const metadata = db.export_metadata.find(m => m.project_id === projectId);
    if (project.status === 'completed' && metadata?.video_url) return metadata.video_url;
    const scenes = db.scenes.filter(s => s.project_id === projectId);
    if (!db.scripts.some(s => s.project_id === projectId) || !scenes.length || scenes.some(s => !s.image_url)) throw problem('Salve o roteiro e adicione uma imagem a cada cena antes de renderizar');
    project.status = 'rendering'; project.updated_at = new Date().toISOString(); return null;
  });
  if (cached) return res.json({ message: 'Vídeo já renderizado', videoUrl: cached });
  enqueueRender(projectId);

  return res.json({
    message: 'Renderização adicionada à fila',
    queue: getQueueStatus(),
  });
}));

// GET /api/projects/:projectId/render/status — status via SSE (Server-Sent Events)
router.get('/status', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Promise nativa também captura falhas de configuração síncronas.
  Promise.resolve().then(async () => {
    const project = projectIn(await store.read(), projectId);
    send({ type: 'current_status', status: project.status });
  }).catch(() => {
    send({ type: 'error', message: 'Falha ao consultar o projeto' });
    res.end();
  });

  const unsubscribe = subscribeToRender(projectId, (event) => {
    send(event);
    // Fecha a conexão SSE quando renderização terminar ou der erro
    if (event.type === 'completed' || event.type === 'error') {
      setTimeout(() => res.end(), 500);
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// GET /api/render/queue — status geral da fila
router.get('/queue', (_req, res) => {
  res.json(getQueueStatus());
});

export default router;
