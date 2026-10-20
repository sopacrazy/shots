import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
const fetch = (url: string, options: { method?: string; headers?: Record<string,string>; body?: string } = {}): Promise<{ status: number; json: () => Promise<any> }> => new Promise((resolve,reject) => {
  const req = http.request(url, { method: options.method ?? 'GET', headers: options.headers }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode!, json: async () => JSON.parse(body) }));
  });
  req.on('error', reject); if(options.body) req.write(options.body); req.end();
});
import { validateScript, validateUpload } from '../src/services/manual.service.js';
const valid = () => ({ title: 'Meu vídeo', body: 'Texto narrado', scenes: [{ description: 'Primeira cena', duration_seconds: 8 }], hashtags: '#video, #teste' });
test('roteiro manual normaliza texto, cenas e hashtags', () => {
  const p = validateScript(valid());
  assert.equal(p.scenes[0].scene_number, 1);
  assert.equal(p.hook, '');
  assert.deepEqual(p.hashtags, ['video', 'teste']);
});
test('rejeita roteiro vazio, duração inválida e excesso de cenas', () => {
  for (const body of [{ ...valid(), body: '' }, { ...valid(), scenes: [] }, { ...valid(), scenes: [null] }, { ...valid(), scenes: [{ description: 'Cena', duration_seconds: 0 }] }, { ...valid(), scenes: [{ description: 'Cena', duration_seconds: 1.5 }] }, { ...valid(), scenes: Array(51).fill({ description: 'Cena', duration_seconds: 8 }) }]) {
    assert.throws(() => validateScript(body), (e: any) => e.status === 400);
  }
});
test('uploads aceitam imagem com assinatura PNG e rejeitam tipos/conteúdo incompatíveis', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1UAAAAASUVORK5CYII=';
  assert.equal(validateUpload({ mimeType: 'image/png', fileBase64: png }, 'image').ext, 'png');
  for (const body of [{ mimeType: 'image/svg+xml', fileBase64: png }, { mimeType: 'image/jpeg', fileBase64: png }, { mimeType: 'image/png', fileBase64: '<script>' }, { mimeType: 'audio/mpeg', fileBase64: png }]) {
    assert.throws(() => validateUpload(body, 'image'), (e: any) => e.status === 400);
  }
  assert.throws(() => validateUpload({ mimeType: 'image/png', fileBase64: Buffer.alloc(26 * 1024 * 1024).toString('base64') }, 'image'));
});
test('API local salva projetos, cenas e arquivos sem credenciais', async () => {
  const { mkdtemp, rm, readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(),'clipai-api-'));
  process.env.NODE_ENV = 'test'; process.env.LOCAL_DATA_DIR = directory;process.env.CLIPAI_ENV_FILE=join(directory,'.env');
  const { default: app } = await import('../src/index.js');
  const server = app.listen(0,'127.0.0.1'); await new Promise<void>(r=>server.on('listening',r));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  const send = async (path:string,method='GET',body?:object) => fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try {
    assert.deepEqual((await (await send('/health')).json()).services,{manual:true,local:true});
    const folder=await (await send('/folders','POST',{name:'Produtos'})).json();
    const created=await send('/projects','POST',{topic:'Produto de teste'}); assert.equal(created.status,201);
    const project=await created.json();
    assert.equal((await send(`/projects/${project.id}/folder`,'PATCH',{folder_id:folder.id})).status,200);
    assert.equal((await send(`/projects/${project.id}/script`,'PUT',valid())).status,200);
    let detail=await (await send(`/projects/${project.id}`)).json();const scene=detail.scenes[0];
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1UAAAAASUVORK5CYII=';
    const brandResponse=await send('/brand','PUT',{watermark:'@minhaloja',watermark_position:'bottom-left',logo:{mimeType:'image/png',fileBase64:png}});assert.equal(brandResponse.status,200);
    const brand=await brandResponse.json();assert.match(brand.logo_url,/logos/);
    assert.deepEqual(await (await send('/brand')).json(),brand);
    assert.equal((await send('/brand','PUT',{watermark:'@minhaloja',watermark_position:'bottom-left',existing_logo_url:brand.logo_url})).status,200);
    assert.equal((await send('/brand','PUT',{existing_logo_url:'/api/files/audio/nao-pertence.png'})).status,400);
    const upload=await send(`/projects/${project.id}/images/${scene.id}`,'PUT',{mimeType:'image/png',fileBase64:png});assert.equal(upload.status,200);
    const uploaded=await upload.json(); assert.match(uploaded.image_url,/^\/api\/files\/audio\//);
    assert.equal((await fetch(base.replace('/api','')+uploaded.image_url)).status,200);
    assert.equal((await send(`/projects/${project.id}/script`,'PUT',{...valid(),title:'Alterado'})).status,200);
    detail=await (await send(`/projects/${project.id}`)).json();assert.equal(detail.scenes[0].id,scene.id);assert.equal(detail.scenes[0].image_url,uploaded.image_url);
    const {LocalStore,store}=await import('../src/services/local.service.js');
    const reopened=await new LocalStore(directory).read();assert.equal(reopened.projects[0].title,'Alterado');assert.equal(reopened.scenes[0].image_url,uploaded.image_url);
    assert.deepEqual(reopened.brand,brand);
    assert.equal(JSON.parse(await readFile(join(directory,'database.json'),'utf8')).projects.length,1);
    assert.equal((await send(`/folders/${folder.id}`,'DELETE')).status,204);
    assert.equal((await (await send(`/projects/${project.id}`)).json()).project.folder_id,null);
    const instagram=await (await send('/instagram/status')).json();assert.equal(instagram.configured,false);
    assert.equal((await send('/instagram/publish/missing','POST')).status,400);
    const {writeSettings}=await import('../src/services/settings.service.js');
    await writeSettings({INSTAGRAM_USER_ID:'123',INSTAGRAM_ACCESS_TOKEN:'token-teste',INSTAGRAM_API_VERSION:'v26.0',INSTAGRAM_PUBLIC_BASE_URL:'https://public.example'});
    await store.change(db=>{db.edits.push({id:'schedule-fixture',created_at:new Date().toISOString(),source_id:'src',source_name:'Produto de teste.mp4',category:'Produtos',caption:'Legenda de teste',watermark:'@loja',watermark_position:'top-right',logo_url:null,output_url:'/api/files/videos/test.mp4',status:'ready',error:null,publish_state:'idle'});});
    const scheduled=await send('/schedules','POST',{edit_id:'schedule-fixture',run_at:new Date(Date.now()+86400000).toISOString()});assert.equal(scheduled.status,201);
    const scheduledJob=await scheduled.json();assert.equal((await (await send('/schedules')).json())[0].state,'scheduled');
    assert.equal((await send(`/schedules/${scheduledJob.id}`,'DELETE')).status,204);
    assert.equal((await (await send('/schedules')).json())[0].state,'cancelled');
    await writeSettings({INSTAGRAM_USER_ID:'123',INSTAGRAM_ACCESS_TOKEN:'token-teste',INSTAGRAM_API_VERSION:'v26.0',INSTAGRAM_PUBLIC_BASE_URL:'URL ainda não configurada'});
    const pending=await send('/instagram/status');assert.equal(pending.status,200);
    const pendingStatus=await pending.json();assert.equal(pendingStatus.configured,false);assert.match(pendingStatus.error,/HTTPS/);assert.ok(!JSON.stringify(pendingStatus).includes('token-teste'));
    assert.equal((await send('/library')).status,200);assert.equal((await send('/edits')).status,200);
    assert.equal((await send('/instagram/publish/missing','POST')).status,400);
    assert.equal((await send(`/projects/${project.id}`,'DELETE')).status,204);
    assert.equal((await fetch(base.replace('/api','')+uploaded.image_url)).status,404);
    assert.equal((await send(`/projects/${project.id}`)).status,404);
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await (await import('../src/services/scheduler.service.js')).closeScheduleStore();await rm(directory,{recursive:true,force:true});}
});
