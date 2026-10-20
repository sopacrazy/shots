import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {problem} from './local.service.js';

// Only globally routable IPv4 destinations. DNS is resolved once and pinned to
// the socket, including on every redirect; IPv6-only shops can use pasted facts.
export function publicIPv4(address:string):boolean {
  if(isIP(address)!==4)return false;
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||
    (a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function productUrl(input:string):URL {
  let url:URL;try{url=new URL(input);}catch{throw problem('Informe um link completo do produto');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||
    url.hostname==='localhost'||url.hostname.endsWith('.localhost')||
    (isIP(url.hostname.replace(/^\[|\]$/g,''))&&!publicIPv4(url.hostname)))throw problem('Use um endereço público HTTP/HTTPS de uma loja');
  return url;
}
export async function readProductPage(input:string):Promise<string>{
  let url=productUrl(input);
  const deadline=Date.now()+20000;
  for(let hop=0;hop<6;hop++){
    let dnsTimer:ReturnType<typeof setTimeout>|undefined;
    const records=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise<never>((_,reject)=>{
      dnsTimer=setTimeout(()=>reject(problem('A loja demorou a responder. Cole as informações do produto.')),Math.max(1,deadline-Date.now()));
    })]).catch(()=>{throw problem('Não foi possível localizar a loja. Cole as informações do produto.');}).finally(()=>clearTimeout(dnsTimer));
    if(!records.length||records.some(r=>!publicIPv4(r.address)))throw problem('O link aponta para um endereço restrito');
    const pinned=records[0].address;
    const response=await new Promise<{status:number;location?:string;html:string}>((resolve,reject)=>{
      const req=(url.protocol==='https:'?https:http).get(url,{
        headers:{'User-Agent':'Clipai-ProductReader/1.0','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'},
        lookup:(_host,options,cb)=>{if(typeof options==='object'&&options.all)(cb as Function)(null,[{address:pinned,family:4}]);else cb(null,pinned,4);},
      },res=>{
        if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){res.resume();resolve({status:res.statusCode,location:res.headers.location,html:''});return;}
        if(res.statusCode!==200||!String(res.headers['content-type']).match(/text\/html|application\/xhtml\+xml/i)){
          res.resume();reject(problem('A loja bloqueou a leitura. Cole o nome e as características do produto abaixo.'));return;
        }
        const chunks:Buffer[]=[];let size=0;
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2*1024*1024){req.destroy(problem('Página muito grande. Cole as informações do produto.'));return;}chunks.push(chunk);});
        res.on('end',()=>resolve({status:200,html:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
      });
      const timer=setTimeout(()=>req.destroy(problem('A loja demorou a responder. Cole as informações do produto.')),Math.max(1,deadline-Date.now()));
      req.on('close',()=>clearTimeout(timer));req.on('error',()=>reject(problem('Não foi possível ler a loja. Cole o nome e as características do produto.')));
    });
    if(response.status===200)return extractProductFacts(response.html);
    if(!response.location)break;
    url=productUrl(new URL(response.location,url).href);
  }
  throw problem('Muitos redirecionamentos. Use o link direto ou cole as informações do produto.');
}
const entities:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
function plain(value:string):string{
  return value.replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{
    const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):' ';
  }).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi,(_,n:string)=>entities[n.toLowerCase()]??' ').replace(/\s+/g,' ').trim();
}
export function extractProductFacts(html:string):string{
  const facts:string[]=[];
  function visit(value:unknown,depth=0){
    if(depth>8||!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.slice(0,40).forEach(v=>visit(v,depth+1));return;}
    const obj=value as Record<string,unknown>;
    if([obj['@type']].flat().some(t=>typeof t==='string'&&/^(https?:\/\/schema.org\/)?Product$/i.test(t))){
      for(const key of ['name','description','material','color','size','category'])if(typeof obj[key]==='string')facts.push(`${key}: ${plain(obj[key] as string).slice(0,2000)}`);
      if(typeof obj.brand==='string')facts.push(`brand: ${plain(obj.brand)}`);
      else if(obj.brand&&typeof obj.brand==='object'&&typeof (obj.brand as any).name==='string')facts.push(`brand: ${plain((obj.brand as any).name)}`);
    }
    Object.values(obj).slice(0,80).forEach(v=>visit(v,depth+1));
  }
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(match[1]));}catch{/* Ignore malformed store metadata. */}
  for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){
    const attributes:Record<string,string>={};for(const a of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attributes[a[1].toLowerCase()]=a[3];
    if(/^(og:title|og:description|description)$/i.test(attributes.property??attributes.name??'')&&attributes.content)facts.push(plain(attributes.content).slice(0,2000));
  }
  if(!facts.length)throw problem('Não encontrei informações confiáveis do produto. Cole o nome e as características abaixo.');
  const result=[...new Set(facts)].join('\n').slice(0,6000);
  if(result.length<25||/captcha|access denied|acesso negado|just a moment|verify you are human/i.test(result))throw problem('A loja bloqueou a leitura. Cole as informações do produto abaixo.');
  return result;
}
