import { Router } from 'express';
import { route, upload, editableProject, text } from '../services/manual.service.js';
import { store, row, projectIn, invalidate, removeProjectFiles, problem } from '../services/local.service.js';
const router = Router();
router.get('/', route(async (req, res) => {
  const db = await store.read();
  let projects = db.projects;
  if (req.query.folder_id === 'none') projects = projects.filter(p => !p.folder_id);
  else if (req.query.folder_id) projects = projects.filter(p => p.folder_id === req.query.folder_id);
  res.json(projects.sort((a,b) => b.created_at.localeCompare(a.created_at)).map(p => ({ ...p,
    thumbnail_url: db.export_metadata.find(m => m.project_id === p.id)?.thumbnail_url ?? db.scenes.filter(s => s.project_id === p.id && s.image_url).sort((a,b) => a.scene_number-b.scene_number)[0]?.image_url ?? null,
  })));
}));
router.get('/:id', route(async (req, res) => {
  const id = String(req.params.id); const db = await store.read();
  res.json({ project: projectIn(db, id), script: db.scripts.find(s => s.project_id === id) ?? null,
    scenes: db.scenes.filter(s => s.project_id === id).sort((a,b) => a.scene_number-b.scene_number),
    narration: db.narrations.filter(n => n.project_id === id).at(-1) ?? null,
    metadata: db.export_metadata.find(m => m.project_id === id) ?? null,
  });
}));
router.post('/', route(async (req, res) => {
  const topic = text(req.body.topic, 'Tema', 200); if (!topic) throw problem('Tema é obrigatório');
  const niche = text(req.body.niche ?? '', 'Categoria', 100) || null;
  const project = await store.change(db => {
    const p = { ...row(), title: null, topic, niche, folder_id: null, status: 'draft' as const, updated_at: new Date().toISOString() };
    db.projects.push(p); return p;
  }); res.status(201).json(project);
}));
router.patch('/:id/folder', route(async (req, res) => {
  res.json(await store.change(db => {
    const project = projectIn(db, String(req.params.id));
    const id = req.body.folder_id ?? null;
    if (id !== null && !db.folders.some(f => f.id === id)) throw problem('Pasta não encontrada', 404);
    project.folder_id = id; project.updated_at = new Date().toISOString(); return project;
  }));
}));
for (const field of ['endcard','thumbnail'] as const) {
  router.post(`/:id/${field}`, route(async (req, res) => {
    const id = String(req.params.id); await editableProject(id);
    if (!(await store.read()).export_metadata.some(m => m.project_id === id)) throw problem('Salve o roteiro primeiro');
    const url = await upload(id, req.body, 'image', field);
    await store.change(db => {
      projectIn(db, id, true);
      const meta = db.export_metadata.find(m => m.project_id === id); if (!meta) throw problem('Salve o roteiro primeiro');
      if (field === 'endcard') { meta.end_card_url = url; invalidate(db,id,'images_ready'); } else meta.thumbnail_url = url;
    }); res.json({ url, [field === 'endcard' ? 'end_card_url' : 'thumbnail_url']: url });
  }));
}
router.delete('/:id', route(async (req, res) => {
  const id = String(req.params.id);
  await store.change(db => {
    projectIn(db,id,true);
    db.projects = db.projects.filter(p => p.id !== id);
    db.scripts = db.scripts.filter(p => p.project_id !== id);
    db.scenes = db.scenes.filter(p => p.project_id !== id);
    db.narrations = db.narrations.filter(p => p.project_id !== id);
    db.export_metadata = db.export_metadata.filter(p => p.project_id !== id);
  });
  await removeProjectFiles(id); res.status(204).send();
}));
export default router;
