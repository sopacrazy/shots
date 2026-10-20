import { Router } from 'express';
import { route, validateScript } from '../services/manual.service.js';
import { store, row, projectIn, invalidate } from '../services/local.service.js';
const router = Router({ mergeParams: true });
router.put('/', route(async (req,res) => {
  const id = String(req.params.projectId); const p = validateScript(req.body);
  await store.change(db => {
    const project = projectIn(db,id,true);
    const duration_seconds = p.scenes.reduce((n,s) => n + s.duration_seconds,0);
    const previous = db.scripts.find(s => s.project_id === id);
    const script = { ...(previous ?? row()), project_id: id, title: p.title, hook: p.hook, body: p.body, cta: p.cta, duration_seconds, voice_tone: 'manual', narration_speed: 'manual' };
    db.scripts = [...db.scripts.filter(s => s.project_id !== id), script];
    const scenes = p.scenes.map(s => ({ ...(db.scenes.find(old => old.project_id === id && old.scene_number === s.scene_number) ?? { ...row(), image_url: null, image_prompt: '' }), ...s, project_id: id }));
    db.scenes = [...db.scenes.filter(s => s.project_id !== id), ...scenes];
    const previousMeta = db.export_metadata.find(m => m.project_id === id);
    db.export_metadata = [...db.export_metadata.filter(m => m.project_id !== id), {
      ...(previousMeta ?? { ...row(), thumbnail_url: null, end_card_url: null, video_url: null }),
      project_id: id, video_title: p.title, description: p.description, hashtags: p.hashtags,
    }];
    project.title = p.title; invalidate(db,id,'script_ready');
  }); res.json({ saved: true });
}));
export default router;
