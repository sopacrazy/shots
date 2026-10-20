// Creates a private upload bundle; never prints credentials.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {parse}=createRequire(new URL('../backend/package.json',import.meta.url))('dotenv');
await mkdir('data/deployment',{recursive:true});
const local=parse(await readFile('.env','utf8'));
const password=randomBytes(20).toString('base64url');
const values={NODE_ENV:'production',PORT:'3011',LOCAL_DATA_DIR:'data',ALLOWED_ORIGINS:'https://70.38.101.147,http://70.38.101.147',MEDIA_BASE_URL:'http://127.0.0.1:3011',ANTHROPIC_API_KEY:local.ANTHROPIC_API_KEY??'',INSTAGRAM_USER_ID:local.INSTAGRAM_USER_ID??'',INSTAGRAM_ACCESS_TOKEN:local.INSTAGRAM_ACCESS_TOKEN??'',INSTAGRAM_API_VERSION:local.INSTAGRAM_API_VERSION??'v26.0',INSTAGRAM_USERNAME:local.INSTAGRAM_USERNAME??'',INSTAGRAM_PUBLIC_BASE_URL:'https://70.38.101.147/shorts',INSTAGRAM_APP_SECRET:local.INSTAGRAM_APP_SECRET??'',INSTAGRAM_WEBHOOK_VERIFY_TOKEN:local.INSTAGRAM_WEBHOOK_VERIFY_TOKEN??randomBytes(32).toString('hex'),INSTAGRAM_AUTOMATION_ENABLED:'false',SHORTS_ADMIN_USER:'adriano',SHORTS_ADMIN_PASSWORD:password};
for(const value of Object.values(values))if(/[\r\n']/.test(value))throw new Error('Valor de configuração não suportado');
await writeFile('data/deployment/vps.env',Object.entries(values).map(([k,v])=>`${k}='${v}'`).join('\n')+'\n',{mode:0o600});
await writeFile('data/deployment/acesso-vps.txt',`URL: https://70.38.101.147/shorts/\nUsuário: adriano\nSenha: ${password}\n`,{mode:0o600});
const paths=['package.json','package-lock.json','backend/package.json','backend/tsconfig.json','backend/src','backend/test','src','public','index.html','tsconfig.json','vite.config.ts','README.md','deploy','deploy-build','data/deployment/vps.env'];
for(const path of ['data/library','data/files','data/database.json'])try{await stat(path);paths.push(path);}catch(e){if(e.code!=='ENOENT')throw e;}
execFileSync('tar',['-czf','data/deployment/shorts-upload.tgz',...paths],{stdio:'inherit'});
console.log('Pacote criado; acesso salvo em data/deployment/acesso-vps.txt.');
