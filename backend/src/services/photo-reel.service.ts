import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {store,saveFile,localMediaPath,problem,dataDirectory,type VideoEdit} from './local.service.js';
import {text,validateUpload} from './manual.service.js';
import {affiliateUrl,publicationCaption} from './publication.service.js';
import {enqueueEdit,ffmpegPath} from './video.service.js';
import {withMediaLock} from './media-lock.service.js';
import {safeUnlink} from './media-cleanup.service.js';
const exec=promisify(execFile);
export function validatePhotoReel(body:Record<string,unknown>){
  if(!Array.isArray(body.images)||body.images.length<2||body.images.length>12)throw problem('Envie de 2 a 12 fotos PNG, JPEG ou WebP');
  if(body.images.some(image=>!image||typeof image!=='object')||body.music&&typeof body.music!=='object'||body.logo&&typeof body.logo!=='object')throw problem('Arquivos inválidos');
  const images=body.images.map(image=>validateUpload(image,'image'));
  if(images.some(i=>i.buffer.length>5*1024*1024))throw problem('Cada foto deve ter até 5 MB');
  const music=body.music?validateUpload(body.music as Record<string,unknown>,'audio'):null;
  if(music&&music.buffer.length>12*1024*1024)throw problem('A música deve ter até 12 MB');
  const logo=body.logo?validateUpload(body.logo as Record<string,unknown>,'image'):null;
  if(images.reduce((n,i)=>n+i.buffer.length,0)+(music?.buffer.length??0)+(logo?.buffer.length??0)>30*1024*1024)throw problem('Fotos, música e logo juntos devem ter até 30 MB');
  const seconds=Number(body.seconds_per_image??3),volume=Number(body.music_volume??.45),transition=body.transition??'fade',fit=body.fit??'contain';
  if(!Number.isFinite(seconds)||seconds<2||seconds>8||!Number.isFinite(volume)||volume<0||volume>1||!['fade','slide'].includes(String(transition))||!['contain','cover'].includes(String(fit)))throw problem('Configurações de duração, transição ou música inválidas');
  const caption=text(body.caption??'','Descrição',2200);if(!caption)throw problem('Escreva a descrição do produto');
  const affiliate=affiliateUrl(body.affiliate_url);publicationCaption(caption,affiliate);
  const watermark=text(body.watermark??'','Marca d’água',60),position=String(body.watermark_position??'top-right');
  if(!['top-left','top-right','bottom-left','bottom-right'].includes(position))throw problem('Posição inválida');
  if(!watermark&&!logo&&!body.existing_logo_url)throw problem('Adicione texto ou logo para sua marca d’água');
  if(body.auto_dm_enabled!==undefined&&typeof body.auto_dm_enabled!=='boolean')throw problem('Opção de Direct inválida');
  if(body.auto_dm_enabled===true&&!affiliate)throw problem('Adicione o link de afiliado para ativar o Direct');
  return {images,music,logo,seconds,volume,transition:transition as 'fade'|'slide',fit:fit as 'contain'|'cover',caption,affiliate,watermark,position:position as VideoEdit['watermark_position'],title:text(body.title??'Reel com fotos','Nome do vídeo',100)||'Reel com fotos'};
}
export async function createPhotoReel(body:Record<string,unknown>){
 return withMediaLock(async()=>{
  const input=validatePhotoReel(body),id=randomUUID(),paths:string[]=[];
  const db=await store.read();let logoUrl:string|null=null;
  if(body.existing_logo_url){if(db.brand?.logo_url!==body.existing_logo_url&&!db.edits.some(e=>e.logo_url===body.existing_logo_url))throw problem('Logo salvo não encontrado');logoUrl=String(body.existing_logo_url);}
  try{
   const images:string[]=[];
   for(const [i,image]of input.images.entries()){
    const url=await saveFile('audio',`photo-reels/${id}/${i}.${image.ext}`,image.buffer);paths.push(url);
    const {stdout}=await exec(ffmpegPath('ffprobe'),['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',localMediaPath(url)],{timeout:15000});
    const stream=JSON.parse(stdout).streams?.[0];if(!stream?.width||!stream.height||stream.width>8192||stream.height>8192||stream.width*stream.height>40000000)throw problem('Uma foto está inválida ou excede 40 megapixels / 8192 pixels por lado');
    images.push(url);
   }
   let musicUrl:string|null=null;
   if(input.music){musicUrl=await saveFile('audio',`photo-reels/${id}/music.${input.music.ext}`,input.music.buffer);paths.push(musicUrl);
    const {stdout}=await exec(ffmpegPath('ffprobe'),['-v','error','-select_streams','a:0','-show_entries','stream=codec_type','-show_entries','format=duration','-of','json',localMediaPath(musicUrl)],{timeout:15000});
    const meta=JSON.parse(stdout);if(!meta.streams?.length||!Number.isFinite(Number(meta.format?.duration))||Number(meta.format.duration)<=0)throw problem('Música inválida. Use MP3 ou WAV com áudio.');
   }
   if(input.logo){logoUrl=await saveFile('audio',`logos/${randomUUID()}.${input.logo.ext}`,input.logo.buffer);paths.push(logoUrl);}
   const edit:VideoEdit={id,created_at:new Date().toISOString(),source_id:`photos:${id}`,source_name:input.title,category:'Reels com fotos',caption:input.caption,affiliate_url:input.affiliate,watermark:input.watermark,watermark_position:input.position,logo_url:logoUrl,output_url:null,status:'queued',error:null,publish_state:'idle',auto_dm_enabled:body.auto_dm_enabled as boolean|undefined??!!input.affiliate,photo_reel:{images,music_url:musicUrl,seconds_per_image:input.seconds,transition:input.transition,music_volume:input.volume,fit:input.fit}};
   await store.change(next=>{next.edits.push(edit);next.brand={watermark:edit.watermark,watermark_position:edit.watermark_position,logo_url:logoUrl};});enqueueEdit(id);return edit;
  }catch(error){for(const url of paths)await safeUnlink(dataDirectory(),resolve(localMediaPath(url))).catch(()=>{});if((error as {status?:number}).status)throw error;throw problem('Não foi possível ler as fotos ou a música. Confira os arquivos e tente novamente.');}
 });
}
