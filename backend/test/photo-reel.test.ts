import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validatePhotoReel} from '../src/services/photo-reel.service.js';
import {deletePhotoAssets} from '../src/services/media-cleanup.service.js';
import type {VideoEdit} from '../src/services/local.service.js';
const image={mimeType:'image/png',fileBase64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')};
const input={images:[image,image],caption:'Fotos do produto',watermark:'@loja'};
test('montagem valida quantidade, duração, música, transição, link e marca',()=>{
 const result=validatePhotoReel(input);assert.equal(result.seconds,3);assert.equal(result.transition,'fade');assert.equal(result.fit,'contain');assert.equal(result.music,null);
 for(const body of [{...input,images:[image]},{...input,images:Array(13).fill(image)},{...input,images:[null,image]},{...input,seconds_per_image:Infinity},{...input,seconds_per_image:1},{...input,music_volume:2},{...input,transition:'script'},{...input,watermark:''},{...input,auto_dm_enabled:true},{...input,music:{mimeType:'audio/wav',fileBase64:image.fileBase64}},{...input,affiliate_url:'javascript:alert(1)'}])assert.throws(()=>validatePhotoReel(body),e=>(e as {status:number}).status===400);
});
test('limpeza remove fotos e trilha somente da própria montagem e preserva logo',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'clipai-photo-clean-')),id=randomUUID();
 try{
  await mkdir(join(directory,'files/audio/photo-reels',id),{recursive:true});await mkdir(join(directory,'files/audio/logos'),{recursive:true});
  await writeFile(join(directory,'files/audio/photo-reels',id,'0.png'),'foto');await writeFile(join(directory,'files/audio/photo-reels',id,'music.wav'),'trilha');await writeFile(join(directory,'files/audio/logos','brand.png'),'logo');
  const job={id,photo_reel:{images:[`/api/files/audio/photo-reels/${id}/0.png`],music_url:`/api/files/audio/photo-reels/${id}/music.wav`},logo_url:'/api/files/audio/logos/brand.png'} as VideoEdit;
  await deletePhotoAssets(job,directory);await assert.rejects(access(join(directory,'files/audio/photo-reels',id,'0.png')));await assert.rejects(access(join(directory,'files/audio/photo-reels',id,'music.wav')));await access(join(directory,'files/audio/logos','brand.png'));
  await assert.rejects(deletePhotoAssets({...job,photo_reel:{...job.photo_reel!,images:['/api/files/audio/logos/brand.png']}},directory));await access(join(directory,'files/audio/logos','brand.png'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
