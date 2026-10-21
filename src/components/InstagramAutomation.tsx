import {useEffect, useState} from 'react';
import {MessageCircle, CheckCircle, RefreshCw, Play, Settings} from 'lucide-react';

interface Reply {id:string;username:string|null;product:string;public_text:string;public_state:string;private_state:string;error?:string;created_at:string;}
interface Status {enabled:boolean;configured:boolean;verify_token:string;webhook_url:string|null;subscribed:boolean;verified_at:string|null;last_event_at:string|null;sent:number;failed:number;recent:Reply[];}
interface Product {id:string;source_name:string;affiliate_url?:string|null;}
interface Simulation {simulation:boolean;matched:boolean;reason?:string;product?:string;steps?:{type:string;text:string}[];}
type View = 'overview' | 'simulation' | 'configuration';
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
const labels:Record<string,string>={pending:'Na fila',sending:'Enviando',sent:'Enviado',failed:'Falhou',unknown:'Conferir no Instagram',cancelled:'Não enviado'};
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(BASE+'/instagram/automation'+path,init);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??'Falha ao configurar automação');
  return data;
}

export default function InstagramAutomation({connected,products=[]}:{connected:boolean;products?:Product[]}){
  const [view,setView]=useState<View>('overview');
  const [status,setStatus]=useState<Status|null>(null);
  const [testComment,setTestComment]=useState('LINK');
  const [testLink,setTestLink]=useState('https://exemplo.com/produto?ref=seucodigo');
  const [testProduct,setTestProduct]=useState('');
  const [simulation,setSimulation]=useState<Simulation|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const refresh=async()=>setStatus(await request<Status>(''));
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[]);
  const load=async()=>{
    setBusy(true);setError('');
    try{await refresh();}catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar');}
    finally{setBusy(false);}
  };
  const simulate=async()=>{
    setBusy(true);setError('');setSimulation(null);
    try{
      setSimulation(await request<Simulation>('/simulate',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({comment:testComment,...(testProduct?{edit_id:testProduct}:{affiliate_url:testLink})}),
      }));
    }catch(e){setError(e instanceof Error?e.message:'Erro na simulação');}
    finally{setBusy(false);}
  };
  const subscribe=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      setStatus(await request<Status>('/subscribe',{method:'POST'}));
      setNotice('A Meta confirmou a assinatura de comentários para a conta.');
    }catch(e){setError(e instanceof Error?e.message:'Falha ao assinar comentários');}
    finally{setBusy(false);}
  };

  return <section className="studio-card instagram-automation" aria-label="Automação do Instagram">
    <header className="tool-panel-heading">
      <div>
        <h2><MessageCircle size={20}/>Automação de comentários</h2>
        <p className="studio-muted">Transforme o comentário “LINK” em uma resposta e um Direct com o produto certo.</p>
      </div>
      <button className="studio-secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/>Atualizar status</button>
    </header>
    <nav className="tool-tabs" aria-label="Etapas da automação">
      <button type="button" className={`tool-tab${view==='overview'?' is-active':''}`} aria-pressed={view==='overview'} onClick={()=>setView('overview')}>Visão geral</button>
      <button type="button" className={`tool-tab${view==='simulation'?' is-active':''}`} aria-pressed={view==='simulation'} onClick={()=>setView('simulation')}>Simular resposta</button>
      <button type="button" className={`tool-tab${view==='configuration'?' is-active':''}`} aria-pressed={view==='configuration'} onClick={()=>setView('configuration')}>Configuração</button>
    </nav>
    {notice&&<p className="studio-notice" role="status"><CheckCircle size={16}/>{notice}</p>}
    {error&&<p className="studio-error" role="alert">{error}</p>}

    {view==='overview'&&<>
      <section className="tool-section">
        <div className="tool-section-heading"><h3>Status da automação</h3><span className="studio-muted">{status?(status.enabled?'Ativada':'Pausada'):'Carregando status…'}</span></div>
        <div className="automation-badges">
          <span>{connected?'✓ Instagram conectado':'Instagram não conectado'}</span>
          <span>{status?.verified_at?'✓ Callback verificado':'Callback pendente'}</span>
          <span>{status?.subscribed?'✓ Comentários assinados':'Assinatura de comentários pendente'}</span>
          <span>{status?.sent??0} Direct(s) enviado(s)</span>
          <span>{status?.failed??0} envio(s) para conferir</span>
        </div>
        <p className="studio-muted">A automação atende Reels publicados pelo app que tenham um link de afiliado.</p>
        {!connected&&<p className="studio-error">Conecte sua conta profissional em Instagram para ativar a automação.</p>}
        <div className="tool-actions">
          <button className="studio-primary" onClick={()=>setView('simulation')}><Play size={16}/>Testar uma resposta</button>
          <button className="studio-secondary" onClick={()=>setView('configuration')}><Settings size={16}/>Ver configuração</button>
        </div>
      </section>
      <section className="tool-section">
        <div className="tool-section-heading"><h3>Como funciona</h3></div>
        <div className="automation-example">
          <span><strong>1. Comentário no Reel</strong><br/>A pessoa comenta “LINK”.</span>
          <span><strong>2. Resposta pública</strong><br/>“Claro! Vou te mandar o link no Direct 😊”</span>
          <span><strong>3. Link no Direct</strong><br/>“Oi! 😊 Aqui está o link do produto que você pediu: [link do produto]”</span>
        </div>
      </section>
      <section className="tool-section automation-history">
        <div className="tool-section-heading"><h3>Últimas respostas</h3>{status?.last_event_at&&<small className="studio-muted">Último evento: {new Date(status.last_event_at).toLocaleString('pt-BR')}</small>}</div>
        {status?.recent.length?status.recent.map(reply=><article key={reply.id} className="schedule-item">
          <strong>{reply.username?`@${reply.username}`:'Comentário recebido'} · {reply.product}</strong>
          <p>{reply.public_text}</p>
          <small>Comentário: {labels[reply.public_state]??reply.public_state} · Direct: {labels[reply.private_state]??reply.private_state}</small>
          {reply.error&&<p className="studio-error">{reply.error}</p>}
        </article>):<p className="studio-muted">As respostas aparecerão aqui quando a automação receber comentários.</p>}
      </section>
    </>}

    {view==='simulation'&&<section className="tool-section">
      <div className="tool-section-heading"><h3>Teste antes de ativar</h3></div>
      <p className="studio-muted">Veja a resposta pública e o Direct sem enviar mensagens. A simulação funciona mesmo sem uma conta conectada.</p>
      <form onSubmit={e=>{e.preventDefault();void simulate();}}>
        <label className="studio-field">Produto da simulação
          <select value={testProduct} onChange={e=>{setTestProduct(e.target.value);setSimulation(null);}}>
            <option value="">Usar um link de exemplo</option>
            {products.filter(product=>product.affiliate_url).map(product=><option key={product.id} value={product.id}>{product.source_name}</option>)}
          </select>
        </label>
        {!testProduct&&<label className="studio-field">Link de afiliado para testar<input required type="url" value={testLink} onChange={e=>{setTestLink(e.target.value);setSimulation(null);}}/></label>}
        <label className="studio-field">Comentário recebido<input maxLength={2000} value={testComment} onChange={e=>{setTestComment(e.target.value);setSimulation(null);}}/><small>Experimente “LINK” para conferir o fluxo completo.</small></label>
        <div className="tool-actions"><button className="studio-primary" disabled={busy}><Play size={16}/>{busy?'Simulando…':'Simular comentário'}</button></div>
      </form>
      {simulation&&<div className="automation-example" role="status">
        <strong>Simulação concluída · nenhuma mensagem enviada</strong>
        {simulation.reason&&<span>{simulation.reason}</span>}
        {simulation.steps?.map((step,index)=><div key={`${step.type}-${index}`}><strong>{index+1}. {step.type==='public_reply'?'Resposta no comentário':'Mensagem no Direct'}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{step.text}</p></div>)}
      </div>}
    </section>}

    {view==='configuration'&&<>
      <section className="tool-section">
        <div className="tool-section-heading"><h3>1. Conectar a conta e preparar o servidor</h3></div>
        <p className="studio-muted">{connected?'Sua conta está conectada. Confira a configuração abaixo para receber os comentários.':'Conecte sua conta profissional no menu Instagram antes de ativar a automação.'}</p>
        <p className="studio-muted">No <code>.env</code> do servidor, configure <code>INSTAGRAM_APP_SECRET</code> e <code>INSTAGRAM_WEBHOOK_VERIFY_TOKEN</code>. Use <code>INSTAGRAM_AUTOMATION_ENABLED=true</code> para ativar ou <code>false</code> para pausar.</p>
      </section>
      <section className="tool-section automation-setup">
        <div className="tool-section-heading"><h3>2. Configurar o webhook na Meta</h3></div>
        {status?.configured?<>
          <p>Cadastre estes dados no webhook do Instagram e selecione o campo <strong>comments</strong>.</p>
          <label className="studio-field">URL de callback<input readOnly value={status.webhook_url??''} placeholder="Configure a URL pública para ativar o webhook"/></label>
          <label className="studio-field">Token de verificação<input readOnly value={status.verify_token}/></label>
          <p>O proxy HTTPS precisa permitir <code>/api/instagram/webhook</code>, além dos arquivos de vídeo. Mantenha o Node em execução para receber comentários.</p>
          <p>Permissões necessárias: <code>instagram_business_manage_comments</code> e <code>instagram_business_manage_messages</code>. O app Meta precisa ter acesso aprovado para atender pessoas fora dos perfis de teste.</p>
        </>:<p className="studio-muted">Os dados do webhook aparecem aqui após a configuração do servidor. Atualize o status quando concluir essa etapa.</p>}
      </section>
      <section className="tool-section">
        <div className="tool-section-heading"><h3>3. Assinar os comentários da conta</h3></div>
        <p className="studio-muted">Após verificar o callback na Meta, confirme a assinatura para receber os comentários desta conta.</p>
        <div className="tool-actions"><button className="studio-primary" disabled={busy||!connected||!status?.configured} onClick={()=>void subscribe()}>{busy?'Aguarde…':'Assinar comentários na Meta'}</button></div>
        <div className="automation-badges"><span>{status?.verified_at?'✓ Callback verificado pela Meta':'Callback ainda não verificado'}</span><span>{status?.subscribed?'✓ Comentários assinados':'Comentários ainda não assinados'}</span></div>
      </section>
    </>}
  </section>;
}
