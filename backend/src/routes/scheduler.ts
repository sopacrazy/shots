import {Router} from 'express';
import {route} from '../services/manual.service.js';
import {listSchedules,createSchedule,cancelSchedule} from '../services/scheduler.service.js';
const router=Router();
router.get('/',route(async(_req,res)=>{res.json(await listSchedules());}));
router.post('/',route(async(req,res)=>{res.status(201).json(await createSchedule(req.body??{}));}));
router.delete('/:id',route(async(req,res)=>{await cancelSchedule(String(req.params.id));res.sendStatus(204);}));
export default router;
