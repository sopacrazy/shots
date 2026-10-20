import {useEffect,useState} from 'react';
import {MessageCircle,CheckCircle,RefreshCw} from 'lucide-react';
interface Reply {id:string;username:string|null;product:string;public_text:string;public_state:string;private_state:string;error?:string;created_at:string;}
interface Status {enabled:boolean;configured:boolean;verify_token:string;webhook_url:string|null;subscribed:boolean;verified_at:string|null;last_event_at:string|null;sent:number;failed:number;recent:Reply[];}
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
async function request<T>(path:string,init?:RequestInit):Promise<T>{const response=await fetch(BASE+'/instagram/automation'+path,init);const data=await response.json();if(!response.ok)throw new Error(data.error??'Falha ao configurar automação');return data;}
const labels:Record<string,string>={pending:'Na fila',sending:'Enviando',sent:'Enviado',failed:'Falhou',unknown:'Conferir no Instagram',cancelled:'Não enviado'};
interface Product {id:string;source_name:string;affiliate_url?:string|null;}
interface Simulation {simulation:boolean;matched:boolean;reason?:string;product?:string;steps?:{type:string;text:string}[];}
export default function InstagramAutomation({connected,products=[]}:{connected:boolean;products?:Product[]}){
  const [status,setStatus]=useState<Status|null>(null);
  const [testComment,setTestComment]=useState('LINK'),[testLink,setTestLink]=useState('https://exemplo.com/produto?ref=seucodigo'),[testProduct,setTestProduct]=useState('');
  const [simulation,setSimulation]=useState<Simulation|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const refresh=async()=>{const s=await request<Status>('');setStatus(s);};
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  const load=async()=>{setError('');try{await refresh();}catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar');}};
  return <details className="studio-automation"><summary><span><MessageCircle size={18}/>Comentou LINK → resposta + Direct</span><small>{status?.enabled?'Ativada':'Configurar automação'}</small></summary>
    <div className="automation-body"><p>Em cada Reel publicado pelo app com link de afiliado, a pessoa comenta LINK, recebe uma resposta natural no comentário e depois o link daquele produto no Direct.</p>
      <div className="automation-example"><span>Comentário: <strong>LINK</strong></span><span>Resposta: “Claro! Vou te mandar o link no Direct 😊”</span><span>Direct: “Oi! 😊 Aqui está o link do produto que você pediu: [link do produto]”</span></div>
      <div className="automation-simulation"><h3>Teste local — sem enviar mensagens</h3><p>Simule o comentário e veja a resposta pública e o Direct. Não precisa conectar a conta, informar App Secret ou configurar URL pública.</p>
        <label className="studio-field">Produto para testar<select value={testProduct} onChange={e=>{setTestProduct(e.target.value);setSimulation(null);}}><option value="">Exemplo com link informado abaixo</option>{products.filter(p=>p.affiliate_url).map(p=><option key={p.id} value={p.id}>{p.source_name}</option>)}</select></label>
        {!testProduct&&<label className="studio-field">Link de afiliado de teste<input type="url" value={testLink} onChange={e=>{setTestLink(e.target.value);setSimulation(null);}}/></label>}
        <label className="studio-field">Comentário recebido<input maxLength={2000} value={testComment} onChange={e=>{setTestComment(e.target.value);setSimulation(null);}}/></label>
        <button className="studio-primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');setSimulation(null);try{setSimulation(await request<Simulation>('/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment:testComment,...(testProduct?{edit_id:testProduct}:{affiliate_url:testLink})})}));}catch(e){setError(e instanceof Error?e.message:'Erro na simulação');}finally{setBusy(false);}}}>Simular comentário</button>
        {simulation&&<div className="automation-example" role="status"><strong>SIMULAÇÃO — nenhuma mensagem enviada</strong>{simulation.reason&&<span>{simulation.reason}</span>}{simulation.steps?.map((step,i)=><span key={step.type}><strong>{i+1}. {step.type==='public_reply'?'Resposta no comentário':'Mensagem no Direct'}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{step.text}</p></span>)}</div>}
      </div>
      {!connected&&<p className="studio-error">Conecte sua conta profissional em Configurar Instagram antes de ativar.</p>}
      <p className="studio-muted">Configure no <code>.env</code>: <code>INSTAGRAM_APP_SECRET</code>, <code>INSTAGRAM_WEBHOOK_VERIFY_TOKEN</code> e <code>INSTAGRAM_AUTOMATION_ENABLED=true</code> para ativar, ou <code>false</code> para pausar.</p>
      <button className="studio-secondary" disabled={busy} onClick={load}><RefreshCw size={16}/>Atualizar status</button>
      {status?.configured&&<div className="automation-setup"><h3>Configurar no painel da Meta</h3><p>Cadastre estes dados no webhook do Instagram e selecione o campo <strong>comments</strong>.</p>
        <label className="studio-field">Callback URL<input readOnly value={status.webhook_url??''} placeholder="Configure a URL pública quando for ativar o webhook real"/></label>
        <label className="studio-field">Verify token<input readOnly value={status.verify_token}/></label>
        <p>O proxy HTTPS precisa permitir <code>/api/instagram/webhook</code>, além dos arquivos de vídeo. Mantenha o Node em execução para receber os comentários.</p>
        <p>Permissões adicionais no token: <code>instagram_business_manage_comments</code> e <code>instagram_business_manage_messages</code>. O app Meta precisa ter o acesso aprovado para atender pessoas fora dos perfis de teste.</p>
        <button className="studio-secondary" disabled={busy||!connected} onClick={async()=>{setBusy(true);setError('');setNotice('');try{setStatus(await request<Status>('/subscribe',{method:'POST'}));setNotice('A Meta confirmou a assinatura de comentários para a conta.');}catch(e){setError(e instanceof Error?e.message:'Falha ao assinar comentários');}finally{setBusy(false);}}}>Assinar comentários da conta na Meta</button>
        <div className="automation-badges"><span>{status.verified_at?'✓ Callback verificado pela Meta':'Callback ainda não verificado'}</span><span>{status.subscribed?'✓ Comentários assinados':'Comentários ainda não assinados'}</span><span>{status.sent} Direct(s) enviado(s)</span><span>{status.failed} envio(s) para conferir</span></div>
      </div>}
      {notice&&<p className="studio-notice" role="status"><CheckCircle size={16}/>{notice}</p>}{error&&<p className="studio-error" role="alert">{error}</p>}
      {!!status?.recent.length&&<div className="automation-history"><h3>Últimas respostas</h3>{status.recent.map(r=><div key={r.id}><strong>{r.username?`@${r.username}`:'Comentário recebido'} · {r.product}</strong><p>{r.public_text}</p><small>Comentário: {labels[r.public_state]??r.public_state} · Direct: {labels[r.private_state]??r.private_state}</small>{r.error&&<p className="studio-error">{r.error}</p>}</div>)}</div>}
    </div>
  </details>;
}
