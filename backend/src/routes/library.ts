import { affiliateUrl, publicationCaption } from '../services/publication.service.js';
import {withMediaLock} from '../services/media-lock.service.js';
import {deleteEdit,deleteLibraryVideo} from '../services/delete-edit.service.js';
import {createPhotoReel} from '../services/photo-reel.service.js';
import express, { Router } from 'express';
import { route, text, validateUpload } from '../services/manual.service.js';
import { listVideos, importVideo, newEdit, enqueueEdit } from '../services/video.service.js';
import { store, saveFile, problem, type VideoEdit } from '../services/local.service.js';
const router=Router();
router.get('/brand',route(async(_req,res)=>{
  const db=await store.read();const last=db.edits.at(-1);
  res.json(db.brand??{watermark:last?.watermark??'',watermark_position:last?.watermark_position??'top-right',logo_url:last?.logo_url??null});
}));
router.put('/brand',route(async(req,res)=>{
  const watermark=text(req.body.watermark??'','Marca d’água',60);
  const position=req.body.watermark_position??'top-right';
  if(!['top-left','top-right','bottom-left','bottom-right'].includes(position))throw problem('Posição inválida');
  let logo_url:string|null=null;
  if(req.body.existing_logo_url){const db=await store.read();if(db.brand?.logo_url!==req.body.existing_logo_url&&!db.edits.some(e=>e.logo_url===req.body.existing_logo_url))throw problem('Imagem da marca não encontrada');logo_url=req.body.existing_logo_url;}
  if(req.body.logo){const {buffer,ext}=validateUpload(req.body.logo,'image');logo_url=await saveFile('audio',`logos/${crypto.randomUUID()}.${ext}`,buffer);}
  const brand={watermark,watermark_position:position,logo_url};
  await store.change(db=>{db.brand=brand;});res.json(brand);
}));
router.get('/library',route(async(_req,res)=>{res.json(await listVideos());}));
router.delete('/library/:id',route(async(req,res)=>{res.json(await deleteLibraryVideo(String(req.params.id)));}));
router.post('/library',express.raw({type:'application/octet-stream',limit:'250mb'}),route(async(req,res)=>{
  if(!Buffer.isBuffer(req.body)) throw problem('Envie o arquivo como application/octet-stream');
  res.status(201).json(await importVideo(String(req.query.category??'Sem categoria'),String(req.query.name??''),req.body));
}));
router.get('/edits',route(async(_req,res)=>{res.json((await store.read()).edits.filter(e=>!e.hidden_at).reverse());}));
router.post('/photo-reels',route(async(req,res)=>{res.status(202).json(await createPhotoReel(req.body??{}));}));
router.delete('/edits/:id/media',route(async(req,res)=>{res.json(await deleteEdit(String(req.params.id),'media'));}));
router.delete('/edits/:id',route(async(req,res)=>{res.json(await deleteEdit(String(req.params.id),'edit'));}));
router.get('/edits/:id',route(async(req,res)=>{const job=(await store.read()).edits.find(e=>e.id===req.params.id);if(!job)throw problem('Edição não encontrada',404);res.json(job);}));
router.post('/edits',route(async(req,res)=>withMediaLock(async()=>{
  const source=(await listVideos()).find(v=>v.id===req.body.source_id);if(!source)throw problem('Selecione um vídeo da biblioteca');
  const caption=text(req.body.caption??'','Descrição',2200);if(!caption)throw problem('Escreva a descrição do produto');
  const affiliate_url=affiliateUrl(req.body.affiliate_url);
  publicationCaption(caption,affiliate_url);
  if(req.body.auto_dm_enabled!==undefined&&typeof req.body.auto_dm_enabled!=='boolean')throw problem('Opção de Direct inválida');
  if(req.body.auto_dm_enabled===true&&!affiliate_url)throw problem('Adicione o link de afiliado para ativar o Direct');
  const watermark=text(req.body.watermark??'','Marca d’água',60);
  const position=req.body.watermark_position??'top-right';
  if(!['top-left','top-right','bottom-left','bottom-right'].includes(position))throw problem('Posição inválida');
  let logo_url: string|null=null;
  if(req.body.existing_logo_url) {
    const db=await store.read();
    const known=db.brand?.logo_url===req.body.existing_logo_url||db.edits.some(e=>e.logo_url===req.body.existing_logo_url);
    if(!known)throw problem('Imagem da marca d’água não encontrada');
    logo_url=req.body.existing_logo_url;
  }
  if(req.body.logo) {const {buffer,ext}=validateUpload(req.body.logo,'image');logo_url=await saveFile('audio',`logos/${crypto.randomUUID()}.${ext}`,buffer);}
  if(!watermark&&!logo_url)throw problem('Informe o texto da marca d’água ou envie um logo');
  const edit=newEdit(source,caption,watermark,position as VideoEdit['watermark_position'],logo_url,affiliate_url);
  edit.auto_dm_enabled=req.body.auto_dm_enabled??!!affiliate_url;
  await store.change(db=>{db.edits.push(edit);db.brand={watermark,watermark_position:position,logo_url};});enqueueEdit(edit.id);res.status(202).json(edit);
})));
export default router;
