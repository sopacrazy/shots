import {createHmac,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,rename,unlink,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import PQueue from 'p-queue';
import {dataDirectory,store,problem,type CommentReply} from './local.service.js';
import {readInstagramConfig,graph} from './instagram.service.js';
import {affiliateUrl} from './publication.service.js';
import {readSettings,writeSettings} from './settings.service.js';

interface AutomationConfig {
  enabled:boolean; appSecret:string; verifyToken:string;
  subscriptionAccountId?:string; subscribedAt?:string;
  verifiedAt?:string; lastEventAt?:string;
}
const settingsPath=()=>resolve(dataDirectory(),'instagram-automation.json');
let settingsWrites:Promise<unknown>=Promise.resolve();
export async function readAutomationConfig():Promise<AutomationConfig|null>{
  await settingsWrites;
  return readSettingsFile();
}
async function readSettingsFile():Promise<AutomationConfig|null>{
  let metadata:Partial<AutomationConfig>={};
  try{metadata=JSON.parse(await readFile(settingsPath(),'utf8'));}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const env=await readSettings();
  if(!env.INSTAGRAM_APP_SECRET&&!env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN&&!Object.keys(metadata).length)return null;
  return {...metadata,enabled:env.INSTAGRAM_AUTOMATION_ENABLED==='true',appSecret:env.INSTAGRAM_APP_SECRET?.trim()??'',verifyToken:env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim()??''};
}
function changeSettings<T>(fn:(old:AutomationConfig|null)=>{config:AutomationConfig;result:T}):Promise<T>{
  const operation=settingsWrites.then(async()=>{
    const {config,result}=fn(await readSettingsFile());
    const env=await readSettings();const values={INSTAGRAM_APP_SECRET:config.appSecret,INSTAGRAM_WEBHOOK_VERIFY_TOKEN:config.verifyToken,INSTAGRAM_AUTOMATION_ENABLED:String(config.enabled)};
    if(Object.entries(values).some(([name,value])=>env[name]!==value))await writeSettings(values);
    const {appSecret,verifyToken,enabled,...metadata}=config;
    await mkdir(dataDirectory(),{recursive:true});const temp=`${settingsPath()}.${randomBytes(8).toString('hex')}.tmp`;
    try{await writeFile(temp,JSON.stringify(metadata,null,2),{flag:'wx',mode:0o600});await rename(temp,settingsPath());}
    finally{await unlink(temp).catch(()=>{});}return result;
  });settingsWrites=operation.catch(()=>{});return operation;
}
export function constantEqual(left:string,right:string){const a=Buffer.from(left);const b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}
export function verifyWebhookSignature(body:Buffer,signature:string|undefined,appSecret:string){
  if(!appSecret||!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
  return constantEqual(`sha256=${createHmac('sha256',appSecret).update(body).digest('hex')}`,signature.toLowerCase());
}
export function hasLinkKeyword(text:unknown){return typeof text==='string'&&/(^|[^\p{L}\p{N}_])link(?=$|[^\p{L}\p{N}_])/iu.test(text.normalize('NFKC'));}
export async function automationStatus(){
  const [settings,account]=await Promise.all([readAutomationConfig(),readInstagramConfig()]);
  const replies=(await store.read()).comment_replies;
  return {enabled:settings?.enabled??false,configured:!!settings?.appSecret,
    verify_token:settings?.verifyToken??'',webhook_url:account?.publicBaseUrl?`${account.publicBaseUrl}/api/instagram/webhook`:null,
    subscribed:!!settings?.subscribedAt&&settings.subscriptionAccountId===account?.userId,
    verified_at:settings?.verifiedAt??null,last_event_at:settings?.lastEventAt??null,
    sent:replies.filter(r=>r.private_state==='sent').length,
    failed:replies.filter(r=>['failed','unknown'].includes(r.public_state)||['failed','unknown'].includes(r.private_state)).length,
    recent:replies.slice(-30).reverse().map(({affiliate_url,private_text,...rest})=>rest)};
}
export async function saveAutomation(body:Record<string,unknown>){
  if(typeof body.enabled!=='boolean')throw problem('Informe se a automação está ativada');
  if(body.app_secret!==undefined&&(typeof body.app_secret!=='string'||body.app_secret.length>512))throw problem('App Secret inválido');
  if(body.enabled&&!await readInstagramConfig())throw problem('Conecte sua conta profissional do Instagram primeiro');
  await changeSettings(old=>{
    const appSecret=typeof body.app_secret==='string'&&body.app_secret.trim()?body.app_secret.trim():old?.appSecret;
    if(!appSecret)throw problem('Informe o App Secret do aplicativo Meta que assina os webhooks');
    const config={...old,enabled:body.enabled as boolean,appSecret,verifyToken:old?.verifyToken||randomBytes(32).toString('hex')};
    return {config,result:true};
  });if(body.enabled)void startCommentAutomation().catch(e=>console.error('Falha ao retomar respostas:',e.message));return automationStatus();
}
export async function subscribeComments(){
  const [account,settings]=await Promise.all([readInstagramConfig(),readAutomationConfig()]);
  if(!account||!settings)throw problem('Configure o Instagram e salve o App Secret primeiro');
  const response=await graph(account,`${account.userId}/subscribed_apps`,'POST',{subscribed_fields:'comments'});
  if(response.success!==true)throw problem('A Meta não confirmou a assinatura dos comentários',502);
  await changeSettings(old=>{if(!old)throw problem('Configure a automação');return{config:{...old,subscriptionAccountId:account.userId,subscribedAt:new Date().toISOString()},result:true};});
  return automationStatus();
}
export async function markWebhookVerified(){await changeSettings(old=>{if(!old)throw problem('Webhook não configurado');return{config:{...old,verifiedAt:new Date().toISOString()},result:true};});}
const PUBLIC_REPLIES=[
  'Claro! Vou te mandar o link no Direct 😊',
  'Pode deixar! Vou te passar o link por mensagem 😊',
  'Oi! Vou mandar o link desse produto no seu Direct 🛍️',
  'Combinado! Vou te enviar o link por mensagem 😊',
];
export function commentReplyTexts(key:string,link:string){
  const index=createHash('sha256').update(key).digest()[0]%PUBLIC_REPLIES.length;
  return {public_text:PUBLIC_REPLIES[index],private_text:`Oi! 😊 Aqui está o link do produto que você pediu:\n${link}`};
}
// Prévia pura: não aceita eventos no webhook, não entra na fila e não chama a Meta.
export async function simulateCommentReply(body:Record<string,unknown>){
  const comment=body.comment??'LINK';
  if(typeof comment!=='string'||comment.length>2000)throw problem('Comentário de teste inválido');
  let product='Produto de teste';let link:string|null;
  if(body.edit_id){
    const edit=(await store.read()).edits.find(e=>e.id===body.edit_id);
    if(!edit)throw problem('Produto não encontrado',404);
    product=edit.source_name;link=affiliateUrl(edit.affiliate_url);
    if(edit.auto_dm_enabled===false)return{simulation:true,matched:false,reason:'O envio automático está pausado para este produto.'};
  }else{
    link=affiliateUrl(body.affiliate_url);
    if(typeof body.product==='string'&&body.product.trim())product=body.product.trim().slice(0,100);
  }
  if(!link)throw problem('Informe um link de afiliado para a simulação');
  if(!hasLinkKeyword(comment))return{simulation:true,matched:false,reason:'Este comentário não contém a palavra LINK. Nenhuma resposta seria enviada.'};
  const texts=commentReplyTexts(`simulation:${product}:${comment}`,link);
  return {simulation:true,matched:true,product,steps:[{type:'public_reply',text:texts.public_text},{type:'direct_message',text:texts.private_text}]};
}
const recordId=(accountId:string,commentId:string)=>`${accountId}:${commentId}`;
// Aceita somente comentários assinados do perfil conectado e de posts mapeados.
export async function acceptCommentEvents(payload:unknown):Promise<string[]>{
  const [settings,account]=await Promise.all([readAutomationConfig(),readInstagramConfig()]);
  if(!settings?.enabled||!account)return[];
  if(!payload||typeof payload!=='object')return[];
  const data=payload as {object?:unknown;entry?:unknown};
  if(data.object!=='instagram'||!Array.isArray(data.entry))return[];
  const candidates:Array<{id:string;media:string;username:string|null}>=[];
  for(const entry of data.entry){
    if(!entry||String(entry.id)!==account.userId||!Array.isArray(entry.changes))continue;
    if(typeof entry.time==='number'&&entry.time*1000<Date.now()-7*86400000)continue;
    for(const change of entry.changes){
      const value=change?.value;
      if(change?.field!=='comments'||!value||!hasLinkKeyword(value.text)||['remove','delete'].includes(value.verb))continue;
      if(String(value.from?.id)===account.userId||(account.username&&typeof value.from?.username==='string'&&value.from.username.toLowerCase()===account.username.toLowerCase()))continue;
      const id=String(value.id??''),media=String(value.media?.id??'');
      if(!/^\d+$/.test(id)||!/^\d+$/.test(media))continue;
      candidates.push({id,media,username:typeof value.from?.username==='string'?value.from.username.slice(0,100):null});
    }
  }
  await changeSettings(old=>{if(!old)throw problem('Webhook não configurado');return{config:{...old,lastEventAt:new Date().toISOString()},result:true};});
  if(!candidates.length)return[];
  return store.change(db=>{
    const accepted:string[]=[];
    for(const comment of candidates){
      const id=recordId(account.userId,comment.id);
      const existing=db.comment_replies.find(r=>r.id===id);
      if(existing){if(existing.public_state==='pending'||(existing.public_state==='sent'&&existing.private_state==='pending'))accepted.push(id);continue;}
      const edits=db.edits.filter(e=>e.instagram_media_id===comment.media&&e.publish_state==='published'&&(!e.instagram_account_id||e.instagram_account_id===account.userId));
      // Uma mídia nunca pode apontar ambiguamente para dois produtos.
      if(edits.length!==1)continue;
      const edit=edits[0];if(edit.auto_dm_enabled===false||!edit.affiliate_url)continue;
      const link=affiliateUrl(edit.affiliate_url);if(!link)continue;
      const texts=commentReplyTexts(id,link);
      const now=new Date().toISOString();
      const reply:CommentReply={id,account_id:account.userId,comment_id:comment.id,media_id:comment.media,edit_id:edit.id,username:comment.username,
        product:edit.source_name,affiliate_url:link,...texts,
        public_state:'pending',private_state:'pending',created_at:now,updated_at:now};
      db.comment_replies.push(reply);accepted.push(id);
    }return accepted;
  });
}
const queue=new PQueue({concurrency:1,interval:1000,intervalCap:1});
const scheduled=new Set<string>();
export function scheduleCommentReplies(ids:string[]){for(const id of ids){if(scheduled.has(id))continue;scheduled.add(id);void queue.add(()=>processCommentReply(id)).catch(e=>console.error('Falha na automação LINK:',e.message)).finally(()=>scheduled.delete(id));}}
export async function startCommentAutomation(){
  const db=await store.read();scheduleCommentReplies(db.comment_replies.filter(r=>r.public_state==='pending'||(r.public_state==='sent'&&r.private_state==='pending')).map(r=>r.id));
}
export async function processCommentReply(id:string){
  const settings=await readAutomationConfig();const account=await readInstagramConfig();
  if(!settings?.enabled||!account)return;
  let reply=(await store.read()).comment_replies.find(r=>r.id===id);
  if(!reply||reply.account_id!==account.userId||Date.parse(reply.created_at)<Date.now()-7*86400000)return;
  const permitted=(await store.read()).edits.find(e=>e.id===reply!.edit_id);
  if(!permitted||permitted.auto_dm_enabled===false)return;
  if(reply.public_state==='pending'){
    const claimed=await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;if(r.public_state!=='pending')return false;r.public_state='sending';r.updated_at=new Date().toISOString();return true;});
    if(!claimed)return;
    try{
      const result=await graph(account,`${reply.comment_id}/replies`,'POST',{message:reply.public_text});
      if(!result.id)throw new Error('A Meta não confirmou a resposta pública. Confira o comentário.');
      await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;r.public_state='sent';r.public_reply_id=String(result.id);r.updated_at=new Date().toISOString();});
    }catch(e){await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;r.public_state=(e as {confirmedFailure?:boolean}).confirmedFailure?'failed':'unknown';r.private_state='cancelled';r.error=e instanceof Error?e.message:'Falha na resposta pública';r.updated_at=new Date().toISOString();});return;}
  }
  // Revalidar a ativação antes da segunda ação permite pausar a automação.
  if(!(await readAutomationConfig())?.enabled||(await readInstagramConfig())?.userId!==account.userId)return;
  if((await store.read()).edits.find(e=>e.id===reply!.edit_id)?.auto_dm_enabled===false)return;
  const claimed=await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;if(r.public_state!=='sent'||r.private_state!=='pending')return false;r.private_state='sending';r.updated_at=new Date().toISOString();return true;});
  if(!claimed)return;
  reply=(await store.read()).comment_replies.find(r=>r.id===id)!;
  try{
    const response=await graph(account,`${account.userId}/messages`,'POST',{recipient:JSON.stringify({comment_id:reply.comment_id}),message:JSON.stringify({text:reply.private_text})});
    if(!response.message_id)throw new Error('A Meta não confirmou o Direct. Confira a conversa antes de reenviar.');
    await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;r.private_state='sent';r.private_message_id=String(response.message_id);r.updated_at=new Date().toISOString();});
  }catch(e){await store.change(db=>{const r=db.comment_replies.find(r=>r.id===id)!;r.private_state=(e as {confirmedFailure?:boolean}).confirmedFailure?'failed':'unknown';r.error=e instanceof Error?e.message:'Falha ao enviar o Direct';r.updated_at=new Date().toISOString();});}
}
