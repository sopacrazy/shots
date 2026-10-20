import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {initializeEnvironment,readSettings,writeSettings} from '../src/services/settings.service.js';
import {readInstagramConfig,instagramStatus} from '../src/services/instagram.service.js';
import {readAutomationConfig} from '../src/services/comment-automation.service.js';
test('migra segredos para .env, mantém opções e relê alterações sem expor token',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clipai-env-'));process.env.CLIPAI_ENV_FILE=join(dir,'.env');process.env.LOCAL_DATA_DIR=dir;
  try{
    await writeFile(join(dir,'.env'),'# preservar comentário\nPORT=3555\nANTHROPIC_API_KEY=chave-escolhida\n');
    await writeFile(join(dir,'anthropic.json'),JSON.stringify({apiKey:'chave-antiga'}));
    await writeFile(join(dir,'instagram.json'),JSON.stringify({userId:'123',token:'token#com=simbolo',apiVersion:'v26.0',publicBaseUrl:'',username:'loja'}));
    await writeFile(join(dir,'instagram-automation.json'),JSON.stringify({enabled:true,appSecret:'secret',verifyToken:'verify',verifiedAt:'ontem'}));
    await initializeEnvironment();const env=await readSettings();
    assert.equal(env.ANTHROPIC_API_KEY,'chave-escolhida');assert.equal(env.INSTAGRAM_ACCESS_TOKEN,'token#com=simbolo');assert.equal(env.PORT,'3555');assert.match(await readFile(join(dir,'.env'),'utf8'),/# preservar comentário/);
    await assert.rejects(access(join(dir,'instagram.json')));await assert.rejects(access(join(dir,'anthropic.json')));
    assert.deepEqual(JSON.parse(await readFile(join(dir,'instagram-automation.json'),'utf8')),{verifiedAt:'ontem'});
    assert.equal((await readAutomationConfig())?.enabled,true);assert.equal((await readInstagramConfig())?.token,'token#com=simbolo');assert.ok(!JSON.stringify(await instagramStatus()).includes('token#'));
    await writeSettings({INSTAGRAM_ACCESS_TOKEN:'novo-token',INSTAGRAM_AUTOMATION_ENABLED:'false'});
    assert.equal((await readInstagramConfig())?.token,'novo-token');assert.equal((await readAutomationConfig())?.enabled,false);
    await initializeEnvironment();assert.equal((await readSettings()).INSTAGRAM_ACCESS_TOKEN,'novo-token');
  }finally{await rm(dir,{recursive:true,force:true});}
});
