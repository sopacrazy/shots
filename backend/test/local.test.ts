import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {LocalStore,row,filePath} from '../src/services/local.service.js';
import {validateInstagramConfig} from '../src/services/instagram.service.js';
test('gravações concorrentes persistem; transação que falha não altera dados',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-store-'));
  try{const db=new LocalStore(dir);await Promise.all(Array.from({length:25},(_,i)=>db.change(s=>{s.folders.push({...row(),name:String(i),emoji:'📁',color:'#fff',default_language:null,default_voice_id:null});})));
    assert.equal((await new LocalStore(dir).read()).folders.length,25);
    await assert.rejects(db.change(s=>{s.folders=[];throw new Error('rollback');}));assert.equal((await db.read()).folders.length,25);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('banco corrompido não é substituído por banco vazio',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-corrupt-'));
  try{await writeFile(join(dir,'database.json'),'invalid');await assert.rejects(new LocalStore(dir).read());assert.equal(await readFile(join(dir,'database.json'),'utf8'),'invalid');}finally{await rm(dir,{recursive:true,force:true});}
});
test('caminhos não escapam das pastas de mídia',()=>{for(const p of ['../database.json','a/../../secret','a\\secret','/secret','C:/secret'])assert.throws(()=>filePath('audio',p));assert.throws(()=>filePath('unknown','test'));});
test('conta pode ser validada sem URL pública; URL preenchida exige HTTPS',()=>{
  const config={userId:'123',token:'test',apiVersion:'v25.0',publicBaseUrl:'https://example.com'};
  assert.equal(validateInstagramConfig(config).publicBaseUrl,'https://example.com');
  assert.equal(validateInstagramConfig({...config,publicBaseUrl:''}).publicBaseUrl,'');
  const {publicBaseUrl,...local}=config;assert.equal(validateInstagramConfig(local).publicBaseUrl,'');
  for(const c of [{...config,userId:'../me'},{...config,publicBaseUrl:'http://localhost:3001'},{...config,publicBaseUrl:'https://127.0.0.1'},{...config,token:''}])assert.throws(()=>validateInstagramConfig(c));
});

test('reinício não repete respostas públicas ou Directs sem confirmação',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-recovery-'));
  try{
    const db=new LocalStore(dir);
    await db.change(s=>{
      const base={account_id:'123',comment_id:'100',media_id:'111',edit_id:'e',username:null,product:'produto',affiliate_url:'https://loja.example',public_text:'Vou enviar',private_text:'Link',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      s.comment_replies.push({...base,id:'public-in-flight',public_state:'sending',private_state:'pending'}, {...base,id:'private-in-flight',public_state:'sent',private_state:'sending'}, {...base,id:'pending',public_state:'pending',private_state:'pending'});
    });
    const recovered=await new LocalStore(dir).read();
    assert.equal(recovered.comment_replies[0].public_state,'unknown');assert.equal(recovered.comment_replies[0].private_state,'cancelled');
    assert.equal(recovered.comment_replies[1].public_state,'sent');assert.equal(recovered.comment_replies[1].private_state,'unknown');
    assert.equal(recovered.comment_replies[2].public_state,'pending');
    const persisted=JSON.parse(await readFile(join(dir,'database.json'),'utf8'));assert.equal(persisted.comment_replies[0].public_state,'unknown');
  }finally{await rm(dir,{recursive:true,force:true});}
});
