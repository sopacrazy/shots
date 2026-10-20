import {useEffect,useState} from 'react';
import {Loader2,Sparkles} from 'lucide-react';
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
async function request(path:string,body?:unknown){
  const response=await fetch(`${BASE}/ai/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
  const result=await response.json().catch(()=>{throw new Error('Backend indisponível. Atualize a página em alguns instantes.');});
  if(!response.ok)throw new Error(result.error??'Falha na geração');return result;
}
export default function ProductDescriptionAI({affiliateLink,autoDm,currentCaption,onApply}:{affiliateLink:string;autoDm:boolean;currentCaption:string;onApply:(description:string)=>void}){
  const [configured,setConfigured]=useState(false);
  const [url,setUrl]=useState(''),[details,setDetails]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const [draft,setDraft]=useState<{description:string;source:string;input:string;affiliate:string;autoDm:boolean}|null>(null);
  useEffect(()=>{request('status').then(s=>setConfigured(s.configured)).catch(e=>setError(e.message));},[]);
  const productUrl=url.trim()||affiliateLink.trim();
  const currentDraft=draft&&draft.input===JSON.stringify([productUrl,details])&&draft.affiliate===affiliateLink&&draft.autoDm===autoDm?draft:null;
  return <section className="ai-description" aria-label="Descrição com inteligência artificial">
    <div className="studio-title"><strong><Sparkles size={17}/>Descrição com IA</strong><button type="button" className="studio-text-button" onClick={()=>{setError('');request('status').then(s=>setConfigured(s.configured)).catch(e=>setError(e.message));}}>Atualizar configuração</button></div>
    <p className="studio-muted">Claude Haiku 5.5 · modelo econômico · resposta limitada a 700 tokens.</p>
    <p className="studio-muted">{configured?'Chave configurada no .env.':'Preencha ANTHROPIC_API_KEY no .env e clique em Atualizar configuração.'}</p>
    <label className="studio-field">Breve descrição para a IA melhorar<textarea rows={4} maxLength={6000} value={details} onChange={e=>{setDetails(e.target.value);setError('');}} placeholder="Ex.: Aparelho 3 em 1 rosa, com lâmina, barra hidratante e frasco de spray. Compacto para levar na bolsa."/><small>Escreva com suas palavras. A IA organiza o texto para a publicação usando os detalhes que você informar. Não precisa consultar a loja.</small></label>
    {currentCaption.trim()&&<button type="button" className="studio-text-button" disabled={!!busy} onClick={()=>{setDetails(currentCaption);setError('');setDraft(null);}}>Usar a descrição que já escrevi como base</button>}
    <label className="studio-field">Link do produto (alternativa à breve descrição)<input type="url" maxLength={2048} value={url} onChange={e=>{setUrl(e.target.value);setError('');}} placeholder={affiliateLink||'https://loja.com/produto'}/><small>Usado somente se a breve descrição estiver vazia. Se vazio, usa o link de afiliado abaixo. Algumas lojas bloqueiam essa leitura.</small></label>
    <p className="studio-muted">Ao gerar, as informações são enviadas à Anthropic e consomem créditos da API.</p>
    <button type="button" className="studio-secondary" disabled={!!busy||!configured||(!productUrl&&!details.trim())} onClick={async()=>{
      setBusy('Gerando descrição...');setError('');setDraft(null);
      const input=JSON.stringify([productUrl,details]);
      try{const result=await request('description',{product_url:details.trim()?'':productUrl,details,affiliate_url:affiliateLink,auto_dm:autoDm});setDraft({...result,input,affiliate:affiliateLink,autoDm});}
      catch(e){setError(e instanceof Error?e.message:'Erro ao gerar descrição');}finally{setBusy('');}
    }}>{busy?<><Loader2 size={16} className="animate-spin"/>{busy}</>:<><Sparkles size={16}/>{details.trim()?'Melhorar minha descrição com IA':'Gerar descrição pelo link'}</>}</button>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {currentDraft&&<div className="studio-description-preview"><strong>Rascunho · {currentDraft.source==='page'?'informações da loja':'informações fornecidas'}</strong><p>{currentDraft.description}</p><button type="button" className="studio-primary" onClick={()=>{onApply(currentDraft.description);setDraft(null);}}>Usar na descrição</button></div>}
  </section>;
}
