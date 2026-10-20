import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {extractProductFacts,productUrl,publicIPv4,readProductPage} from '../src/services/product-page.service.js';
import {anthropicStatus,saveAnthropic,generateDescription,DESCRIPTION_MODEL} from '../src/services/anthropic.service.js';

test('leitor extrai somente metadados, incluindo produtos em JSON-LD',()=>{
  const facts=extractProductFacts(`<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Garrafa térmica","description":"Aço inox de 500 ml","brand":{"name":"Minha marca"}}]}</script><meta property="og:title" content="Garrafa &amp; acessórios"><script>alert('ignorar')</script>`);
  assert.match(facts,/500 ml/);assert.match(facts,/Minha marca/);assert.match(facts,/Garrafa & acessórios/);assert.ok(!facts.includes('alert'));
  assert.throws(()=>extractProductFacts('<meta name="description" content="Verify you are human to access this page">'));
  assert.throws(()=>extractProductFacts('<html><body>Sem dados de produto</body></html>'));
});
test('leitor bloqueia destinos privados e protocolos perigosos antes de buscar',async()=>{
  for(const address of ['127.0.0.1','10.0.0.1','192.168.1.1','172.16.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(address),false,address);
  assert.equal(publicIPv4('8.8.8.8'),true);
  for(const url of ['http://127.1','http://2130706433','http://[::1]','http://[::ffff:127.0.0.1]','http://localhost','http://foo.localhost','file:///secret','https://user:pass@shop.example','http://8.8.8.8:3001'])assert.throws(()=>productUrl(url));
  await assert.rejects(()=>readProductPage('http://127.0.0.1/secret'));
});
test('Haiku fixo, chave privada, geração manual limitada e sem publicação ou retries automáticos',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-anthropic-'));const original=fetch;const oldDir=process.env.LOCAL_DATA_DIR;const oldKey=process.env.ANTHROPIC_API_KEY;
  process.env.LOCAL_DATA_DIR=dir;process.env.CLIPAI_ENV_FILE=join(dir,'.env');delete process.env.ANTHROPIC_API_KEY;
  const calls:{url:string;body:any}[]=[];let mode='ok';
  globalThis.fetch=(async(input,init)=>{
    const url=String(input);assert.ok(url.startsWith('https://api.anthropic.com/v1/'));assert.equal((init?.headers as any)['x-api-key'],'test-secret');
    const body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body});
    if(url.includes('/models/'))return Response.json({id:DESCRIPTION_MODEL});
    if(mode==='unauthorized')return Response.json({error:{message:'test-secret'}},{status:401});
    return Response.json({stop_reason:mode==='truncated'?'max_tokens':'end_turn',content:[{type:'text',text:mode==='long'?'x'.repeat(2201):'Garrafa térmica de aço inox, com capacidade de 500 ml. Comente LINK para conhecer!'}],usage:{input_tokens:200,output_tokens:30}});
  }) as typeof fetch;
  try{
    assert.equal((await anthropicStatus()).configured,false);
    await assert.rejects(()=>generateDescription({details:'Uma garrafa térmica de aço inox de 500 ml'}),/Configure/);
    assert.equal(calls.length,0);
    const status=await saveAnthropic({apiKey:'test-secret'});assert.equal(status.model,DESCRIPTION_MODEL);assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes('test-secret'));
    assert.match(await readFile(join(dir,'.env'),'utf8'),/ANTHROPIC_API_KEY='test-secret'/);
    const body={product_url:'https://loja.example/item',affiliate_url:'https://loja.example/item?ref=meu',details:'Garrafa térmica de aço inox, com capacidade de 500 ml.',auto_dm:true,model:'claude-opus-5-5'};
    const result=await generateDescription(body);assert.match(result.description,/500 ml/);assert.equal(result.source,'manual');assert.equal(calls.length,2);
    const sent=calls[1].body;assert.equal(sent.model,DESCRIPTION_MODEL);assert.equal(sent.max_tokens,700);assert.deepEqual(sent.thinking,{type:'disabled'});assert.match(sent.system,/Não invente/);assert.match(sent.system,/comentar LINK/);assert.ok(!JSON.stringify(sent).includes('?ref=meu'));
    mode='truncated';await assert.rejects(()=>generateDescription(body),/incompleta/);
    mode='long';await assert.rejects(()=>generateDescription(body),/tamanho/);
    mode='unauthorized';await assert.rejects(()=>generateDescription(body),e=>{assert.ok(!String(e).includes('test-secret'));return true;});
    const count=calls.length;await assert.rejects(()=>generateDescription({...body,product_url:'http://localhost:3001'}));assert.equal(calls.length,count);
  }finally{globalThis.fetch=original;if(oldDir===undefined)delete process.env.LOCAL_DATA_DIR;else process.env.LOCAL_DATA_DIR=oldDir;if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=oldKey;await rm(dir,{recursive:true,force:true});}
});
