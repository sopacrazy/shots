import {startCommentAutomation} from './services/comment-automation.service.js';
import instagramWebhook from './routes/instagram-webhook.js';
import './env.js';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { store, dataDirectory } from './services/local.service.js';
import { resolve } from 'node:path';
import { route } from './services/manual.service.js';
import {initializeEnvironment} from './services/settings.service.js';
import {startScheduler} from './services/scheduler.service.js';
import {startMediaCleanup} from './services/media-cleanup.service.js';
import schedulerRouter from './routes/scheduler.js';
import shopeeRouter from './routes/shopee.js';

import instagramRouter from './routes/instagram.js';
import anthropicRouter from './routes/anthropic.js';
import libraryRouter from './routes/library.js';
import projectsRouter from './routes/projects.js';

import scriptsRouter from './routes/scripts.js';
import narrationRouter from './routes/narration.js';
import imagesRouter from './routes/images.js';
import renderRouter from './routes/render.js';
import foldersRouter from './routes/folders.js';


const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

// Webhook público: assinatura verificada sobre os bytes originais, antes do parser JSON.
app.use('/api/instagram/webhook', instagramWebhook);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin === o.trim())) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// O endereço público usado pelo Instagram só precisa dos arquivos.
// Comandos de edição/publicação ficam restritos ao host local.
app.use('/api', (req,res,next) => {
  if (req.path.startsWith('/files/')) return next();
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(req.headers.host ?? '')) return void res.status(403).json({ error: 'Esta API é de uso local' });
  next();
});
app.use(express.json({ limit: '50mb' }));

// Express fornece Content-Type, requests Range e streaming de áudio/vídeo.
app.use('/api/files/library', express.static(resolve(dataDirectory(), 'library'), { dotfiles: 'deny', index: false }));
app.use('/api/files', express.static(resolve(dataDirectory(), 'files'), { dotfiles: 'deny', index: false, setHeaders: res => { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));
app.get('/api/health', route(async (_req,res) => {
  await store.read();
  res.json({ status: 'ok', services: { manual: true, local: true } });
}));

app.get('/api/voices', (_req, res) => { res.json([]); });

app.use('/api', libraryRouter);
app.use('/api/instagram', instagramRouter);
app.use('/api/ai', anthropicRouter);
app.use('/api/schedules', schedulerRouter);
app.use('/api/shopee', shopeeRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/script', scriptsRouter);
app.use('/api/projects/:projectId/narration', narrationRouter);
app.use('/api/projects/:projectId/images', imagesRouter);
app.use('/api/projects/:projectId/render', renderRouter);
app.use('/api/render', renderRouter);

// Express 4 precisa encaminhar rejeições de handlers assíncronos.
const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err instanceof Error ? err.message : 'Erro no backend');
  if (res.headersSent) { res.end(); return; }
  res.status(err.status ?? 500).json({ error: err instanceof Error ? err.message : 'Erro no backend' });
};
app.use(errors);

// Testes e integrações podem importar o app sem abrir uma porta.
if (process.env.NODE_ENV !== 'test') {
  initializeEnvironment().then(()=>store.read()).then(() => {
    void startCommentAutomation().catch(err=>console.error('Falha ao retomar automação:',err.message));
    startScheduler();
    startMediaCleanup();
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`\nClipai Backend: http://localhost:${PORT}`);
      console.log(`Dados e arquivos locais: ${dataDirectory()}`);
    });
  }).catch(err => { console.error('Falha ao abrir os dados locais:', err.message); process.exitCode = 1; });
}

export default app;
