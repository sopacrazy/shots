import {LINK_CALL_TO_ACTION as CTA} from '../src/services/caption-format.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affiliateUrl,publicationCaption} from '../src/services/publication.service.js';
test('link de afiliado preserva parâmetros, códigos e fragmento',()=>{
  const link='https://loja.example/produto?tag=meu-codigo&sub_id=video%201&tag=extra#oferta';
  assert.equal(affiliateUrl(` ${link} `),link);
  assert.equal(affiliateUrl(undefined),null);
});
test('rejeita links incompletos, scripts e credenciais embutidas',()=>{
  for(const link of ['loja.example/item','javascript:alert(1)','file:///secret','https://user:password@loja.example',42])assert.throws(()=>affiliateUrl(link),(e:any)=>e.status===400);
});
test('publicação inclui o link uma vez e respeita limite total',()=>{
  const link='https://loja.example/item?ref=abc';
  assert.equal(publicationCaption('Produto em oferta',link),`Produto em oferta\n\n${CTA}\n\n${link}`);
  assert.equal(publicationCaption(`Oferta: ${link}`,link),`Oferta: ${link}\n\n${CTA}`);
  assert.equal(publicationCaption('Texto',undefined),`Texto\n\n${CTA}`);
  assert.throws(()=>publicationCaption('x'.repeat(2200),link),(e:any)=>e.status===400);
  assert.equal(publicationCaption('x'.repeat(2200-link.length-CTA.length-4),link).length,2200);
});

test('chamada LINK obrigatória é idempotente e não confunde URL com convite',()=>{
  const caption=publicationCaption('Produto incrível',null);
  assert.equal(publicationCaption(caption,null),caption);
  assert.equal(publicationCaption('Comente LINK para receber no Direct!',null),'Comente LINK para receber no Direct!');
  assert.match(publicationCaption('Conheça https://link.example',null),/Comente LINK para receber/);
  assert.match(publicationCaption('Comente LINK para conhecer!',null),/receber o link do produto no Direct/);
});
