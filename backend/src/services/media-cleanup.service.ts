import {lstat,readdir,unlink} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {store,dataDirectory,type LocalStore,type VideoEdit} from './local.service.js';
import {readSettings} from './settings.service.js';
import {withMediaLock} from './media-lock.service.js';

const DAY=24*60*60*1000;
function expired(edit:VideoEdit,now:number){const time=Date.parse(edit.published_at??edit.publish_attempted_at??'');return edit.publish_state==='published'&&Number.isFinite(time)&&now-time>=DAY&&edit.status!=='processing'&&edit.status!=='queued';}
export async function safeUnlink(directory:string,path:string){
  const base=resolve(directory);const target=resolve(path);const pathRelative=relative(base,target);
  if(!pathRelative||pathRelative==='..'||pathRelative.startsWith('..'+sep)||resolve(base,pathRelative)!==target)throw new Error('Arquivo de limpeza fora do diretório de dados');
  let current=base;
  try{
    if((await lstat(base)).isSymbolicLink())throw new Error('Limpeza não permite diretório simbólico');
    for(const part of pathRelative.split(sep)){current=resolve(current,part);if((await lstat(current)).isSymbolicLink())throw new Error('Limpeza não permite links simbólicos');}
    if(!(await lstat(target)).isFile())throw new Error('Limpeza aceita somente arquivos');
    await unlink(target);
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
}
export async function originals(directory:string){
  const result=new Map<string,string>();const base=resolve(directory,'library');
  async function walk(folder:string,prefix=''){
    let entries;try{entries=await readdir(folder,{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
    for(const entry of entries){if(entry.isSymbolicLink())continue;const name=prefix?`${prefix}/${entry.name}`:entry.name;if(entry.isDirectory())await walk(resolve(folder,entry.name),name);else if(entry.isFile()&&/\.(mp4|mov|webm|m4v)$/i.test(name))result.set(createHash('sha256').update(name).digest('hex'),name);}
  }
  await walk(base);return result;
}
export async function deletePhotoAssets(edit:VideoEdit,directory=dataDirectory()){
  if(!edit.photo_reel)return;
  const prefix=`/api/files/audio/photo-reels/${edit.id}/`;
  for(const url of [...edit.photo_reel.images,...(edit.photo_reel.music_url?[edit.photo_reel.music_url]:[])]){
    if(!url.startsWith(prefix))throw new Error('Arquivo da montagem fora do diretório da edição');
    const name=url.slice(prefix.length);if(!/^(?:\d+\.(?:png|jpg|webp)|music\.(?:mp3|wav))$/.test(name)||!/^[0-9a-f-]{36}$/i.test(edit.id))throw new Error('Arquivo de montagem inválido');
    await safeUnlink(directory,resolve(directory,'files/audio/photo-reels',edit.id,name));
  }
}
export async function cleanupPublishedMedia(options:{database?:LocalStore;directory?:string;now?:number;removeOriginals?:boolean}={}){
  const database=options.database??store;const directory=options.directory??dataDirectory();const now=options.now??Date.now();
  return withMediaLock(async()=>{
    const db=await database.read();let outputs=0,sources=0;
    for(const edit of db.edits){
      if(!expired(edit,now)||edit.media_deleted_at||!edit.output_url)continue;
      if(!/^[0-9a-f-]{36}$/i.test(edit.id)||edit.output_url!==`/api/files/videos/edits/${edit.id}.mp4`)continue;
      // Never remove a file referenced by a different unfinished publication.
      if(db.edits.some(other=>other.id!==edit.id&&other.output_url===edit.output_url&&!expired(other,now)))continue;
      await safeUnlink(directory,resolve(directory,'files','videos','edits',`${edit.id}.mp4`));
      await deletePhotoAssets(edit,directory);
      await database.change(next=>{const item=next.edits.find(e=>e.id===edit.id);if(item){item.output_url=null;item.media_deleted_at=new Date(now).toISOString();}});outputs++;
    }
    if(options.removeOriginals){
      const map=await originals(directory);
      for(const [sourceId,path]of map){
        const references=db.edits.filter(e=>e.source_id===sourceId);
        if(!references.length||references.some(e=>!expired(e,now)))continue;
        await safeUnlink(directory,resolve(directory,'library',path));
        await database.change(next=>{for(const item of next.edits)if(item.source_id===sourceId)item.source_deleted_at=new Date(now).toISOString();});sources++;
      }
    }
    return {outputs,sources};
  });
}
export function startMediaCleanup(){
  let running=false;
  const tick=async()=>{if(running)return;running=true;try{
    const env=await readSettings();if(env.MEDIA_CLEANUP_ENABLED!=='true')return;
    const result=await cleanupPublishedMedia({removeOriginals:env.MEDIA_CLEANUP_ORIGINALS==='true'});
    if(result.outputs||result.sources)console.log(`Limpeza de mídia: ${result.outputs} MP4 e ${result.sources} originais removidos após 24h.`);
  }catch(e){console.error('Limpeza de mídia:',e instanceof Error?e.message:'Erro interno');}finally{running=false;}};
  void tick();const timer=setInterval(()=>void tick(),10*60000);timer.unref();return timer;
}
