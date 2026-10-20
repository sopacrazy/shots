import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {createHmac} from 'node:crypto';
import http from 'node:http';
import {verifyWebhookSignature,hasLinkKeyword,saveAutomation,acceptCommentEvents,processCommentReply,subscribeComments,automationStatus} from '../src/services/comment-automation.service.js';
import {store,LocalStore,type VideoEdit} from '../src/services/local.service.js';
import {writeSettings} from '../src/services/settings.service.js';

test('palavra LINK reconhece maiúsculas e pontuação, sem pegar outras palavras',()=>{
  for(const text of ['LINK','link','Quero o link!','💚 LINK por favor','ＬＩＮＫ'])assert.equal(hasLinkKeyword(text),true);
  for(const text of ['linktree','hyperlink','linkado','meu_link','sem palavra',null,42])assert.equal(hasLinkKeyword(text),false);
});
test('assinatura HMAC exige bytes originais, assinatura válida e segredo correto',()=>{
  const bytes=Buffer.from('{"object":"instagram"}');const signature='sha256='+createHmac('sha256','secret').update(bytes).digest('hex');
  assert.equal(verifyWebhookSignature(bytes,signature,'secret'),true);
  assert.equal(verifyWebhookSignature(Buffer.from('{ "object": "instagram" }'),signature,'secret'),false);
  assert.equal(verifyWebhookSignature(bytes,signature,'wrong'),false);
  assert.equal(verifyWebhookSignature(bytes,undefined,'secret'),false);
  assert.equal(verifyWebhookSignature(bytes,'sha256=bad','secret'),false);
});

