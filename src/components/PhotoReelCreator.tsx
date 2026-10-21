import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {formatPublicationCaption} from '../lib/caption';
import ProductDescriptionAI from './ProductDescriptionAI';

export interface PhotoJob {id:string;source_name:string;caption:string;affiliate_url?:string|null;status:string;error:string|null;output_url:string|null;publish_state:string;publish_error?:string;instagram_permalink?:string;photo_reel?:unknown;media_deleted_at?:string;}
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
async function request(path:string,body?:unknown){const r=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{})});const result=await r.json();if(!r.ok)throw new Error(result.error??'Falha na montagem');return result;}

const steps=[{title:'Fotos',description:'Envie e organize'},{title:'Personalizar',description:'Vídeo e publicação'},{title:'Revisar e gerar',description:'Confira a montagem'}];

export default function PhotoReelCreator({visible=true,edits,focusId,onCreated,onRefresh,connection,initialCaption,initialAffiliate,brand}:{visible?:boolean;edits:PhotoJob[];focusId?:string;onCreated:(id:string)=>void;onRefresh:()=>Promise<void>;connection:{configured:boolean;publicBaseUrl?:string;username?:string};initialCaption:string;initialAffiliate:string;brand:{watermark:string;position:string;logoUrl:string}}){
  const [step,setStep]=useState(0);
  const [photos,setPhotos]=useState<File[]>([]),[music,setMusic]=useState<File|null>(null),[logo,setLogo]=useState<File|null>(null);
  const [previews,setPreviews]=useState<string[]>([]),[musicPreview,setMusicPreview]=useState<string|null>(null);
  const musicInput=useRef<HTMLInputElement>(null),logoInput=useRef<HTMLInputElement>(null);
  const stepPanels=useRef<(HTMLDivElement|null)[]>([]),resultPanel=useRef<HTMLDivElement>(null);
  const stepFocusRequested=useRef(false);
  const editedFields=useRef({caption:false,affiliate:false,watermark:false,position:false});
  const [title,setTitle]=useState('Reel do produto'),[caption,setCaption]=useState(initialCaption),[affiliate,setAffiliate]=useState(initialAffiliate),[autoDm,setAutoDm]=useState(true);
  const [watermark,setWatermark]=useState(brand.watermark),[position,setPosition]=useState(brand.position);
  const [seconds,setSeconds]=useState(3),[transition,setTransition]=useState('fade'),[fit,setFit]=useState('contain'),[volume,setVolume]=useState(.45);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[review,setReview]=useState(false),[created,setCreated]=useState<PhotoJob|null>(null);
  const job=edits.find(e=>e.id===focusId&&e.photo_reel)??created;
  useEffect(()=>{const urls=photos.map(file=>URL.createObjectURL(file));setPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[photos]);
  useEffect(()=>{const url=music?URL.createObjectURL(music):null;setMusicPreview(url);return()=>{if(url)URL.revokeObjectURL(url);};},[music]);
  useEffect(()=>{if(!editedFields.current.caption)setCaption(initialCaption);},[initialCaption]);
  useEffect(()=>{if(!editedFields.current.affiliate)setAffiliate(initialAffiliate);},[initialAffiliate]);
  useEffect(()=>{if(!editedFields.current.watermark)setWatermark(brand.watermark);},[brand.watermark]);
  useEffect(()=>{if(!editedFields.current.position)setPosition(brand.position);},[brand.position]);
  useEffect(()=>{
    stepPanels.current.forEach((panel,index)=>{if(index!==step)panel?.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media=>media.pause());});
    if(!stepFocusRequested.current)return;
    stepFocusRequested.current=false;
    const frame=requestAnimationFrame(()=>{const panel=stepPanels.current[step];if(panel&&panel.getClientRects().length){panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}});
    return()=>cancelAnimationFrame(frame);
  },[step]);
  useEffect(()=>{
    if(!visible||!focusId||job?.id!==focusId)return;
    const frame=requestAnimationFrame(()=>{const panel=resultPanel.current;if(panel&&panel.getClientRects().length){panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}});
    return()=>cancelAnimationFrame(frame);
  },[visible,focusId,job?.id]);
  const goToStep=(next:number)=>{if(next===step)return;stepFocusRequested.current=true;setStep(next);};
  const updateCaption=(value:string)=>{editedFields.current.caption=true;setCaption(value);};

  const duration=Math.max(0,photos.length*seconds-Math.max(0,photos.length-1)*.6);
  const durationLabel=duration.toLocaleString('pt-BR',{maximumFractionDigits:1});
  const publicationCaption=formatPublicationCaption(caption,affiliate);
  const working=job&&(['queued','processing'].includes(job.status)||job.publish_state==='processing');
  const locked=!!busy||!!working;
  const photosReady=photos.length>=2&&photos.length<=12;
  const hasBrand=!!(watermark.trim()||logo||brand.logoUrl);
  const totalSize=[...photos,...(music?[music]:[]),...(logo?[logo]:[])].reduce((sum,file)=>sum+file.size,0);
  const personalizationReady=!!caption.trim()&&publicationCaption.length<=2200&&hasBrand;
  const requirements=[
    ...(!photosReady?['Adicione de 2 a 12 fotos na etapa Fotos.']:[]),
    ...(!caption.trim()?['Escreva a descrição da publicação em Personalizar.']:[]),
    ...(publicationCaption.length>2200?['Reduza a descrição para até 2.200 caracteres, incluindo o link.']:[]),
    ...(!hasBrand?['Adicione uma marca d’água ou um logo em Personalizar.']:[]),
    ...(totalSize>30*1024*1024?['Reduza os arquivos para até 30 MB no total.']:[]),
  ];
  const changeOrder=(index:number,delta:number)=>setPhotos(previous=>{const next=[...previous];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});
  const generate=async()=>{setBusy('Enviando fotos e preparando o vídeo...');setError('');try{
    if(photos.length<2||photos.length>12)throw new Error('Escolha de 2 a 12 fotos.');
    if(photos.some(f=>f.size>5*1024*1024)||music&&music.size>12*1024*1024)throw new Error('Use fotos de até 5 MB e música de até 12 MB.');
    if(totalSize>30*1024*1024)throw new Error('Os arquivos juntos devem ter até 30 MB.');
    const images=await Promise.all(photos.map(api.manual.file));
    const result=await request('/photo-reels',{title,images,music:music?await api.manual.file(music):null,logo:logo?await api.manual.file(logo):null,existing_logo_url:logo?null:brand.logoUrl||null,caption,affiliate_url:affiliate,auto_dm_enabled:autoDm&&!!affiliate.trim(),watermark,watermark_position:position,seconds_per_image:seconds,transition,fit,music_volume:volume});
    setCreated(result);onCreated(result.id);await onRefresh();
  }catch(e){setError(e instanceof Error?e.message:'Erro ao criar Reel');}finally{setBusy('');}};

  return <section className="studio-card photo-reel-creator" id="photo-reel-creator" aria-label="Reel com fotos">
    <div className="tool-panel-heading"><div><h2>Reel com fotos e música</h2><p>Transforme as fotos do produto em um vídeo vertical, pronto para revisar e publicar.</p></div></div>
    <nav className="tool-stepper" aria-label="Etapas do Reel com fotos">
      {steps.map((item,index)=><button type="button" key={item.title} className={`tool-step${step===index?' is-active':''}${step!==index&&(index===0&&photosReady||index===1&&personalizationReady)?' is-complete':''}`} aria-current={step===index?'step':undefined} aria-controls={`photo-reel-step-${index}`} onClick={()=>goToStep(index)}><span className="tool-step-number" aria-hidden="true">{index+1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}
    </nav>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {busy&&<p className="studio-notice" role="status">{busy}</p>}

    <div id="photo-reel-step-0" ref={panel=>{stepPanels.current[0]=panel;}} tabIndex={-1} role="region" aria-labelledby="photo-reel-step-title-0" hidden={step!==0}>
      <div className="tool-panel-heading"><div><h3 id="photo-reel-step-title-0">Escolha as fotos do produto</h3><p>Adicione de 2 a 12 imagens e organize a ordem em que aparecerão no vídeo.</p></div><span className="studio-muted">{photos.length}/12 fotos</span></div>
      <label className="studio-field">Nome da montagem<input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Coleção de verão"/><small>Use um nome fácil de encontrar no histórico.</small></label>
      <label className="studio-field">Adicionar fotos<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={locked} onChange={e=>{setError('');const files=Array.from(e.target.files??[]);if(photos.length+files.length>12){setError('Escolha no máximo 12 fotos.');}else if(files.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>5*1024*1024)){setError('Use fotos PNG, JPEG ou WebP com até 5 MB.');}else setPhotos(prev=>[...prev,...files]);e.target.value='';}}/><small>PNG, JPEG ou WebP · até 5 MB por foto. Você pode adicionar mais fotos depois.</small></label>
      {photos.length===0&&<p className="studio-notice">Suas fotos aparecerão aqui. A primeira imagem será a abertura do Reel.</p>}
      <div className="photo-reel-photos">{photos.map((photo,index)=><article key={`${photo.name}-${photo.lastModified}-${index}`}><img src={previews[index]} alt={`Foto ${index+1}: ${photo.name}`}/><small>{index+1}. {photo.name}</small><div><button type="button" className="studio-secondary" disabled={index===0||locked} aria-label={`Mover foto ${index+1} para antes`} onClick={()=>changeOrder(index,-1)}>←</button><button type="button" className="studio-secondary" disabled={index===photos.length-1||locked} aria-label={`Mover foto ${index+1} para depois`} onClick={()=>changeOrder(index,1)}>→</button><button type="button" className="studio-secondary" disabled={locked} aria-label={`Remover foto ${index+1}`} onClick={()=>setPhotos(prev=>prev.filter((_,i)=>i!==index))}>Remover</button></div></article>)}</div>
      <div className="tool-actions"><p className="studio-muted">{photosReady?`${photos.length} fotos selecionadas. Continue para personalizar.`:'Adicione pelo menos 2 fotos para continuar.'}</p><button type="button" className="studio-primary" disabled={!photosReady} onClick={()=>goToStep(1)}>Continuar para personalizar →</button></div>
    </div>

    <div id="photo-reel-step-1" ref={panel=>{stepPanels.current[1]=panel;}} tabIndex={-1} role="region" aria-labelledby="photo-reel-step-title-1" hidden={step!==1}>
      <div className="tool-panel-heading"><div><h3 id="photo-reel-step-title-1">Personalize seu Reel</h3><p>Ajuste a montagem, escreva a publicação e escolha como sua marca aparece.</p></div></div>
      <h4>Vídeo</h4>
      <div className="studio-pair"><label className="studio-field">Tempo de cada foto<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[2,3,4,5,6,8].map(n=><option value={n} key={n}>{n} segundos</option>)}</select></label><label className="studio-field">Transição<select value={transition} onChange={e=>setTransition(e.target.value)}><option value="fade">Dissolução suave</option><option value="slide">Deslizamento suave</option></select></label></div>
      <label className="studio-field">Enquadramento<select value={fit} onChange={e=>setFit(e.target.value)}><option value="contain">Foto inteira com fundo desfocado</option><option value="cover">Preencher a tela (recorta bordas)</option></select></label>
      <p className="studio-muted">Duração estimada: {durationLabel} segundos · formato vertical 1080 × 1920 · zoom suave automático.</p>
      <details className="tool-options"><summary>Música de fundo <span className="studio-muted">{music?music.name:'Opcional'}</span></summary>
        <label className="studio-field">Adicionar música<input ref={musicInput} type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>12*1024*1024){setError('A música deve ter até 12 MB.');e.target.value='';return;}setError('');setMusic(file??null);}}/><small>MP3 ou WAV · até 12 MB. Use uma música que você tenha permissão para usar. Ela será repetida se for curta e encerrada suavemente.</small></label>
        {musicPreview&&<><audio src={musicPreview} controls preload="metadata"/><button type="button" className="studio-secondary" onClick={()=>{setMusic(null);if(musicInput.current)musicInput.current.value='';}}>Remover música</button></>}
        <label className="studio-field">Volume da música: {Math.round(volume*100)}%<input type="range" min="0" max="100" value={Math.round(volume*100)} onChange={e=>setVolume(Number(e.target.value)/100)}/></label>
      </details>
      <h4>Publicação</h4>
      <label className="studio-field">Descrição do Reel<textarea rows={4} value={caption} maxLength={2200} onChange={e=>updateCaption(e.target.value)} placeholder="Apresente o produto e destaque seus benefícios."/><small>{publicationCaption.length}/2200 caracteres, incluindo a chamada LINK e o link.</small></label>
      <details className="tool-options"><summary>Ajuda para escrever a descrição <span className="studio-muted">Opcional · IA</span></summary><ProductDescriptionAI initialDetails={initialCaption} affiliateLink={affiliate} autoDm={autoDm} currentCaption={caption} onApply={updateCaption}/></details>
      <label className="studio-field">Link de afiliado (opcional)<input type="url" value={affiliate} maxLength={2048} onChange={e=>{editedFields.current.affiliate=true;setAffiliate(e.target.value);}} placeholder="https://loja.com/seu-produto"/></label>
      <label className="automation-checkbox"><input type="checkbox" checked={autoDm} disabled={!affiliate.trim()} onChange={e=>setAutoDm(e.target.checked)}/>Responder LINK e enviar o link pelo Direct</label>
      {!affiliate.trim()&&<p className="studio-muted">Adicione o link de afiliado para ativar a resposta automática.</p>}
      <h4>Sua marca</h4>
      <p className="studio-muted">Use uma marca d’água, um logo ou os dois para identificar o vídeo.</p>
      <div className="studio-pair"><label className="studio-field">Marca d’água<input value={watermark} maxLength={60} onChange={e=>{editedFields.current.watermark=true;setWatermark(e.target.value);}} placeholder="Ex.: @sualoja"/></label><label className="studio-field">Posição da marca<select value={position} onChange={e=>{editedFields.current.position=true;setPosition(e.target.value);}}><option value="top-right">Superior direita</option><option value="top-left">Superior esquerda</option><option value="bottom-right">Inferior direita</option><option value="bottom-left">Inferior esquerda</option></select></label></div>
      <label className="studio-field">Logo desta montagem (opcional)<input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0]??null)}/><small>{logo?`Logo selecionado: ${logo.name}`:brand.logoUrl?'O logo salvo da sua marca será usado.':'PNG, JPEG ou WebP. Você também pode usar apenas o texto da marca d’água.'}</small></label>
      {logo&&<button type="button" className="studio-secondary" onClick={()=>{setLogo(null);if(logoInput.current)logoInput.current.value='';}}>Usar {brand.logoUrl?'logo salvo':'apenas marca d’água'}</button>}
      <div className="tool-actions"><button type="button" className="studio-secondary" onClick={()=>goToStep(0)}>← Voltar para fotos</button><button type="button" className="studio-primary" onClick={()=>goToStep(2)}>Revisar montagem →</button></div>
    </div>

    <div id="photo-reel-step-2" ref={panel=>{stepPanels.current[2]=panel;}} tabIndex={-1} role="region" aria-labelledby="photo-reel-step-title-2" hidden={step!==2}>
      <div className="tool-panel-heading"><div><h3 id="photo-reel-step-title-2">Confira antes de gerar</h3><p>O vídeo será criado com estas escolhas. Depois você poderá assistir, baixar e revisar a publicação.</p></div></div>
      <dl className="tool-review-summary"><div><dt>Montagem</dt><dd>{title.trim()||'Reel do produto'}</dd></div><div><dt>Fotos e duração</dt><dd>{photos.length} fotos · aproximadamente {durationLabel} s</dd></div><div><dt>Visual</dt><dd>{transition==='fade'?'Dissolução suave':'Deslizamento suave'} · {fit==='contain'?'foto inteira':'preencher a tela'}</dd></div><div><dt>Música</dt><dd>{music?`${music.name} · volume ${Math.round(volume*100)}%`:'Sem música de fundo'}</dd></div><div><dt>Marca</dt><dd>{[watermark.trim(),logo?'logo desta montagem':brand.logoUrl?'logo salvo':''].filter(Boolean).join(' + ')||'Nenhuma marca selecionada'}</dd></div><div><dt>Resposta automática</dt><dd>{autoDm&&affiliate.trim()?'Ativada para comentários com LINK':'Desativada'}</dd></div></dl>
      <h4>Texto da publicação</h4>
      <p className="studio-caption-review">{publicationCaption||'Escreva a descrição na etapa Personalizar.'}</p>
      {requirements.length>0&&<div className="studio-notice" role="status"><strong>Falta ajustar para gerar:</strong><ul>{requirements.map(item=><li key={item}>{item}</li>)}</ul></div>}
      <div className="tool-actions"><button type="button" className="studio-secondary" onClick={()=>goToStep(1)}>← Voltar para personalizar</button><button type="button" className="studio-primary" disabled={locked||requirements.length>0} onClick={()=>void generate()}>{locked?'Preparando montagem...':'Gerar Reel com fotos e música'}</button></div>
      <p className="studio-muted">Gerar o vídeo não publica no Instagram. Você revisa o resultado antes de publicar.</p>
    </div>

    {job&&<div className="photo-reel-result" ref={resultPanel} tabIndex={-1} role="region" aria-label="Resultado da montagem"><div className="tool-panel-heading"><div><h3>Seu Reel</h3><p>{job.source_name}</p></div></div>{['queued','processing'].includes(job.status)&&<p className="studio-notice" role="status">Montando fotos, zoom, transições e música. O resultado aparecerá aqui.</p>}{job.error&&<p className="studio-error" role="alert">{job.error}</p>}{job.output_url&&<><video src={api.mediaUrl(job.output_url)} controls playsInline preload="metadata"/><p>Assista ao vídeo e confira a música antes de publicar.</p><div className="tool-actions"><a className="studio-secondary" href={api.mediaUrl(job.output_url)+'?download=1'} download>Baixar MP4</a><button type="button" className="studio-primary" disabled={!!busy||!connection.configured||!connection.publicBaseUrl||!['idle','error'].includes(job.publish_state)} onClick={()=>setReview(true)}>{job.publish_state==='published'?'Publicado no Instagram':job.publish_state==='processing'?'Publicando...':'Revisar publicação no Instagram'}</button></div>{(!connection.configured||!connection.publicBaseUrl)&&<p className="studio-notice">Conecte o Instagram e configure o endereço público para publicar este Reel.</p>}<p className="studio-muted">Para agendar, escolha esta montagem no menu Agendamentos.</p></>}{job.media_deleted_at&&<p>Arquivos removidos da VPS. O histórico e a publicação foram preservados.</p>}{job.publish_error&&<p className="studio-error" role="alert">{job.publish_error}</p>}{job.instagram_permalink&&<a href={job.instagram_permalink} target="_blank" rel="noreferrer">Ver Reel no Instagram ↗</a>}</div>}
    {review&&job&&<div className="studio-modal-backdrop"><div className="studio-modal" role="dialog" aria-modal="true" aria-label="Revisar Reel com fotos"><h2>Publicar em @{connection.username}?</h2><p>{job.source_name}</p>{error&&<p className="studio-error" role="alert">{error}</p>}<p className="studio-caption-review">{formatPublicationCaption(job.caption,job.affiliate_url)}</p><div className="studio-pair"><button type="button" className="studio-secondary" disabled={!!busy} onClick={()=>setReview(false)}>Voltar</button><button type="button" className="studio-primary" disabled={!!busy} onClick={async()=>{setBusy('Publicando...');setError('');try{await request('/instagram/publish/'+job.id);setReview(false);await onRefresh();}catch(e){setError(e instanceof Error?e.message:'Erro ao publicar');}finally{setBusy('');}}}>Publicar agora</button></div></div></div>}
  </section>;
}
