import {automationStatus,saveAutomation,subscribeComments,startCommentAutomation,simulateCommentReply} from '../services/comment-automation.service.js';
import {store,problem} from '../services/local.service.js';
import {Router} from 'express';
import {route} from '../services/manual.service.js';
import {instagramStatus,connectInstagram,publishEdit} from '../services/instagram.service.js';
const router=Router();
router.post('/automation/simulate',route(async(req,res)=>{res.json(await simulateCommentReply(req.body));}));
router.get('/automation',route(async(_req,res)=>{res.json(await automationStatus());}));
router.post('/automation',route(async(req,res)=>{res.json(await saveAutomation(req.body));}));
router.post('/automation/subscribe',route(async(_req,res)=>{res.json(await subscribeComments());}));
router.patch('/automation/edits/:id',route(async(req,res)=>{
  if(typeof req.body.enabled!=='boolean')throw problem('Informe se o Direct está ativado');
  const result=await store.change(db=>{const edit=db.edits.find(e=>e.id===req.params.id);if(!edit)throw problem('Edição não encontrada',404);if(req.body.enabled&&!edit.affiliate_url)throw problem('Este produto não tem link de afiliado');edit.auto_dm_enabled=req.body.enabled;return edit;});if(req.body.enabled)await startCommentAutomation();res.json(result);
}));
router.get('/status',route(async(_req,res)=>{res.json(await instagramStatus());}));
router.post('/connect',route(async(req,res)=>{res.json(await connectInstagram(req.body));}));
router.post('/publish/:id',route(async(req,res)=>{res.status(202).json(await publishEdit(String(req.params.id)));}));
export default router;
