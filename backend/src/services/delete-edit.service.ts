import {resolve} from 'node:path';
import {store,dataDirectory,problem,type LocalStore} from './local.service.js';
import {safeUnlink,originals,deletePhotoAssets} from './media-cleanup.service.js';
import {withMediaLock} from './media-lock.service.js';
import {blockingSchedules} from './scheduler.service.js';

export async function deleteLibraryVideo(id:string,options:{database?:LocalStore;directory?:string}={}){
  return withMediaLock(async()=>{
    const database=options.database??store,directory=options.directory??dataDirectory();
    const path=(await originals(directory)).get(id);if(!path)throw problem('Vídeo não encontrado na biblioteca',404);
    const db=await database.read();
    if(db.edits.some(e=>e.source_id===id&&['queued','processing'].includes(e.status)))throw problem('Este vídeo está sendo editado. Aguarde a edição terminar antes de excluir o original.',409);
    await safeUnlink(directory,resolve(directory,'library',path));
    await database.change(next=>{for(const edit of next.edits)if(edit.source_id===id)edit.source_deleted_at=new Date().toISOString();});
    return {deleted:true};
  });
}

export async function deleteEdit(id:string,mode:'media'|'edit',options:{database?:LocalStore;directory?:string;scheduled?:()=>Promise<{edit_id:string;state:string}[]>}={}){
  return withMediaLock(async()=>{
    const database=options.database??store,directory=options.directory??dataDirectory();
    const schedules=await (options.scheduled??blockingSchedules)();
    if(schedules.some(s=>s.edit_id===id&&['scheduled','dispatching','processing','unknown'].includes(s.state)))throw problem('Cancele o agendamento ou confira a publicação antes de excluir',409);
    const now=new Date().toISOString();
    const job=await database.change(db=>{
      const edit=db.edits.find(e=>e.id===id);if(!edit)throw problem('Edição não encontrada',404);
      if(['queued','processing'].includes(edit.status)||['processing','unknown'].includes(edit.publish_state))throw problem('Aguarde o processamento ou confira a publicação antes de excluir',409);
      if(mode==='media'&&edit.publish_state!=='published')throw problem('Esta opção é somente para vídeos publicados',409);
      if(!/^[0-9a-f-]{36}$/i.test(id)||(edit.output_url&&edit.output_url!==`/api/files/videos/edits/${id}.mp4`))throw problem('Caminho do vídeo inválido',409);
      const snapshot={...edit};
      edit.output_url=null;edit.media_deleted_at=now;
      return snapshot;
    });
    try{await safeUnlink(directory,resolve(directory,'files/videos/edits',`${id}.mp4`));}
    catch(error){await database.change(db=>{const edit=db.edits.find(e=>e.id===id);if(edit){edit.output_url=job.output_url;edit.media_deleted_at=job.media_deleted_at;}});throw error;}
    await deletePhotoAssets(job,directory);
    let sourceDeleted=false;
    if(mode==='media'){
      const db=await database.read();
      if(!db.edits.some(e=>e.source_id===job.source_id&&(e.publish_state!=='published'||['queued','processing'].includes(e.status)))){
        const path=(await originals(directory)).get(job.source_id);
        if(path){await safeUnlink(directory,resolve(directory,'library',path));sourceDeleted=true;
          await database.change(next=>{for(const e of next.edits)if(e.source_id===job.source_id)e.source_deleted_at=now;});}
      }
    }
    if(mode==='edit')await database.change(db=>{if(job.publish_state!=='published')db.edits=db.edits.filter(e=>e.id!==id);else{const edit=db.edits.find(e=>e.id===id);if(edit)edit.hidden_at=now;}});
    return {deleted:true,sourceDeleted,originalPreserved:mode==='edit'||!sourceDeleted};
  });
}
