import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve} from 'node:path';
import {simulateCommentReply} from '../src/services/comment-automation.service.js';
import {store,type VideoEdit} from '../src/services/local.service.js';
test('simulação usa o produto correto sem token, webhook, publicação ou envio externo',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'clipai-simulation-'));process.env.LOCAL_DATA_DIR=dir;
  const original=globalThis.fetch;globalThis.fetch=(async()=>{throw new Error('Simulação não pode chamar a rede');}) as typeof fetch;
  try{
    const example=await simulateCommentReply({comment:'Quero LINK!',affiliate_url:'https://loja.example/produto?ref=abc'});
    assert.equal(example.simulation,true);assert.equal(example.matched,true);assert.deepEqual(example.steps?.map(s=>s.type),['public_reply','direct_message']);assert.match(example.steps![1].text,/ref=abc/);
    const ignored=await simulateCommentReply({comment:'linkado',affiliate_url:'https://loja.example/produto'});assert.equal(ignored.matched,false);
    const edit:VideoEdit={id:'draft',created_at:new Date().toISOString(),source_id:'source',source_name:'Produto local',category:'Produtos',caption:'Produto',affiliate_url:'https://loja.example/certo?ref=local',watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:null,status:'queued',error:null,publish_state:'idle',auto_dm_enabled:true};
    await store.change(db=>{db.edits.push(edit);});
    const simulation=await simulateCommentReply({edit_id:'draft',comment:'LINK',affiliate_url:'https://loja.example/errado'});
    assert.match(simulation.steps![1].text,/certo\?ref=local/);assert.ok(!simulation.steps![1].text.includes('errado'));
    const db=await store.read();assert.equal(db.comment_replies.length,0);assert.equal(db.edits[0].publish_state,'idle');assert.equal(db.edits[0].status,'queued');
  }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
