import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {searchShopee,shopeeStatus,saveShopeeProduct} from '../src/services/shopee.service.js';
import {store} from '../src/services/local.service.js';

test('busca assinada, segredos privados, favoritos persistentes e falhas sem vazamento',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'clipai-shopee-'));const originalFetch=fetch,oldDir=process.env.LOCAL_DATA_DIR,oldEnv=process.env.CLIPAI_ENV_FILE;
 process.env.LOCAL_DATA_DIR=directory;process.env.CLIPAI_ENV_FILE=join(directory,'.env');
 let calls=0,mode='ok';
 globalThis.fetch=(async(url,init)=>{
   calls++;assert.equal(String(url),'https://open-api.affiliate.shopee.com.br/graphql');
   const auth=(init!.headers as Record<string,string>).Authorization;
   const timestamp=/Timestamp=(\d+)/.exec(auth)![1];
   assert.ok(auth.endsWith(createHash('sha256').update('123'+timestamp+String(init!.body)+'test-secret-only').digest('hex')));
   const body=JSON.parse(String(init!.body));assert.deepEqual(body.variables,{keyword:'caneca',sort:2,page:1});
   if(mode==='failed')return Response.json({errors:[{message:'test-secret-only'}]});
   return Response.json({data:{productOfferV2:{nodes:[{itemId:22,shopId:11,productName:'Caneca 300 ml',shopName:'Loja',priceMin:'20',priceMax:'25',sales:100,ratingStar:'4.8',commissionRate:'0.1',imageUrl:'https://img.example/caneca.jpg',productLink:'https://shopee.com.br/product/11/22',offerLink:'https://s.shopee.com.br/test?ref=abc'}],pageInfo:{hasNextPage:true}}}});
 }) as typeof fetch;
 try{
   assert.equal((await shopeeStatus()).configured,false);
   await assert.rejects(searchShopee({keyword:'caneca'}),/Configure/);assert.equal(calls,0);
   await writeFile(process.env.CLIPAI_ENV_FILE,"SHOPEE_APP_ID=123\nSHOPEE_APP_SECRET=test-secret-only\n");
   const result=await searchShopee({keyword:'caneca'});assert.equal(result.products[0].commissionRate,.1);assert.equal(result.hasNextPage,true);assert.ok(!JSON.stringify(result).includes('test-secret-only'));
   const product=result.products[0];await saveShopeeProduct({...product});await saveShopeeProduct({...product});assert.equal((await store.read()).shopee_favorites?.length,1);
   await assert.rejects(saveShopeeProduct({...product,affiliateUrl:'javascript:alert(1)'}));
   await assert.rejects(searchShopee({keyword:'x'}));assert.equal(calls,1);
   mode='failed';await assert.rejects(searchShopee({keyword:'caneca'}),e=>!String(e).includes('test-secret-only')&&String(e).includes('recusou'));
 }finally{globalThis.fetch=originalFetch;if(oldDir===undefined)delete process.env.LOCAL_DATA_DIR;else process.env.LOCAL_DATA_DIR=oldDir;if(oldEnv===undefined)delete process.env.CLIPAI_ENV_FILE;else process.env.CLIPAI_ENV_FILE=oldEnv;await rm(directory,{recursive:true,force:true});}
});
