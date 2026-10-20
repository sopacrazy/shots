import { Router } from 'express';
import { route, upload, editableProject } from '../services/manual.service.js';
import { store, projectIn, invalidate, problem } from '../services/local.service.js';
const router = Router({ mergeParams: true });
router.put('/:sceneId', route(async (req,res) => {
  const id = String(req.params.projectId); await editableProject(id);
  const sceneId = String(req.params.sceneId);
  if (!(await store.read()).scenes.some(s => s.id === sceneId && s.project_id === id)) throw problem('Cena não encontrada neste projeto',404);
  const url = await upload(id,req.body,'image',`scene-${sceneId}`);
  res.json(await store.change(db => {
    projectIn(db,id,true);
    const scene = db.scenes.find(s => s.id === sceneId && s.project_id === id); if (!scene) throw problem('Cena não encontrada',404);
    scene.image_url = url; invalidate(db,id,'images_ready'); return scene;
  }));
}));
export default router;
