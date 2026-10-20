import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {resolve} from 'node:path';import {tmpdir} from 'node:os';
import {connectInstagram,instagramStatus,publishEdit} from '../src/services/instagram.service.js';
import {store,type VideoEdit} from '../src/services/local.service.js';
test('publicação usa API oficial em etapas e impede envio repetido (HTTP simulado)',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'clipai-instagram-'));process.env.LOCAL_DATA_DIR=dir;process.env.CLIPAI_ENV_FILE=resolve(dir,'.env');
  const original=globalThis.fetch;const calls:string[]=[];
  globalThis.fetch=(async(input: string|URL,options:RequestInit)=>{
    const url=new URL(String(input));assert.equal(url.hostname,'graph.instagram.com');assert.equal((options.headers as Record<string,string>).Authorization,'Bearer test-token');calls.push(url.pathname);
    const path=url.pathname;let data:object;
    if(path.endsWith('/123/media_publish'))data={id:'published-id'};
    else if(path.endsWith('/123/media')){const form=new URLSearchParams(String(options.body));assert.equal(form.get('caption'),'Descrição do produto\n\nComente LINK para receber o link do produto no Direct.\n\nhttps://loja.example/item?ref=abc&sub_id=video%201');assert.equal(form.get('media_type'),'REELS');data={id:'container-id'};}
    else if(path.endsWith('/container-id'))data={status_code:'FINISHED'};
    else if(path.endsWith('/published-id'))data={permalink:'https://www.instagram.com/reel/test/'};
    else data={id:'123',username:'loja'};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try{
    await connectInstagram({userId:'123',token:'test-token',apiVersion:'v25.0',publicBaseUrl:''});
    const localCalls=calls.length;await assert.rejects(publishEdit('edit-test'),/URL HTTPS pública/);assert.equal(calls.length,localCalls);
    await connectInstagram({userId:'123',token:'',apiVersion:'v25.0',publicBaseUrl:'https://media.example.com'});
    assert.equal((await instagramStatus()).username,'loja');assert.ok(!('token' in await instagramStatus()));
    const edit:VideoEdit={id:'edit-test',created_at:new Date().toISOString(),source_id:'source',source_name:'produto.mp4',category:'Produtos',caption:'Descrição do produto',affiliate_url:'https://loja.example/item?ref=abc&sub_id=video%201',watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:'/api/files/videos/edits/edit-test.mp4',status:'ready',error:null,publish_state:'idle'};
    await store.change(db=>{db.edits.push(edit);});await publishEdit(edit.id);
    for(let i=0;i<100;i++){if((await store.read()).edits[0].instagram_permalink)break;await new Promise(r=>setTimeout(r,10));}
    assert.equal((await store.read()).edits[0].publish_state,'published');assert.equal(calls.filter(c=>c.endsWith('/media_publish')).length,1);
    await assert.rejects(publishEdit(edit.id),(e:any)=>e.status===409);
  }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
