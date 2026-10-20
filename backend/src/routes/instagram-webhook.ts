import express,{Router} from 'express';
import {route} from '../services/manual.service.js';
import {readAutomationConfig,constantEqual,verifyWebhookSignature,acceptCommentEvents,scheduleCommentReplies,markWebhookVerified} from '../services/comment-automation.service.js';
const router=Router();
router.get('/',route(async(req,res)=>{
  const settings=await readAutomationConfig();
  if(!settings?.verifyToken||req.query['hub.mode']!=='subscribe'||typeof req.query['hub.verify_token']!=='string'||typeof req.query['hub.challenge']!=='string'||!constantEqual(settings.verifyToken,req.query['hub.verify_token']))return void res.sendStatus(403);
  await markWebhookVerified();res.type('text/plain').send(req.query['hub.challenge']);
}));
router.post('/',express.raw({type:'application/json',limit:'1mb'}),route(async(req,res)=>{
  const settings=await readAutomationConfig();
  if(!settings)return void res.sendStatus(503);
  if(!Buffer.isBuffer(req.body)||!verifyWebhookSignature(req.body,req.get('x-hub-signature-256'),settings.appSecret))return void res.sendStatus(403);
  let payload:unknown;try{payload=JSON.parse(req.body.toString('utf8'));}catch{return void res.sendStatus(400);}
  const ids=await acceptCommentEvents(payload);
  res.sendStatus(200);scheduleCommentReplies(ids);
}));
export default router;
