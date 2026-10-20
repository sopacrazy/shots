import { Router } from 'express';
import { route, text } from '../services/manual.service.js';
import { store, row, problem } from '../services/local.service.js';
const router = Router();
router.get('/', route(async (_req,res) => { res.json((await store.read()).folders); }));
router.post('/', route(async (req,res) => {
  const name = text(req.body.name, 'Nome', 100); if (!name) throw problem('Nome é obrigatório');
  const folder = await store.change(db => {
    const f = { ...row(), name, emoji: text(req.body.emoji ?? '📁','Ícone',20), color: text(req.body.color ?? '#7B61FF','Cor',30), default_voice_id: null, default_language: 'pt' };
    db.folders.push(f); return f;
  }); res.status(201).json(folder);
}));
router.patch('/:id', route(async (req,res) => {
  res.json(await store.change(db => {
    const f = db.folders.find(f => f.id === req.params.id); if (!f) throw problem('Pasta não encontrada',404);
    if (req.body.name !== undefined) { f.name = text(req.body.name,'Nome',100); if (!f.name) throw problem('Nome é obrigatório'); }
    if (req.body.emoji !== undefined) f.emoji = text(req.body.emoji,'Ícone',20);
    if (req.body.color !== undefined) f.color = text(req.body.color,'Cor',30);
    return f;
  }));
}));
router.delete('/:id', route(async (req,res) => {
  await store.change(db => {
    if (!db.folders.some(f => f.id === req.params.id)) throw problem('Pasta não encontrada',404);
    db.folders = db.folders.filter(f => f.id !== req.params.id);
    for (const p of db.projects) if (p.folder_id === req.params.id) p.folder_id = null;
  }); res.status(204).send();
}));
export default router;
