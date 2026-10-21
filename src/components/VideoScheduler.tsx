import {formatPublicationCaption} from '../lib/caption';
import {useEffect,useState} from 'react';
import {CalendarClock,RefreshCw,X} from 'lucide-react';

interface Edit {id:string;source_name:string;caption:string;affiliate_url?:string|null;status:string;publish_state:string;}
interface Job {id:string;edit_id:string;product:string;run_at:number;state:string;error:string|null;permalink:string|null;}
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
const labels:Record<string,string>={scheduled:'Agendado',dispatching:'Iniciando envio',processing:'Publicando',published:'Publicado',failed:'Falhou',unknown:'Conferir no Instagram',cancelled:'Cancelado',missed:'Horário perdido'};
async function request<T>(path='',init?:RequestInit):Promise<T>{
  const response=await fetch(`${BASE}/schedules${path}`,init);
  if(response.status===204)return undefined as T;
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??'Falha no agendador');
  return data;
}

export default function VideoScheduler({edits,selectedId}:{edits:Edit[];selectedId?:string}){
  const [jobs,setJobs]=useState<Job[]>([]),[editId,setEditId]=useState(''),[date,setDate]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [review,setReview]=useState<{id:string;product:string;caption:string;time:string}|null>(null);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const refresh=async()=>setJobs(await request<Job[]>());
  useEffect(()=>{void refresh().catch(e=>setError(e.message));const timer=setInterval(()=>{void refresh().catch(e=>setError(e.message));},15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(selectedId)setEditId(selectedId);},[selectedId]);
  const eligible=edits.filter(edit=>edit.status==='ready'&&['idle','error'].includes(edit.publish_state));
  const selected=eligible.find(edit=>edit.id===editId);
  const scheduledCount=jobs.filter(job=>job.state==='scheduled').length;
  const cancel=async(id:string)=>{
    setBusy(true);setError('');
    try{await request(`/${id}`,{method:'DELETE'});setNotice('Agendamento cancelado.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Erro ao cancelar');}
    finally{setBusy(false);}
  };
  const confirm=async()=>{
    if(!review)return;
    setBusy(true);setError('');
    try{
      await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edit_id:review.id,run_at:review.time})});
      setReview(null);setDate('');setNotice('Vídeo agendado. Acompanhe a publicação na lista de agendamentos.');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Erro ao agendar');}
    finally{setBusy(false);}
  };

  return <section className="studio-card video-scheduler" aria-label="Agendamento de publicações">
    <header className="tool-panel-heading">
      <div><h2><CalendarClock size={20}/>Agendar publicações</h2><p className="studio-muted">Escolha quando seus vídeos prontos serão publicados no Instagram.</p></div>
      <button className="studio-secondary" onClick={()=>void refresh().catch(e=>setError(e.message))}><RefreshCw size={16}/>Atualizar lista</button>
    </header>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {notice&&<p className="studio-notice" role="status">{notice}</p>}
    <section className="tool-section">
      <div className="tool-section-heading"><h3>Novo agendamento</h3><span className="studio-muted">1. Escolha o vídeo e o horário</span></div>
      <form onSubmit={e=>{
        e.preventDefault();setError('');if(!selected)return;
        const time=new Date(date);
        if(!Number.isFinite(time.getTime())||time.getTime()<Date.now()+60000){setError('Escolha um horário pelo menos 1 minuto no futuro');return;}
        setReview({id:selected.id,product:selected.source_name,caption:formatPublicationCaption(selected.caption,selected.affiliate_url),time:time.toISOString()});
      }}>
        <div className="studio-pair">
          <label className="studio-field">Vídeo finalizado<select required value={editId} onChange={e=>setEditId(e.target.value)}><option value="">Selecione um vídeo pronto</option>{eligible.map(edit=><option key={edit.id} value={edit.id}>{edit.source_name}</option>)}</select><small>Apenas vídeos prontos e disponíveis para publicação.</small></label>
          <label className="studio-field">Data e hora da publicação<input required type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/><small>Fuso horário: {timezone}</small></label>
        </div>
        <div className="tool-actions"><button className="studio-primary" disabled={busy||!selected||!date}><CalendarClock size={17}/>Revisar agendamento</button><span className="studio-muted">2. Confira a legenda e confirme</span></div>
      </form>
      {!eligible.length&&<p className="studio-muted">Gere um vídeo com sua marca em Criar vídeo para liberar o agendamento.</p>}
    </section>
    <section className="tool-section">
      <div className="tool-section-heading"><h3>Seus agendamentos</h3><span className="studio-muted">{scheduledCount} aguardando publicação</span></div>
      <p className="studio-muted">A publicação acontece automaticamente no horário escolhido. Você pode cancelar enquanto o status for “Agendado”.</p>
      {jobs.length?<div className="schedule-list">{jobs.map(job=><article key={job.id} className="schedule-item">
        <div className="tool-section-heading"><strong>{job.product}</strong><span className="tool-status">{labels[job.state]??job.state}</span></div>
        <p><time dateTime={new Date(job.run_at).toISOString()}>{new Date(job.run_at).toLocaleString('pt-BR')}</time> · {timezone}</p>
        {job.error&&<p className="studio-error">{job.error}</p>}
        <div className="tool-actions">
          {job.permalink&&<a className="studio-secondary" href={job.permalink} target="_blank" rel="noreferrer">Ver Reel ↗</a>}
          {job.state==='scheduled'&&<button className="studio-secondary" disabled={busy} onClick={()=>void cancel(job.id)}>Cancelar agendamento</button>}
        </div>
      </article>)}</div>:<div className="tool-empty-state"><CalendarClock size={28}/><h3>Sua agenda está livre</h3><p className="studio-muted">Escolha um vídeo e um horário acima para programar a primeira publicação.</p></div>}
      <p className="studio-muted">Os agendamentos ficam salvos após reinícios. Se o servidor retornar com mais de 15 minutos de atraso, o status será “Horário perdido” para você reagendar.</p>
    </section>
    {review&&<div className="studio-modal-backdrop"><div className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-review-title">
      <div className="studio-title"><h2 id="schedule-review-title">Revisar agendamento</h2><button className="studio-icon" disabled={busy} onClick={()=>setReview(null)} aria-label="Fechar revisão"><X/></button></div>
      <p>Vídeo selecionado<br/><strong>{review.product}</strong></p>
      <p>Publicação programada para<br/><strong>{new Date(review.time).toLocaleString('pt-BR')} · {timezone}</strong></p>
      <p>Legenda da publicação</p><p className="studio-caption-review">{review.caption}</p>
      <p>O vídeo e sua descrição serão publicados automaticamente na conta do Instagram configurada.</p>
      {error&&<p className="studio-error" role="alert">{error}</p>}
      <div className="studio-pair"><button className="studio-secondary" disabled={busy} onClick={()=>setReview(null)}>Voltar e editar</button><button className="studio-primary" disabled={busy} onClick={()=>void confirm()}>{busy?'Salvando…':'Confirmar agendamento'}</button></div>
    </div></div>}
  </section>;
}
