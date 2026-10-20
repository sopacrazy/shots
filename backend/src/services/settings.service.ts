import {readFile,writeFile,rename,unlink,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {parse} from 'dotenv';
import {dataDirectory} from './local.service.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const envPath=()=>process.env.CLIPAI_ENV_FILE??resolve(root,'.env');
let writes:Promise<unknown>=Promise.resolve();
async function content(){try{return await readFile(envPath(),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return '';throw e;}}
export async function readSettings():Promise<Record<string,string|undefined>>{
  await writes;
  // Reread .env so changing credentials never requires a browser form.
  const file=parse(await content());
  return process.env.CLIPAI_ENV_FILE?file:{...process.env,...file};
}
export function writeSettings(values:Record<string,string>):Promise<void>{
  const operation=writes.then(async()=>{
    let source=await content();
    for(const [name,value] of Object.entries(values)){
      if(!/^[A-Z][A-Z0-9_]*$/.test(name)||/[\r\n\0]/.test(value))throw new Error('Configuração de ambiente inválida');
      // dotenv supports literal single-quoted secrets, including # and double quotes.
      if(value.includes("'"))throw new Error('Configuração contém aspas simples não suportadas');
      const line=`${name}='${value}'`;
      const pattern=new RegExp(`^(?:export\\s+)?${name}\\s*=.*$`,'gm');
      source=pattern.test(source)?source.replace(pattern,()=>line):`${source}${source.endsWith('\n')||!source?'':'\n'}${line}\n`;
    }
    const target=envPath();await mkdir(dirname(target),{recursive:true});const temp=`${target}.${randomUUID()}.tmp`;
    try{await writeFile(temp,source,{mode:0o600,flag:'wx'});await rename(temp,target);}finally{await unlink(temp).catch(()=>{});}
  });writes=operation.catch(()=>{});return operation;
}
// Upgrade existing installations once; old files retain only operational metadata.
export async function initializeEnvironment(){
  const current=await readSettings();const updates:Record<string,string>={};
  const defaults:Record<string,string>={ANTHROPIC_API_KEY:'',INSTAGRAM_USER_ID:'',INSTAGRAM_ACCESS_TOKEN:'',INSTAGRAM_API_VERSION:'v26.0',INSTAGRAM_PUBLIC_BASE_URL:'',INSTAGRAM_USERNAME:'',INSTAGRAM_APP_SECRET:'',INSTAGRAM_WEBHOOK_VERIFY_TOKEN:randomUUID().replaceAll('-','')+randomUUID().replaceAll('-',''),INSTAGRAM_AUTOMATION_ENABLED:'false'};
  const mappings=[['anthropic.json',{apiKey:'ANTHROPIC_API_KEY'}],['instagram.json',{userId:'INSTAGRAM_USER_ID',token:'INSTAGRAM_ACCESS_TOKEN',apiVersion:'INSTAGRAM_API_VERSION',publicBaseUrl:'INSTAGRAM_PUBLIC_BASE_URL',username:'INSTAGRAM_USERNAME'}],['instagram-automation.json',{appSecret:'INSTAGRAM_APP_SECRET',verifyToken:'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',enabled:'INSTAGRAM_AUTOMATION_ENABLED'}]] as const;
  const legacy:Array<{path:string;data:Record<string,unknown>;fields:Record<string,string>}>=[];
  for(const [filename,fields]of mappings){
    const path=resolve(dataDirectory(),filename);let data:Record<string,unknown>;
    try{data=JSON.parse(await readFile(path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw new Error('Falha ao migrar configurações locais para .env');}
    for(const [field,name]of Object.entries(fields))if(current[name]===undefined&&data[field]!==undefined)updates[name]=String(data[field]);
    legacy.push({path,data,fields});
  }
  for(const [name,value]of Object.entries(defaults))if(current[name]===undefined&&updates[name]===undefined)updates[name]=value;
  if(Object.keys(updates).length)await writeSettings(updates);
  for(const {path,data,fields}of legacy){
    for(const field of Object.keys(fields))delete data[field];
    if(!Object.keys(data).length)await unlink(path);
    else{const temp=`${path}.${randomUUID()}.tmp`;try{await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}}
  }
}
