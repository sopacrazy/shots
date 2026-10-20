import { formatPublicationCaption as combinedCaption } from '../lib/caption';
import InstagramAutomation from './InstagramAutomation';
import ProductDescriptionAI from './ProductDescriptionAI';
import VideoScheduler from './VideoScheduler';
import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Upload, Film, Instagram, RefreshCw, Download, CheckCircle, Settings, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
interface Video { id:string;name:string;category:string;url:string;size:number; }
interface Edit { id:string;source_id:string;watermark_position:string;source_name:string;caption:string;affiliate_url?:string|null;auto_dm_enabled?:boolean;watermark:string;logo_url:string|null;output_url:string|null;status:string;error:string|null;publish_state:string;publish_error?:string;instagram_permalink?:string;created_at:string;media_deleted_at?:string;source_deleted_at?:string; }
interface Connection { configured:boolean;username?:string;userId?:string;apiVersion?:string;publicBaseUrl?:string;error?:string; }
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
async function request<T>(path:string,init?:RequestInit):Promise<T>{const res=await fetch(BASE+path,init);const data=await res.json().catch(()=>{throw new Error('Backend indisponível. Aguarde alguns segundos e atualize a biblioteca.');});if(!res.ok)throw new Error(data.error??'Falha na operação');return data;}
export default function ProductStudio(){
  const [videos,setVideos]=useState<Video[]>([]),[edits,setEdits]=useState<Edit[]>([]);
  const [category,setCategory]=useState('Todas'),[newCategory,setNewCategory]=useState('Produtos');
  const [selected,setSelected]=useState<Video|null>(null),[active,setActive]=useState<Edit|null>(null);
  const [caption,setCaption]=useState(''),[watermark,setWatermark]=useState(''),[position,setPosition]=useState('top-right');
  const [affiliateLink,setAffiliateLink]=useState('');
  const [autoDm,setAutoDm]=useState(true);
  const [savedLogoUrl,setSavedLogoUrl]=useState('');
  const [logo,setLogo]=useState<{fileBase64:string;mimeType:string}|null>(null),[logoPreview,setLogoPreview]=useState('');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [connection,setConnection]=useState<Connection>({configured:false}),[settings,setSettings]=useState(false);
  const [publishReview,setPublishReview]=useState(false);
  const [deletion,setDeletion]=useState<{edit:Edit;mode:'media'|'edit'}|null>(null);
  const [libraryDeletion,setLibraryDeletion]=useState<Video|null>(null);
  const importing=useRef(false);
  const readyPreview=useRef<HTMLDivElement>(null);
  const editorPanel=useRef<HTMLElement>(null);
  useEffect(()=>{if(active?.status==='ready')readyPreview.current?.scrollIntoView({behavior:'smooth',block:'center'});},[active?.id,active?.status]);
  const refresh=async()=>{
    // Each local result is applied independently of optional integrations.
    const results=await Promise.allSettled([
      request<Video[]>('/library').then(setVideos),
      request<Edit[]>('/edits').then(e=>{setEdits(e);setActive(prev=>prev?e.find(x=>x.id===prev.id)??null:null);}),
      request<Connection>('/instagram/status').then(setConnection).catch(e=>setConnection({configured:false,error:e.message})),
    ]);
    const failure=results.slice(0,2).find(r=>r.status==='rejected');
    if(failure?.status==='rejected')throw failure.reason;
  };
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  useEffect(()=>{request<{watermark:string;watermark_position:string;logo_url:string|null}>('/brand').then(brand=>{setWatermark(brand.watermark);setPosition(brand.watermark_position);setSavedLogoUrl(brand.logo_url??'');setLogoPreview(brand.logo_url?api.mediaUrl(brand.logo_url):'');}).catch(e=>setError(e.message));},[]);
  const working=edits.some(e=>['queued','processing'].includes(e.status)||e.publish_state==='processing');
  useEffect(()=>{if(!working)return;const timer=setInterval(()=>{refresh().catch(e=>setError(e.message));},2000);return()=>clearInterval(timer);},[working]);
  useEffect(()=>()=>{if(logoPreview.startsWith('blob:'))URL.revokeObjectURL(logoPreview);},[logoPreview]);
  const importFiles=async(files:FileList|null)=>{
    if(!files?.length||importing.current)return;importing.current=true;setError('');setNotice('');let done=0;
    try{const list=Array.from(files).filter(f=>/\.(mp4|mov|webm|m4v)$/i.test(f.name));if(!list.length)throw new Error('A pasta não contém vídeos MP4, MOV ou WebM');
      for(const file of list){setBusy(`Importando ${done+1} de ${list.length}: ${file.name}`);if(file.size>250*1024*1024)throw new Error(`${file.name}: limite de 250 MB`);
        const folders=file.webkitRelativePath?.split('/').slice(0,-1).join('/');
        await request('/library?'+new URLSearchParams({name:file.name,category:folders||newCategory.trim()||'Sem categoria'}),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});done++;}
      setNotice(`${done} vídeo(s) importado(s).`);
    }catch(e){setError(`${e instanceof Error?e.message:'Erro ao importar'}${done?` (${done} já importados)`:''}`);}finally{importing.current=false;setBusy('');await refresh().catch(e=>setError(e.message));}
  };
  const generate=async()=>{
    if(!selected)return;setBusy('Editando vídeo...');setError('');setNotice('');
    try{const edit=await request<Edit>('/edits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source_id:selected.id,caption,affiliate_url:affiliateLink,watermark,watermark_position:position,logo,existing_logo_url:logo?null:savedLogoUrl||null,auto_dm_enabled:autoDm&&!!affiliateLink.trim()})});setActive(edit);setEdits(prev=>[edit,...prev]);}
    catch(e){setError(e instanceof Error?e.message:'Erro ao editar');}finally{setBusy('');}
  };
  const publish=async()=>{
    if(!active)return;setPublishReview(false);setBusy('Enviando para o Instagram...');setError('');
    try{await request(`/instagram/publish/${active.id}`,{method:'POST'});await refresh();}catch(e){setError(e instanceof Error?e.message:'Falha na publicação');}finally{setBusy('');}
  };
  const filtered=category==='Todas'?videos:videos.filter(v=>v.category===category);
  const categories=Array.from(new Set(videos.map(v=>v.category)));
  const edited=active&&active.status==='ready'&&!!active.output_url;
  const finalCaption=combinedCaption(caption,affiliateLink);

  return <div className="studio">
    <header className="studio-header"><div><span className="studio-eyebrow">CLIPAI · ESTÚDIO DE PRODUTOS</span><h1>Do seu catálogo para o Instagram.</h1><p>Escolha um vídeo, aplique sua marca e prepare a publicação.</p></div><button className="studio-secondary" onClick={()=>setSettings(true)}><Instagram size={18}/>{connection.configured?(connection.username?`@${connection.username}`:'Instagram configurado'):'Configurar Instagram'}</button></header>
    <div className="studio-stepper"><span className="current">01 Biblioteca</span><span>02 Marca d’água</span><span>03 Revisar e publicar</span><small>Arquivos salvos neste computador</small></div>
    <InstagramAutomation connected={connection.configured} products={edits}/>
    {error&&<div className="studio-alert" role="alert">{error}<button onClick={()=>setError('')} aria-label="Fechar erro"><X size={16}/></button></div>}
    {notice&&<p className="studio-notice" role="status">{notice}</p>}
    {busy&&<div className="studio-notice" role="status"><Loader2 className="animate-spin" size={16}/>{busy}</div>}
    <div className="studio-columns">
      <section className="studio-card library-card"><div className="studio-title"><h2><FolderOpen size={20}/>Sua biblioteca</h2><button aria-label="Atualizar biblioteca" className="studio-icon" onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}><RefreshCw size={18}/></button></div>
        <p className="studio-muted">Copie vídeos para <code>data/library/Categoria/</code> ou importe abaixo.</p>
        <label className="studio-field">Categoria para novos vídeos<input value={newCategory} maxLength={100} onChange={e=>setNewCategory(e.target.value)} placeholder="Ex.: Cozinha, Beleza, Eletrônicos"/></label>
        <div className="studio-import"><label className={busy?'disabled':''}><Upload size={17}/>Vídeos<input hidden type="file" multiple accept="video/mp4,video/quicktime,video/webm,.m4v" disabled={!!busy} onChange={e=>{void importFiles(e.target.files);e.target.value='';}}/></label><label className={busy?'disabled':''}><FolderOpen size={17}/>Pasta<input hidden type="file" multiple {...{webkitdirectory:''}} disabled={!!busy} onChange={e=>{void importFiles(e.target.files);e.target.value='';}}/></label></div>
        <div className="studio-categories">{['Todas',...categories].map(c=><button className={category===c?'selected':''} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div className="studio-video-grid">{filtered.map(v=><article className="studio-library-entry" key={v.id}><button className={`studio-video-tile ${selected?.id===v.id?'selected':''}`} onClick={()=>{setSelected(v);setActive(null);setError('');if(window.matchMedia('(max-width:700px)').matches)requestAnimationFrame(()=>editorPanel.current?.scrollIntoView({behavior:'smooth',block:'start'}));}}>
          <video src={api.mediaUrl(v.url)} preload="metadata" muted playsInline/><span className="tile-play"><Film size={20}/></span><strong>{v.name}</strong><small>{v.category} · {(v.size/1024/1024).toFixed(1)} MB</small>
        </button><button className="studio-secondary studio-delete-library" disabled={!!busy||edits.some(e=>e.source_id===v.id&&['queued','processing'].includes(e.status))} onClick={()=>{setError('');setLibraryDeletion(v);}}>Excluir vídeo</button></article>)}</div>{!filtered.length&&<div className="studio-empty"><Film size={36}/><h3>Seus vídeos começam aqui</h3><p>Importe arquivos ou uma pasta com categorias para montar seu catálogo.</p></div>}
      </section>
      <section ref={editorPanel} className="studio-card editor-card"><div className="studio-title"><h2><Settings size={20}/>Preparar o produto</h2></div>
        {selected?<>
          <div className="studio-preview"><video key={active?.output_url??selected.url} src={api.mediaUrl(active?.output_url??selected.url)} controls playsInline preload="metadata"/>{!active?.output_url&&watermark&&<span className={`watermark-preview ${position} ${logoPreview?'has-logo':''}`}>{watermark}</span>}{!active?.output_url&&logoPreview&&<img className={`logo-preview ${position}`} src={logoPreview} alt="Prévia da marca"/>}</div>
          <p className="studio-source">{active?.source_name??selected.name}{active?.output_url?' · versão editada':' · original'}</p>
          {active?.media_deleted_at&&<p className="studio-notice">O MP4 editado foi removido da VPS. O Reel e sua automação continuam ativos no Instagram.</p>}
          <ProductDescriptionAI key={selected.id} affiliateLink={affiliateLink} autoDm={autoDm} currentCaption={caption} onApply={description=>{setCaption(description);setActive(null);}}/>
          <label className="studio-field">Descrição da publicação<textarea rows={4} maxLength={2200} value={caption} onChange={e=>{setCaption(e.target.value);setActive(null);}} placeholder="Apresente o produto, benefícios, chamada para ação e hashtags..."/><small>{finalCaption.length}/2200 com a chamada LINK e o link · não aparece dentro do vídeo</small></label>
          <label className="studio-field">Link do produto afiliado (opcional)<input type="url" maxLength={2048} value={affiliateLink} onChange={e=>{setAffiliateLink(e.target.value);setActive(null);}} placeholder="https://loja.com/produto?afiliado=seucodigo"/><small>Será incluído no final da descrição, preservando seu código de afiliado.</small></label>
          <label className="automation-checkbox"><input type="checkbox" checked={autoDm} disabled={!affiliateLink.trim()} onChange={e=>{setAutoDm(e.target.checked);setActive(null);}}/>Responder ao comentário LINK e enviar este link no Direct</label>
          <p className="studio-muted">Funciona após publicar este Reel e ativar a automação do Instagram.</p>
          {affiliateLink.trim()&&<div className="studio-description-preview"><strong>Descrição com o link</strong><p>{finalCaption}</p></div>}
          <label className="studio-field">Marca d’água em texto<input maxLength={60} value={watermark} onChange={e=>{setWatermark(e.target.value);setActive(null);}} placeholder="@sualoja"/></label>
          <div className="studio-pair"><label className="studio-field">Posição<select value={position} onChange={e=>{setPosition(e.target.value);setActive(null);}}><option value="top-right">Superior direita</option><option value="top-left">Superior esquerda</option><option value="bottom-right">Inferior direita</option><option value="bottom-left">Inferior esquerda</option></select></label><label className="studio-field">Marca d’água em imagem (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{setLogo(await api.manual.file(f));setSavedLogoUrl('');setLogoPreview(URL.createObjectURL(f));setActive(null);}catch(e){setError(e instanceof Error?e.message:'Erro ao ler logo');}}}/><small>PNG com transparência, WebP ou JPEG. Pode combinar com o texto.</small></label></div>
          {(logo||savedLogoUrl)&&<button className="studio-text-button" onClick={()=>{setLogo(null);setSavedLogoUrl('');setLogoPreview('');setActive(null);}}>Remover imagem da marca d’água</button>}
          <button className="studio-secondary" disabled={!!busy} onClick={async()=>{setBusy('Salvando marca...');setError('');try{const brand=await request<{logo_url:string|null}>('/brand',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({watermark,watermark_position:position,logo,existing_logo_url:logo?null:savedLogoUrl||null})});setLogo(null);setSavedLogoUrl(brand.logo_url??'');setLogoPreview(brand.logo_url?api.mediaUrl(brand.logo_url):'');setNotice('Marca salva para os próximos vídeos, inclusive após fechar o projeto.');}catch(e){setError(e instanceof Error?e.message:'Erro ao salvar marca');}finally{setBusy('');}}}>Salvar marca para os próximos vídeos</button>
          <p className="studio-muted">O texto, a posição e a imagem também são lembrados automaticamente ao gerar um vídeo.</p>
          <button className="studio-primary" disabled={!!busy||!caption.trim()||finalCaption.length>2200||(!watermark.trim()&&!logo&&!savedLogoUrl)||active?.status==='processing'||active?.status==='queued'} onClick={generate}>{active?.status==='processing'||active?.status==='queued'?<><Loader2 size={18} className="animate-spin"/>Aplicando marca d’água...</>:<><Film size={18}/>Gerar vídeo com minha marca</>}</button>
          {active?.error&&<p className="studio-error">{active.error}</p>}
          {active?.publish_state==='published'&&active.affiliate_url&&<button className="studio-secondary" disabled={!!busy} onClick={async()=>{setBusy('Atualizando automação do Reel...');setError('');try{const updated=await request<Edit>(`/instagram/automation/edits/${active.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:active.auto_dm_enabled===false})});setActive(updated);setEdits(prev=>prev.map(e=>e.id===updated.id?updated:e));setAutoDm(updated.auto_dm_enabled!==false);}catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar automação');}finally{setBusy('');}}}>{active.auto_dm_enabled===false?'Ativar LINK → Direct neste Reel':'Pausar LINK → Direct neste Reel'}</button>}
          {edited&&<div ref={readyPreview} className="studio-ready"><p><CheckCircle size={17}/>Vídeo pronto. Aperte o play abaixo para revisar sua marca e o áudio.</p>
            <div className="studio-preview"><video key={active.output_url} src={api.mediaUrl(active.output_url!)} controls playsInline preload="metadata" aria-label="Vídeo final com marca d’água"/></div>
            <a className="studio-secondary" href={api.mediaUrl(active.output_url!)} target="_blank" rel="noreferrer"><Film size={17}/>Abrir vídeo final em outra aba</a>
            <a className="studio-secondary" href={api.mediaUrl(active.output_url!)} download target="_blank" rel="noreferrer"><Download size={17}/>Baixar MP4</a>
            <button className="studio-primary" disabled={!!busy||!connection.configured||!connection.publicBaseUrl||['processing','published','unknown'].includes(active.publish_state)} onClick={()=>setPublishReview(true)}><Instagram size={18}/>{active.publish_state==='published'?'Publicado':active.publish_state==='processing'?'Publicando...':active.publish_state==='unknown'?'Confira a publicação no Instagram':'Publicar no Instagram'}</button>
            {connection.configured&&!connection.publicBaseUrl&&<p>Conta validada. Configure a URL pública quando quiser publicar no Instagram; edição e testes locais já estão disponíveis.</p>}
            {!connection.configured&&<p>Configure sua conta profissional para publicar diretamente.</p>}{active.publish_error&&<p className="studio-error">{active.publish_error}</p>}{active.instagram_permalink&&<a href={active.instagram_permalink} target="_blank" rel="noreferrer">Ver publicação no Instagram ↗</a>}
          </div>}
        </>:active?.media_deleted_at?<div className="studio-empty"><CheckCircle size={36}/><h3>Publicado · arquivo removido da VPS</h3><p>{active.source_name}</p><p>Os arquivos foram removidos da VPS. O histórico e o link de afiliado continuam salvos para responder aos comentários.</p>{active.instagram_permalink&&<a href={active.instagram_permalink} target="_blank" rel="noreferrer">Ver Reel no Instagram ↗</a>}</div>:<div className="studio-empty"><Film size={36}/><h3>Selecione um vídeo</h3><p>A descrição e a marca d’água são configuradas aqui.</p></div>}
      </section>
    </div>
    {edits.length>0&&<section className="studio-history"><h2>Últimas edições</h2><div>{edits.slice(0,12).map(edit=><article className="studio-history-entry" key={edit.id}><button className="studio-history-item" onClick={()=>{const source=videos.find(v=>v.id===edit.source_id);setSelected(source??null);setActive(edit);setCaption(edit.caption);setAffiliateLink(edit.affiliate_url??'');setAutoDm(edit.auto_dm_enabled!==false);setWatermark(edit.watermark);setPosition(edit.watermark_position);setLogo(null);setSavedLogoUrl(edit.logo_url??'');setLogoPreview(edit.logo_url?api.mediaUrl(edit.logo_url):'');}}><Film size={18}/><span>{edit.source_name}<small>{edit.media_deleted_at?'Arquivo removido da VPS':edit.status==='ready'?'Pronto':edit.status==='error'?'Erro':'Processando'}{edit.publish_state==='published'?' · Publicado':''}</small></span></button><div className="studio-history-actions">{edit.publish_state==='published'&&(!edit.media_deleted_at||!edit.source_deleted_at)&&<button className="studio-secondary" disabled={!!busy} onClick={()=>setDeletion({edit,mode:'media'})}>Excluir arquivos da VPS</button>}<button className="studio-secondary" disabled={!!busy||['queued','processing'].includes(edit.status)||['processing','unknown'].includes(edit.publish_state)} onClick={()=>setDeletion({edit,mode:'edit'})}>Excluir edição</button></div></article>)}</div></section>}
    <VideoScheduler edits={edits} selectedId={active?.status==='ready'?active.id:undefined}/>
    {libraryDeletion&&<div className="studio-modal-backdrop"><div className="studio-modal" role="dialog" aria-modal="true" aria-label="Excluir vídeo da biblioteca"><h2>Excluir vídeo da biblioteca?</h2><p>{libraryDeletion.name}</p><p>O vídeo original será apagado da VPS. Para criar novas edições com ele, será necessário enviar o arquivo novamente. As edições prontas, agendamentos e publicações no Instagram serão mantidos.</p>{error&&<p className="studio-error" role="alert">{error}</p>}<div className="studio-pair"><button className="studio-secondary" disabled={!!busy} onClick={()=>setLibraryDeletion(null)}>Cancelar</button><button className="studio-primary" disabled={!!busy} onClick={async()=>{setBusy('Excluindo vídeo...');setError('');try{await request(`/library/${libraryDeletion.id}`,{method:'DELETE'});if(selected?.id===libraryDeletion.id){setSelected(null);setActive(null);}setLibraryDeletion(null);setNotice('Vídeo original excluído da VPS.');await refresh();}catch(e){setError(e instanceof Error?e.message:'Falha ao excluir vídeo');}finally{setBusy('');}}}>Excluir vídeo da VPS</button></div></div></div>}
    {deletion&&<div className="studio-modal-backdrop"><div className="studio-modal" role="dialog" aria-modal="true" aria-label="Confirmar exclusão"><h2>{deletion.mode==='media'?'Excluir arquivos da VPS?':'Excluir edição?'}</h2><p>{deletion.edit.source_name}</p><p>{deletion.mode==='media'?'Remove o MP4 editado e o original, quando nenhuma edição pendente utiliza esse original. O histórico e a automação LINK continuam salvos.':'Remove esta edição da lista e seu MP4 editado. O vídeo original e a marca d’água são mantidos. Se já foi publicado, os dados necessários à automação LINK continuam salvos.'}</p><p>A publicação no Instagram não será excluída.</p>{error&&<p className="studio-error" role="alert">{error}</p>}<div className="studio-pair"><button className="studio-secondary" disabled={!!busy} onClick={()=>setDeletion(null)}>Cancelar</button><button className="studio-primary" disabled={!!busy} onClick={async()=>{setBusy('Excluindo...');setError('');try{const result=await request<{originalPreserved:boolean}>(`/edits/${deletion.edit.id}${deletion.mode==='media'?'/media':''}`,{method:'DELETE'});setNotice(deletion.mode==='media'?(result.originalPreserved?'MP4 removido. O original foi mantido porque está em uso ou já foi removido.':'Arquivos removidos da VPS. O Reel continua no Instagram.'):'Edição excluída.');setDeletion(null);await refresh();}catch(e){setError(e instanceof Error?e.message:'Falha ao excluir');}finally{setBusy('');}}}>Confirmar exclusão</button></div></div></div>}
    {settings&&<div className="studio-modal-backdrop"><form className="studio-modal" onSubmit={async e=>{e.preventDefault();setBusy('Validando conta...');setError('');try{const c=await request<Connection>('/instagram/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setConnection(c);setSettings(false);setNotice('Conta do .env validada. Você pode continuar os testes locais.');}catch(e){setError(e instanceof Error?e.message:'Falha ao conectar');}finally{setBusy('');}}}>
      <div className="studio-title"><h2><Instagram size={20}/>Conectar conta profissional</h2><button type="button" className="studio-icon" onClick={()=>setSettings(false)} aria-label="Fechar configurações"><X/></button></div>
      <p>As configurações ficam no arquivo <code>.env</code> da raiz do projeto. Preencha:</p>
      {connection.error&&<p className="studio-error">Instagram pendente: {connection.error}. A biblioteca e a edição local continuam disponíveis.</p>}
      <pre className="studio-caption-review">{'INSTAGRAM_USER_ID=\nINSTAGRAM_ACCESS_TOKEN=\nINSTAGRAM_API_VERSION=v26.0\nINSTAGRAM_PUBLIC_BASE_URL='}</pre>
      <p>A URL pública pode ficar vazia durante os testes locais. O token precisa das permissões instagram_business_basic e instagram_business_content_publish.</p>
      <p>Salve o .env e clique abaixo para validar a conta. As credenciais são lidas pelo backend e não aparecem nesta tela.</p>
      <a href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/" target="_blank" rel="noreferrer">Instruções oficiais da Meta ↗</a>
      {error&&<p className="studio-error" role="alert">{error}</p>}<button disabled={!!busy} className="studio-primary">{busy||'Validar configuração do .env'}</button>
    </form></div>}
    {publishReview&&active&&<div className="studio-modal-backdrop"><div className="studio-modal"><h2>Publicar em @{connection.username}?</h2><p>Vídeo: {active.source_name}</p><p className="studio-caption-review">{combinedCaption(active.caption,active.affiliate_url)||'Sem descrição'}</p><p>O vídeo revisado será publicado como Reel na conta acima.</p><div className="studio-pair"><button className="studio-secondary" onClick={()=>setPublishReview(false)}>Voltar à revisão</button><button className="studio-primary" onClick={publish}>Publicar agora</button></div></div></div>}
  </div>;
}
