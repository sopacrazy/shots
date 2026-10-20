import { Router } from 'express';
import { route, upload, editableProject } from '../services/manual.service.js';
import { store, projectIn, row, invalidate, problem } from '../services/local.service.js';
const router = Router({ mergeParams: true });
router.put('/', route(async (req,res) => {
  const id = String(req.params.projectId); await editableProject(id);
  if (!(await store.read()).scripts.some(s => s.project_id === id)) throw problem('Salve o roteiro primeiro');
  const audio_url = await upload(id,req.body,'audio','narration');
  res.json(await store.change(db => {
    projectIn(db,id,true);
    const script = db.scripts.find(s => s.project_id === id); if (!script) throw problem('Roteiro não encontrado');
    const narration = { ...row(), project_id: id, audio_url, voice_id: 'manual', script_text: `${script.hook} ${script.body} ${script.cta}`, duration_seconds: null };
    db.narrations.push(narration); invalidate(db,id,'narration_ready'); return narration;
  }));
}));
export default router;
