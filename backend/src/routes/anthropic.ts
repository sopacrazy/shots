import {Router} from 'express';
import {route} from '../services/manual.service.js';
import {anthropicStatus,saveAnthropic,generateDescription} from '../services/anthropic.service.js';
const router=Router();
router.get('/status',route(async(_req,res)=>{res.json(await anthropicStatus());}));
router.post('/settings',route(async(req,res)=>{res.json(await saveAnthropic(req.body??{}));}));
router.post('/description',route(async(req,res)=>{res.json(await generateDescription(req.body??{}));}));
export default router;
