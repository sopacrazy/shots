import { formatPublicationCaption } from '../lib/caption';
import {useEffect,useState} from 'react';
import {CalendarClock,RefreshCw,X} from 'lucide-react';
interface Edit {id:string;source_name:string;caption:string;affiliate_url?:string|null;status:string;publish_state:string;}
interface Job {id:string;edit_id:string;product:string;run_at:number;state:string;error:string|null;permalink:string|null;}
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
async function request<T>(path='',init?:RequestInit):Promise<T>{
  const response=await fetch(`${BASE}/schedules${path}`,init);
  if(response.status===204)return undefined as T;
  const data=await response.json();if(!response.ok)throw new Error(data.error??'Falha no agendador');return data;
}
const labels:Record<string,string>={scheduled:'Agendado',dispatching:'Iniciando envio',processing:'Publicando',published:'Publicado',failed:'Falhou',unknown:'Conferir no Instagram',cancelled:'Cancelado',missed:'Horário perdido'};
export default function VideoScheduler({edits,selectedId}:{edits:Edit[];selectedId?:string}){
  const [jobs,setJobs]=useState<Job[]>([]),[editId,setEditId]=useState(''),[date,setDate]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [review,setReview]=useState<{id:string;product:string;caption:string;time:string}|null>(null);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const refresh=async()=>setJobs(await request<Job[]>());
  useEffect(()=>{void refresh().catch(e=>setError(e.message));const timer=setInterval(()=>{void refresh().catch(e=>setError(e.message));},15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(selectedId)setEditId(selectedId);},[selectedId]);
  const eligible=edits.filter(e=>e.status==='ready'&&['idle','error'].includes(e.publish_state));
  const selected=eligible.find(e=>e.id===editId);
  return <section className="studio-card video-scheduler">
    <div className="studio-title"><h2><CalendarClock size={20}/>Agendar publicações</h2><button className="studio-icon" aria-label="Atualizar agendamentos" onClick={()=>void refresh().catch(e=>setError(e.message))}><RefreshCw size={18}/></button></div>
    <p className="studio-muted">Escolha um vídeo finalizado e o horário. A VPS publica automaticamente. Horário do seu navegador: <strong>{timezone}</strong>.</p>
    <form onSubmit={e=>{e.preventDefault();setError('');if(!selected)return;const time=new Date(date);if(!Number.isFinite(time.getTime())||time.getTime()<Date.now()+60000){setError('Escolha um horário pelo menos 1 minuto no futuro');return;}setReview({id:selected.id,product:selected.source_name,caption:formatPublicationCaption(selected.caption,selected.affiliate_url),time:time.toISOString()});}}>
      <div className="studio-pair"><label className="studio-field">Vídeo pronto<select required value={editId} onChange={e=>setEditId(e.target.value)}><option value="">Selecione um vídeo</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.source_name}</option>)}</select></label><label className="studio-field">Data e hora<input required type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      <button className="studio-primary" disabled={busy||!selected||!date}><CalendarClock size={17}/>Revisar agendamento</button>
    </form>
    {!eligible.length&&<p className="studio-muted">Gere um vídeo com sua marca para agendar.</p>}
    <p className="studio-muted">Os horários ficam salvos após reinícios. Se o servidor voltar com mais de 15 minutos de atraso, o vídeo fica como horário perdido para você reagendar.</p>
    {error&&<p className="studio-error" role="alert">{error}</p>}{notice&&<p className="studio-notice" role="status">{notice}</p>}
    <div className="schedule-list">{jobs.map(job=><article key={job.id} className="schedule-item"><strong>{job.product}</strong><p>{new Date(job.run_at).toLocaleString('pt-BR')} · {labels[job.state]??job.state}</p>{job.error&&<p className="studio-error">{job.error}</p>}{job.permalink&&<a href={job.permalink} target="_blank" rel="noreferrer">Ver Reel ↗</a>}{job.state==='scheduled'&&<button className="studio-secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await request(`/${job.id}`,{method:'DELETE'});setNotice('Agendamento cancelado.');await refresh();}catch(e){setError(e instanceof Error?e.message:'Erro ao cancelar');}finally{setBusy(false);}}}>Cancelar agendamento</button>}</article>)}</div>
    {review&&<div className="studio-modal-backdrop"><div className="studio-modal"><div className="studio-title"><h2>Confirmar publicação agendada</h2><button className="studio-icon" disabled={busy} onClick={()=>setReview(null)} aria-label="Fechar revisão"><X/></button></div><p>{review.product}</p><p><strong>{new Date(review.time).toLocaleString('pt-BR')} · {timezone}</strong></p><p className="studio-caption-review">{review.caption}</p><p>O vídeo e sua descrição serão publicados automaticamente na conta do Instagram configurada.</p>{error&&<p className="studio-error">{error}</p>}<div className="studio-pair"><button className="studio-secondary" disabled={busy} onClick={()=>setReview(null)}>Voltar</button><button className="studio-primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edit_id:review.id,run_at:review.time})});setReview(null);setDate('');setNotice('Vídeo agendado. Acompanhe o status na lista abaixo.');await refresh();}catch(e){setError(e instanceof Error?e.message:'Erro ao agendar');}finally{setBusy(false);}}}>{busy?'Salvando...':'Confirmar agendamento'}</button></div></div></div>}
  </section>;
}
