import {createHash} from 'node:crypto';
import {readSettings} from './settings.service.js';
import {problem,store} from './local.service.js';

export interface ShopeeProduct {id:string;name:string;shop:string;price:number;priceMax:number;sales:number;rating:number;commissionRate:number;image:string;url:string;affiliateUrl:string;checkedAt:string;}
export async function shopeeStatus(){const e=await readSettings();return {configured:!!e.SHOPEE_APP_ID?.trim()&&!!e.SHOPEE_APP_SECRET?.trim()};}
function safeUrl(value:unknown,required=false){
  if(!value&&!required)return '';try{const u=new URL(String(value));if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048)throw 0;return u.href;}catch{throw problem('URL de produto inválida');}
}
function number(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;}
export function normalizeProduct(raw:Record<string,unknown>):ShopeeProduct{
  const item=String(raw.itemId??''),shop=String(raw.shopId??'');
  if(!/^\d{1,20}$/.test(item)||!/^\d{1,20}$/.test(shop)||typeof raw.productName!=='string'||!raw.productName.trim())throw problem('Produto Shopee inválido',502);
  return {id:`${shop}:${item}`,name:raw.productName.slice(0,300),shop:String(raw.shopName??'').slice(0,150),price:number(raw.priceMin),priceMax:number(raw.priceMax),sales:number(raw.sales),rating:number(raw.ratingStar),commissionRate:number(raw.commissionRate),image:safeUrl(raw.imageUrl),url:safeUrl(raw.productLink,true),affiliateUrl:safeUrl(raw.offerLink,true),checkedAt:new Date().toISOString()};
}
const query='query Offers($keyword:String!,$sort:Int!,$page:Int!){productOfferV2(keyword:$keyword,sortType:$sort,page:$page,limit:20){nodes{itemId shopId productName priceMin priceMax sales ratingStar commissionRate imageUrl offerLink productLink shopName}pageInfo{hasNextPage}}}';
let running=false;
export async function searchShopee(input:Record<string,unknown>){
  const keyword=String(input.keyword??'').trim(),sort=Number(input.sort??2),page=Number(input.page??1);
  if(keyword.length<2||keyword.length>80||![1,2,3,4,5].includes(sort)||!Number.isInteger(page)||page<1||page>100)throw problem('Informe uma busca de 2 a 80 caracteres e uma página válida');
  const env=await readSettings();const appId=env.SHOPEE_APP_ID?.trim(),secret=env.SHOPEE_APP_SECRET?.trim();
  if(!appId||!secret)throw problem('Configure SHOPEE_APP_ID e SHOPEE_APP_SECRET no .env');
  if(running)throw problem('Uma consulta Shopee está em andamento. Aguarde.',429);running=true;
  try{
    const body=JSON.stringify({query,variables:{keyword,sort,page}}),timestamp=String(Math.floor(Date.now()/1000));
    const signature=createHash('sha256').update(appId+timestamp+body+secret).digest('hex');
    let response:Response;
    try{response=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`},body,signal:AbortSignal.timeout(25000)});}catch{throw problem('A Shopee não respondeu. Tente novamente.',502);}
    if(!response.ok)throw problem(response.status===429?'Limite de consultas da Shopee atingido. Aguarde.':'Falha ao consultar a Shopee. Confira o acesso da sua conta.',502);
    let result;try{result=await response.json();}catch{throw problem('Resposta inválida da Shopee',502);}
    if(result.errors?.length||!Array.isArray(result.data?.productOfferV2?.nodes))throw problem('A Shopee recusou a consulta. Confira suas credenciais e permissões da API.',502);
    const products:ShopeeProduct[]=[];
    for(const raw of result.data.productOfferV2.nodes){try{products.push(normalizeProduct(raw));}catch{/* Ignore incomplete offers rather than expose raw provider data. */}}
    return {products,page,hasNextPage:result.data.productOfferV2.pageInfo?.hasNextPage===true};
  }finally{running=false;}
}
export async function saveShopeeProduct(input:Record<string,unknown>){
  const id=String(input.id??'');if(!/^\d{1,20}:\d{1,20}$/.test(id))throw problem('Produto inválido');
  const [shopId,itemId]=id.split(':');
  const product=normalizeProduct({shopId,itemId,productName:input.name,shopName:input.shop,priceMin:input.price,priceMax:input.priceMax,sales:input.sales,ratingStar:input.rating,commissionRate:input.commissionRate,imageUrl:input.image,productLink:input.url,offerLink:input.affiliateUrl});
  await store.change(db=>{const list=db.shopee_favorites??=[];const existing=list.findIndex(p=>p.id===id);if(existing>=0)list[existing]=product;else{if(list.length>=200)throw problem('Limite de 200 favoritos. Remova um produto antes de salvar outro.');list.unshift(product);}});return product;
}
