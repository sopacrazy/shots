import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ScheduleStore,schedulerTick} from '../src/services/scheduler.service.js';
import type {VideoEdit} from '../src/services/local.service.js';
const now=Date.now();
function edit(id:string):VideoEdit{return {id,created_at:new Date().toISOString(),source_id:'src',source_name:id+'.mp4',category:'Produtos',caption:'Descrição',watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:'/api/files/videos/'+id+'.mp4',status:'ready',error:null,publish_state:'idle'};}
test('SQLite persiste horários, rejeita repetição e cancela sem apagar o vídeo',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-schedule-'));let queue=new ScheduleStore(join(dir,'jobs.sqlite'));
  try{
    const video=edit('a');const scheduled=queue.add(video,'123',now+120000,now);
    assert.throws(()=>queue.add(video,'123',now+180000,now),(e:any)=>e.status===409);
    assert.throws(()=>queue.add(edit('b'),'123',now-1,now));
    queue.close();queue=new ScheduleStore(join(dir,'jobs.sqlite'));
    assert.equal(queue.list()[0].run_at,now+120000);assert.equal(queue.list()[0].state,'scheduled');
    queue.cancel(scheduled.id);assert.equal(queue.list()[0].state,'cancelled');assert.equal(video.publish_state,'idle');
    assert.throws(()=>queue.cancel(scheduled.id));assert.ok(queue.add(video,'123',now+180000,now));
  }finally{queue.close();await rm(dir,{recursive:true,force:true});}
});
test('envia somente no horário, reconcilia publicação e nunca repete envio incerto',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-dispatch-'));let queue=new ScheduleStore(join(dir,'jobs.sqlite'));
  const videos=[edit('a'),edit('b'),edit('c'),edit('d'),edit('e')];const calls:string[]=[];
  const opts={now,readEdits:async()=>videos,account:async()=>'123',dispatch:async(id:string,account:string)=>{assert.equal(account,'123');calls.push(id);videos.find(v=>v.id===id)!.publish_state='processing';}};
  try{
    const job=queue.add(videos[0],'123',now+60000,now);await schedulerTick({...opts,queue});assert.equal(calls.length,0);
    await schedulerTick({...opts,queue,now:now+60000});assert.deepEqual(calls,['a']);assert.equal(queue.list()[0].state,'processing');
    await schedulerTick({...opts,queue,now:now+61000});assert.equal(calls.length,1);
    videos[0].publish_state='published';videos[0].instagram_permalink='https://instagram.com/reel/test';
    await schedulerTick({...opts,queue,now:now+62000});assert.equal(queue.list().find(x=>x.id===job.id)!.state,'published');
    const interrupted=queue.add(videos[1],'123',now+60000,now);queue.claim(interrupted.id);queue.close();queue=new ScheduleStore(join(dir,'jobs.sqlite'));
    await schedulerTick({...opts,queue,now:now+60000});assert.equal(queue.list().find(x=>x.id===interrupted.id)!.state,'unknown');assert.equal(calls.length,1);
    const late=queue.add(videos[2],'123',now+60000,now);await schedulerTick({...opts,queue,now:now+17*60000});assert.equal(queue.list().find(x=>x.id===late.id)!.state,'missed');
    const changed=queue.add(videos[3],'999',now+60000,now);await schedulerTick({...opts,queue,now:now+60000});assert.equal(queue.list().find(x=>x.id===changed.id)!.state,'failed');assert.equal(calls.length,1);
    const cancelled=queue.add(videos[4],'123',now+60000,now);queue.cancel(cancelled.id);await schedulerTick({...opts,queue,now:now+60000});assert.equal(calls.length,1);
  }finally{queue.close();await rm(dir,{recursive:true,force:true});}
});