test('resposta pública natural antes do Direct; produto correto; deduplicação; falhas e webhook',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'clipai-comments-'));
  process.env.NODE_ENV='test';process.env.LOCAL_DATA_DIR=directory;process.env.CLIPAI_ENV_FILE=resolve(directory,'.env');
  await writeSettings({INSTAGRAM_USER_ID:'123',INSTAGRAM_ACCESS_TOKEN:'test-token',INSTAGRAM_API_VERSION:'v25.0',INSTAGRAM_PUBLIC_BASE_URL:'https://public.example',INSTAGRAM_USERNAME:'loja'});
  const original=globalThis.fetch;const calls:Array<{path:string;params:URLSearchParams}>=[];
  let mode:'ok'|'public-failure'|'public-timeout'|'private-failure'='ok';
  globalThis.fetch=(async(input:string|URL,options:RequestInit)=>{
    const url=new URL(String(input));assert.equal(url.hostname,'graph.instagram.com');
    const params=new URLSearchParams(String(options.body));calls.push({path:url.pathname,params});
    if(url.pathname.endsWith('/replies')){
      if(mode==='public-timeout')throw new Error('Timeout sem confirmação');
      if(mode==='public-failure')return new Response(JSON.stringify({error:{message:'Sem permissão',code:10}}),{status:403});
      return new Response(JSON.stringify({id:'public-reply-id'}));
    }
    if(url.pathname.endsWith('/messages')){
      if(mode==='private-failure')return new Response(JSON.stringify({error:{message:'Direct indisponível',code:10}}),{status:403});
      return new Response(JSON.stringify({recipient_id:'visitor',message_id:'dm-id'}));
    }
    return new Response(JSON.stringify({success:true}));
  }) as typeof fetch;
  const event=(id:string,media='111',text='LINK',from='456')=>({object:'instagram',entry:[{id:'123',time:Math.floor(Date.now()/1000),changes:[{field:'comments',value:{id,text,media:{id:media},from:{id:from,username:from==='123'?'loja':'cliente'}}}]}]});
  const fixture=(id:string,media:string,link:string|null,enabled=true):VideoEdit=>({id,created_at:new Date().toISOString(),source_id:'source',source_name:id+'.mp4',category:'Produtos',caption:'Descrição',affiliate_url:link,watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:'/api/files/video.mp4',status:'ready',error:null,publish_state:'published',instagram_media_id:media,instagram_account_id:'123',auto_dm_enabled:enabled});
  let server:http.Server|undefined;
  try{
    await saveAutomation({enabled:true,app_secret:'test-app-secret'});
    await store.change(db=>{db.edits.push(fixture('produto-a','111','https://loja.example/a?ref=abc'),fixture('produto-b','222','https://loja.example/b?ref=xyz'),fixture('sem-link','333',null),fixture('pausado','444','https://loja.example/d',false));});
    await subscribeComments();assert.equal((await automationStatus()).subscribed,true);assert.equal(calls[0].params.get('subscribed_fields'),'comments');calls.length=0;
    assert.deepEqual(await acceptCommentEvents(event('1001','111','linkado')),[]);
    assert.deepEqual(await acceptCommentEvents(event('1002','111','LINK','123')),[]);
    assert.deepEqual(await acceptCommentEvents(event('1003','333')),[]);
    assert.deepEqual(await acceptCommentEvents(event('1004','444')),[]);
    assert.deepEqual(await acceptCommentEvents(event('1005','999')),[]);
    const wrong=event('1006');wrong.entry[0].id='999';assert.deepEqual(await acceptCommentEvents(wrong),[]);
    const ids=await acceptCommentEvents(event('1007','222','Quero o LINK!'));
    assert.deepEqual(ids,['123:1007']);
    await Promise.all([processCommentReply(ids[0]),processCommentReply(ids[0])]);
    assert.equal(calls.length,2);assert.ok(calls[0].path.endsWith('/1007/replies'));assert.match(calls[0].params.get('message')!,/Vou|vou/);
    assert.ok(calls[1].path.endsWith('/123/messages'));assert.deepEqual(JSON.parse(calls[1].params.get('recipient')!),{comment_id:'1007'});
    const dm=JSON.parse(calls[1].params.get('message')!).text;assert.match(dm,/https:\/\/loja.example\/b\?ref=xyz/);assert.ok(!dm.includes('/a?'));
    assert.deepEqual(await acceptCommentEvents(event('1007','222')),[]);await processCommentReply(ids[0]);assert.equal(calls.length,2);
    let record=(await store.read()).comment_replies[0];assert.equal(record.public_state,'sent');assert.equal(record.private_state,'sent');
    const reopened=await new LocalStore(directory).read();assert.equal(reopened.comment_replies[0].private_message_id,'dm-id');
    mode='public-failure';const failed=(await acceptCommentEvents(event('1008')))[0];await processCommentReply(failed);record=(await store.read()).comment_replies.find(r=>r.id===failed)!;assert.equal(record.public_state,'failed');assert.equal(record.private_state,'cancelled');
    mode='public-timeout';const unknown=(await acceptCommentEvents(event('1009')))[0];await processCommentReply(unknown);record=(await store.read()).comment_replies.find(r=>r.id===unknown)!;assert.equal(record.public_state,'unknown');assert.equal(record.private_state,'cancelled');const before=calls.length;await processCommentReply(unknown);assert.equal(calls.length,before);
    mode='private-failure';const dmFailed=(await acceptCommentEvents(event('1010')))[0];await processCommentReply(dmFailed);record=(await store.read()).comment_replies.find(r=>r.id===dmFailed)!;assert.equal(record.public_state,'sent');assert.equal(record.private_state,'failed');
    mode='ok';
    // Host público só acessa o callback; outros comandos continuam locais.
    const {default:app}=await import('../src/index.js');server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.on('listening',r));
    const port=(server.address() as {port:number}).port;
    const request=(path:string,method='GET',body?:Buffer,signature?:string)=>new Promise<{status:number;body:string}>((resolve,reject)=>{
      const req=http.request({hostname:'127.0.0.1',port,path,method,agent:false,headers:{Host:'public.example','Content-Type':'application/json',...(signature?{'X-Hub-Signature-256':signature}:{})}},res=>{let text='';res.setEncoding('utf8');res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode!,body:text}));});req.on('error',reject);if(body)req.write(body);req.end();
    });
    const settings=await automationStatus();assert.ok(!('appSecret'in settings));
    const validChallenge=await request('/api/instagram/webhook?'+new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':settings.verify_token,'hub.challenge':'challenge-123'}));assert.equal(validChallenge.status,200);assert.equal(validChallenge.body,'challenge-123');
    assert.equal((await request('/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x')).status,403);
    assert.equal((await request('/api/instagram/automation')).status,403);
    const raw=Buffer.from(JSON.stringify(event('1011')));const signature='sha256='+createHmac('sha256','test-app-secret').update(raw).digest('hex');
    assert.equal((await request('/api/instagram/webhook','POST',raw)).status,403);
    assert.equal((await request('/api/instagram/webhook','POST',Buffer.from('{}'),signature)).status,403);
    const accepted=await request('/api/instagram/webhook','POST',raw,signature);assert.equal(accepted.status,200);
    for(let i=0;i<200;i++){if((await store.read()).comment_replies.find(r=>r.comment_id==='1011')?.private_state==='sent')break;await new Promise(r=>setTimeout(r,10));}
    assert.equal((await store.read()).comment_replies.find(r=>r.comment_id==='1011')?.private_state,'sent');
    const callCount=calls.length;assert.equal((await request('/api/instagram/webhook','POST',raw,signature)).status,200);assert.equal(calls.length,callCount);
    await saveAutomation({enabled:false});assert.deepEqual(await acceptCommentEvents(event('1012')),[]);
  }finally{globalThis.fetch=original;if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}await rm(directory,{recursive:true,force:true});}
});
