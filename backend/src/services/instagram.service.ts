import { publicationCaption } from './publication.service.js';
import {store,problem,type VideoEdit} from './local.service.js';
import {readSettings,writeSettings} from './settings.service.js';
export interface InstagramConfig { userId:string; token:string; apiVersion:string; publicBaseUrl:string; username?:string; }
export function validateInstagramConfig(body: Record<string,unknown>):InstagramConfig {
  const {userId,token,apiVersion,publicBaseUrl}=body;
  if(typeof userId!=='string'||!/^\d+$/.test(userId))throw problem('ID da conta inválido');
  if(typeof token!=='string'||!token.trim()||token.length>4096)throw problem('Token inválido');
  if(typeof apiVersion!=='string'||!/^v\d+\.0$/.test(apiVersion))throw problem('Informe a versão da API habilitada no seu app Meta (ex.: v25.0)');
  if(publicBaseUrl!==undefined&&publicBaseUrl!==null&&typeof publicBaseUrl!=='string')throw problem('URL pública inválida');
  const publicUrl=typeof publicBaseUrl==='string'?publicBaseUrl.trim():'';
  if(!publicUrl)return {userId,token:token.trim(),apiVersion,publicBaseUrl:''};
  let url:URL;try{url=new URL(publicUrl);}catch{throw problem('Informe uma URL HTTPS pública válida ou deixe em branco para testar localmente');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw problem('Use uma URL HTTPS pública ou deixe em branco para testar localmente');
  return {userId,token:token.trim(),apiVersion,publicBaseUrl:url.href.replace(/\/$/,'')};
}
export async function readInstagramConfig():Promise<InstagramConfig|null>{
  const env=await readSettings();
  if(!env.INSTAGRAM_USER_ID?.trim()||!env.INSTAGRAM_ACCESS_TOKEN?.trim())return null;
  const config=validateInstagramConfig({userId:env.INSTAGRAM_USER_ID.trim(),token:env.INSTAGRAM_ACCESS_TOKEN,apiVersion:env.INSTAGRAM_API_VERSION?.trim(),publicBaseUrl:env.INSTAGRAM_PUBLIC_BASE_URL??''});
  return {...config,username:env.INSTAGRAM_USERNAME?.trim()||undefined};
}
export async function graph(config:InstagramConfig,path:string,method='GET',params:Record<string,string>={}):Promise<Record<string,any>>{
  const url=new URL(`https://graph.instagram.com/${config.apiVersion}/${path}`);
  const headers:Record<string,string>={Authorization:`Bearer ${config.token}`};
  let body:URLSearchParams|undefined;
  if(method==='GET')for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  else {headers['Content-Type']='application/x-www-form-urlencoded';body=new URLSearchParams(params);}
  const result=await fetch(url,{method,headers,body,signal:AbortSignal.timeout(60000)});
  const data=await result.json() as Record<string,any>;
  if(!result.ok||data.error)throw Object.assign(problem(`Instagram: ${data.error?.message??'Falha na API'}`,502),{confirmedFailure:true,metaStatus:result.status,metaCode:data.error?.code});
  return data;
}
export async function connectInstagram(body:Record<string,unknown>){
  const previous=await readInstagramConfig();
  const token=typeof body.token==='string'&&body.token.trim()?body.token:(previous&&previous.userId===(body.userId??previous.userId)?previous.token:'');
  const config=validateInstagramConfig({...previous,...body,token});
  const profile=await graph(config,config.userId,'GET',{fields:'id,username'});
  if(!profile.username)throw problem('A API não retornou o perfil. Confira o token e o ID da conta');
  config.username=String(profile.username);
  await writeSettings({INSTAGRAM_USER_ID:config.userId,INSTAGRAM_ACCESS_TOKEN:config.token,INSTAGRAM_API_VERSION:config.apiVersion,INSTAGRAM_PUBLIC_BASE_URL:config.publicBaseUrl,INSTAGRAM_USERNAME:config.username});
  return {configured:true,username:config.username,userId:config.userId,apiVersion:config.apiVersion,publicBaseUrl:config.publicBaseUrl};
}
export async function instagramStatus(){
  try{
    const config=await readInstagramConfig();
    return config?{configured:true,username:config.username,userId:config.userId,apiVersion:config.apiVersion,publicBaseUrl:config.publicBaseUrl}:{configured:false};
  }catch(e){
    if((e as {status?:number}).status!==400)throw e;
    return {configured:false,error:e instanceof Error?e.message:'Configuração do Instagram inválida'};
  }
}
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function publishEdit(id:string,expectedAccountId?:string){
  const config=await readInstagramConfig();if(!config)throw problem('Configure sua conta profissional do Instagram primeiro');
  if(expectedAccountId&&config.userId!==expectedAccountId)throw problem('A conta do Instagram mudou desde o agendamento',409);
  if(!config.publicBaseUrl)throw problem('Configure a URL HTTPS pública antes de publicar no Instagram. Edição, download e simulação funcionam localmente.');
  const job=await store.change(db=>{
    const edit=db.edits.find(e=>e.id===id);if(!edit)throw problem('Edição não encontrada',404);
    if(edit.status!=='ready'||!edit.output_url)throw problem('Aguarde o vídeo ficar pronto');
    if(['processing','published','unknown'].includes(edit.publish_state))throw problem('Esta edição já foi enviada ou precisa de conferência no Instagram',409);
    edit.publish_state='processing';edit.publish_error=undefined;return edit;
  });
  // Não aguarda processamento remoto dentro da resposta HTTP.
  void runPublish(job,config).catch(e=>console.error('Falha ao registrar publicação:',e.message));
  return {publishing:true};
}
async function runPublish(job:VideoEdit,config:InstagramConfig){
  let attempted=false;
  try{
    let container=job.instagram_container_id;
    if(!container){
      const response=await graph(config,config.userId+'/media','POST',{media_type:'REELS',video_url:config.publicBaseUrl+job.output_url,caption:publicationCaption(job.caption,job.affiliate_url),share_to_feed:'true'});
      if(!response.id)throw new Error('Instagram não retornou o contêiner');
      container=String(response.id);
      await store.change(db=>{db.edits.find(e=>e.id===job.id)!.instagram_container_id=container;});
    }
    let finished=false;
    for(let attempt=0;attempt<60;attempt++){
      const response=await graph(config,container,'GET',{fields:'status_code,status'});
      if(response.status_code==='FINISHED'){finished=true;break;}
      if(['ERROR','EXPIRED'].includes(response.status_code)){
        await store.change(db=>{db.edits.find(e=>e.id===job.id)!.instagram_container_id=undefined;});
        throw new Error('O Instagram não processou o arquivo. Confira a URL pública e o formato do vídeo.');
      }
      if(response.status_code==='PUBLISHED'){attempted=true;throw new Error('O contêiner já foi publicado. Confira a conta antes de tentar novamente.');}
      await delay(3000);
    }
    if(!finished)throw new Error('Instagram ainda está processando. Tente consultar e publicar novamente em alguns minutos.');
    await store.change(db=>{db.edits.find(e=>e.id===job.id)!.publish_attempted_at=new Date().toISOString();});
    attempted=true;
    const response=await graph(config,config.userId+'/media_publish','POST',{creation_id:container});
    if(!response.id)throw new Error('Sem confirmação da publicação. Confira o perfil do Instagram.');
    await store.change(db=>{const e=db.edits.find(e=>e.id===job.id)!;e.publish_state='published';e.published_at=new Date().toISOString();e.instagram_media_id=String(response.id);e.instagram_account_id=config.userId;});
    try{const media=await graph(config,String(response.id),'GET',{fields:'permalink'});if(media.permalink)await store.change(db=>{db.edits.find(e=>e.id===job.id)!.instagram_permalink=String(media.permalink);});}catch{/* publicação já confirmada */}
  }catch(error){
    await store.change(db=>{const e=db.edits.find(e=>e.id===job.id)!;if(e.publish_state!=='published'){e.publish_state=attempted?'unknown':'error';e.publish_error=error instanceof Error?error.message:'Falha na publicação';}});
  }
}
