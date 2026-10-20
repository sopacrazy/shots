import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {LocalStore,type VideoEdit} from '../src/services/local.service.js';
import {deleteEdit,deleteLibraryVideo} from '../src/services/delete-edit.service.js';
import {cleanupPublishedMedia} from '../src/services/media-cleanup.service.js';
const now=Date.now();const DAY=24*60*60*1000;
function edit(source:string,state:VideoEdit['publish_state'],age:number):VideoEdit{
  const id=randomUUID();return {id,created_at:new Date(now-10*DAY).toISOString(),source_id:source,source_name:'produto.mp4',category:'Produtos',caption:'Descrição',affiliate_url:'https://loja.example/?ref=abc',watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:`/api/files/videos/edits/${id}.mp4`,status:'ready',error:null,publish_state:state,published_at:new Date(now-age).toISOString(),instagram_media_id:'123',instagram_account_id:'456',auto_dm_enabled:true};
}
test('limpa somente MP4 confirmado há 24h; mantém histórico, links, originais pendentes e logos',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'clipai-cleanup-'));const database=new LocalStore(directory);
  try{
    await mkdir(join(directory,'files/videos/edits'),{recursive:true});await mkdir(join(directory,'library/Produtos'),{recursive:true});await mkdir(join(directory,'files/audio/logos'),{recursive:true});
    const path='Produtos/original.mp4';const source=createHash('sha256').update(path).digest('hex');
    await writeFile(join(directory,'library',path),'original');await writeFile(join(directory,'files/audio/logos/brand.png'),'logo');
    const old=edit(source,'published',DAY+1),recent=edit('recent','published',DAY-1),future=edit(source,'idle',10*DAY),failed=edit('failed','error',10*DAY),unknown=edit('unknown','unknown',10*DAY),undated=edit('undated','published',10*DAY);
    delete undated.published_at;
    const edits=[old,recent,future,failed,unknown,undated];
    for(const e of edits)await writeFile(join(directory,'files/videos/edits',`${e.id}.mp4`),'mp4');
    await database.change(db=>{db.edits.push(...edits);});
    assert.deepEqual(await cleanupPublishedMedia({database,directory,now,removeOriginals:true}),{outputs:1,sources:0});
    await assert.rejects(access(join(directory,'files/videos/edits',`${old.id}.mp4`)));
    for(const e of edits.slice(1))await access(join(directory,'files/videos/edits',`${e.id}.mp4`));
    assert.equal(await readFile(join(directory,'library',path),'utf8'),'original');assert.equal(await readFile(join(directory,'files/audio/logos/brand.png'),'utf8'),'logo');
    const saved=(await database.read()).edits.find(e=>e.id===old.id)!;assert.equal(saved.output_url,null);assert.ok(saved.media_deleted_at);assert.equal(saved.affiliate_url,old.affiliate_url);assert.equal(saved.instagram_media_id,'123');assert.equal(saved.auto_dm_enabled,true);
    await database.change(db=>{const e=db.edits.find(e=>e.id===future.id)!;e.publish_state='published';e.published_at=new Date(now-DAY-1).toISOString();});
    assert.deepEqual(await cleanupPublishedMedia({database,directory,now,removeOriginals:true}),{outputs:1,sources:1});await assert.rejects(access(join(directory,'library',path)));
    assert.deepEqual(await cleanupPublishedMedia({database,directory,now,removeOriginals:true}),{outputs:0,sources:0});
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('não apaga caminho arbitrário nem usa a data de criação como confirmação de publicação',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'clipai-cleanup-path-'));const database=new LocalStore(directory);
  try{
    await mkdir(join(directory,'files/videos/edits'),{recursive:true});await writeFile(join(directory,'protected.mp4'),'preservado');
    const job=edit('src','published',DAY+1);job.output_url='/api/files/videos/../../protected.mp4';
    await database.change(db=>{db.edits.push(job);});
    assert.deepEqual(await cleanupPublishedMedia({database,directory,now}),{outputs:0,sources:0});assert.equal(await readFile(join(directory,'protected.mp4'),'utf8'),'preservado');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('exclusão manual preserva Reel e Direct, protege agendamentos e separa edição de original',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'clipai-delete-')),database=new LocalStore(directory);
 const options={database,directory,scheduled:async()=>[]};
 try{
  await mkdir(join(directory,'files/videos/edits'),{recursive:true});await mkdir(join(directory,'library/Produtos'),{recursive:true});
  const path='Produtos/original.mp4',source=createHash('sha256').update(path).digest('hex');
  await writeFile(join(directory,'library',path),'original');
  const published=edit(source,'published',0),pending=edit(source,'idle',0);
  for(const e of [published,pending])await writeFile(join(directory,'files/videos/edits',e.id+'.mp4'),'mp4');
  await database.change(db=>{db.edits.push(published,pending);});
  await assert.rejects(deleteEdit(pending.id,'edit',{...options,scheduled:async()=>[{edit_id:pending.id,state:'scheduled'}]}),{status:409});
  await access(join(directory,'files/videos/edits',pending.id+'.mp4'));
  assert.equal((await deleteEdit(published.id,'media',options)).sourceDeleted,false);
  await access(join(directory,'library',path));
  const saved=(await database.read()).edits.find(e=>e.id===published.id)!;
  assert.equal(saved.instagram_media_id,'123');assert.equal(saved.auto_dm_enabled,true);assert.equal(saved.output_url,null);
  await deleteEdit(pending.id,'edit',options);
  assert.ok(!(await database.read()).edits.some(e=>e.id===pending.id));await access(join(directory,'library',path));
  assert.equal((await deleteEdit(published.id,'media',options)).sourceDeleted,true);
  await assert.rejects(access(join(directory,'library',path)));
  await deleteEdit(published.id,'edit',options);
  assert.ok((await database.read()).edits.find(e=>e.id===published.id)?.hidden_at);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('exclui original da biblioteca, preserva edição pronta e bloqueia renderização em curso',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'clipai-library-delete-')),database=new LocalStore(directory);
 try{
  const path='Produtos/original.mp4',source=createHash('sha256').update(path).digest('hex');
  await mkdir(join(directory,'library/Produtos'),{recursive:true});await mkdir(join(directory,'files/videos/edits'),{recursive:true});
  await writeFile(join(directory,'library',path),'original');
  const job=edit(source,'idle',0);job.status='processing';
  await writeFile(join(directory,'files/videos/edits',job.id+'.mp4'),'editado');
  await database.change(db=>{db.edits.push(job);});
  await assert.rejects(deleteLibraryVideo(source,{database,directory}),{status:409});
  await access(join(directory,'library',path));
  await database.change(db=>{db.edits[0].status='ready';});
  await deleteLibraryVideo(source,{database,directory});
  await assert.rejects(access(join(directory,'library',path)));await access(join(directory,'files/videos/edits',job.id+'.mp4'));
  const saved=(await database.read()).edits[0];assert.equal(saved.output_url,job.output_url);assert.ok(saved.source_deleted_at);assert.equal(saved.affiliate_url,job.affiliate_url);
  await assert.rejects(deleteLibraryVideo('../protected',{database,directory}),{status:404});
 }finally{await rm(directory,{recursive:true,force:true});}
});
