import {withMediaLock} from './media-lock.service.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {dataDirectory,problem,store,type VideoEdit} from './local.service.js';
import {readInstagramConfig,publishEdit} from './instagram.service.js';

export type ScheduleState='scheduled'|'dispatching'|'processing'|'published'|'failed'|'unknown'|'cancelled'|'missed';
export interface Schedule {id:string;edit_id:string;account_id:string;product:string;caption:string;run_at:number;created_at:number;state:ScheduleState;error:string|null;permalink:string|null;}
export class ScheduleStore {
  private db:DatabaseSync;
  constructor(path:string){
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY, edit_id TEXT NOT NULL, account_id TEXT NOT NULL,
        product TEXT NOT NULL, caption TEXT NOT NULL, run_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
        state TEXT NOT NULL, error TEXT, permalink TEXT
      );
      CREATE INDEX IF NOT EXISTS schedule_due ON schedules(state,run_at);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_schedule ON schedules(edit_id)
        WHERE state IN ('scheduled','dispatching','processing','unknown');`);
  }
  list(){return this.db.prepare('SELECT * FROM schedules ORDER BY run_at DESC LIMIT 200').all() as unknown as Schedule[];}
  blocking(){return this.db.prepare("SELECT * FROM schedules WHERE state IN ('scheduled','dispatching','processing','unknown')").all() as unknown as Schedule[];}
  active(){return this.db.prepare("SELECT * FROM schedules WHERE state IN ('scheduled','dispatching','processing') ORDER BY run_at").all() as unknown as Schedule[];}
  add(edit:VideoEdit,accountId:string,runAt:number,now=Date.now()){
    if(!Number.isFinite(runAt)||runAt<now+60000)throw problem('Escolha um horário pelo menos 1 minuto no futuro');
    const row:Schedule={id:randomUUID(),edit_id:edit.id,account_id:accountId,product:edit.source_name,caption:edit.caption,run_at:runAt,created_at:now,state:'scheduled',error:null,permalink:null};
    try{this.db.prepare('INSERT INTO schedules VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id,row.edit_id,row.account_id,row.product,row.caption,row.run_at,row.created_at,row.state,null,null);}
    catch(e){if(String(e).includes('UNIQUE constraint failed: schedules.edit_id'))throw problem('Este vídeo já tem um agendamento ativo ou precisa de conferência',409);throw e;}
    return row;
  }
  cancel(id:string){
    const changed=this.db.prepare("UPDATE schedules SET state='cancelled' WHERE id=? AND state='scheduled'").run(id);
    if(!changed.changes)throw problem('O agendamento já foi iniciado, cancelado ou não existe',409);
  }
  claim(id:string){return !!this.db.prepare("UPDATE schedules SET state='dispatching' WHERE id=? AND state='scheduled'").run(id).changes;}
  update(id:string,state:ScheduleState,error:string|null=null,permalink:string|null=null){this.db.prepare('UPDATE schedules SET state=?,error=?,permalink=? WHERE id=?').run(state,error,permalink,id);}
  close(){this.db.close();}
}
let repository:Promise<ScheduleStore>|undefined;
async function queue(){return repository??=(async()=>{await mkdir(dataDirectory(),{recursive:true});return new ScheduleStore(join(dataDirectory(),'scheduler.sqlite'));})();}
export async function closeScheduleStore(){if(repository){(await repository).close();repository=undefined;}}
export async function listSchedules(){return (await queue()).list();}
export async function blockingSchedules(){return (await queue()).blocking();}
export async function createSchedule(body:Record<string,unknown>){return withMediaLock(async()=>{
  if(typeof body.edit_id!=='string'||typeof body.run_at!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(body.run_at))throw problem('Informe o vídeo e um horário com fuso');
  const account=await readInstagramConfig();if(!account?.publicBaseUrl)throw problem('Configure a conta do Instagram e a URL HTTPS pública antes de agendar');
  const edit=(await store.read()).edits.find(e=>e.id===body.edit_id);
  if(!edit||edit.status!=='ready'||!edit.output_url)throw problem('Selecione um vídeo finalizado');
  if(!['idle','error'].includes(edit.publish_state))throw problem('Este vídeo já foi enviado ou precisa de conferência',409);
  return (await queue()).add(edit,account.userId,Date.parse(body.run_at));
});}
export async function cancelSchedule(id:string){(await queue()).cancel(id);}

interface Dependencies {
  queue:ScheduleStore;now:number;readEdits:()=>Promise<VideoEdit[]>;
  account:()=>Promise<string|null>;dispatch:(id:string,accountId:string)=>Promise<unknown>;
}
export async function schedulerTick({queue,now,readEdits,account,dispatch}:Dependencies){
  const edits=await readEdits();
  for(const job of queue.active()){
    const edit=edits.find(e=>e.id===job.edit_id);
    // Reconcile the durable publication ledger before sending anything.
    if(edit?.publish_state==='published'){queue.update(job.id,'published',null,edit.instagram_permalink??null);continue;}
    if(job.state==='processing'||job.state==='dispatching'){
      if(edit?.publish_state==='processing')queue.update(job.id,'processing');
      else queue.update(job.id,edit?.publish_state==='error'?'failed':'unknown',edit?.publish_error??'Envio interrompido. Confira o Instagram antes de agendar novamente.');
      continue;
    }
    if(job.run_at>now)continue;
    if(now-job.run_at>15*60000){queue.update(job.id,'missed','O servidor ficou indisponível por mais de 15 minutos após o horário. Escolha um novo horário.');continue;}
    if(!edit||edit.status!=='ready'||!edit.output_url){queue.update(job.id,'failed','Vídeo final não está disponível');continue;}
    if(edit.publish_state==='processing'){queue.update(job.id,'processing');continue;}
    if(edit.publish_state==='unknown'){queue.update(job.id,'unknown','Confira a publicação anterior no Instagram');continue;}
    if(await account()!==job.account_id){queue.update(job.id,'failed','A conta do Instagram foi alterada. Crie um novo agendamento.');continue;}
    if(!queue.claim(job.id))continue;
    try{await dispatch(job.edit_id,job.account_id);queue.update(job.id,'processing');}
    catch(e){queue.update(job.id,'failed',e instanceof Error?e.message:'Falha ao iniciar publicação');}
  }
}
let running=false;
export function startScheduler(){
  const tick=async()=>{
    if(running)return;running=true;
    try{await schedulerTick({queue:await queue(),now:Date.now(),readEdits:async()=>(await store.read()).edits,account:async()=>(await readInstagramConfig())?.userId??null,dispatch:publishEdit});}
    catch(e){console.error('Agendador:',e instanceof Error?e.message:'Erro interno');}
    finally{running=false;}
  };
  void tick();const timer=setInterval(()=>void tick(),15000);timer.unref();return timer;
}
