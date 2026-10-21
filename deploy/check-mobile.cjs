// Local UI QA. All API traffic uses fixtures; every mutation is blocked and fails QA.
const {chromium}=require('C:/Users/Adriano/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {mkdir}=require('node:fs/promises');
const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:3030';
const WIDTHS=[320,375,390,768,1280,1440];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4qkAAAAASUVORK5CYII=','base64');
const labels={overview:'Visão geral',videos:'Vídeos de produtos',photos:'Reels com fotos',scenes:'Editor de cenas',shopee:'Garimpo Shopee',scheduler:'Agendamentos',automation:'Automação do Instagram',history:'Minhas edições'};
const videos=[
  {id:'qa-source-1',name:'Caneca térmica para levar na bolsa.mp4',category:'Cozinha',url:'/api/files/library/qa-caneca.mp4',size:8*1024*1024},
  {id:'qa-source-2',name:'Organizador de gavetas.mp4',category:'Organização',url:'/api/files/library/qa-organizador.mp4',size:12*1024*1024},
];
const edits=[
  {id:'qa-edit-1',source_id:videos[0].id,source_name:videos[0].name,caption:'Conheça a caneca de teste. Uma descrição fictícia para revisar o layout.',affiliate_url:'https://example.test/produto?ref=qa',auto_dm_enabled:true,watermark:'@estudio.qa',watermark_position:'top-right',logo_url:null,output_url:'/api/files/videos/qa-edit.mp4',status:'ready',error:null,publish_state:'idle',created_at:'2026-10-20T12:00:00.000Z'},
  {id:'qa-edit-2',source_id:videos[1].id,source_name:videos[1].name,caption:'Organizador fictício de teste.',affiliate_url:null,auto_dm_enabled:false,watermark:'@estudio.qa',watermark_position:'bottom-left',logo_url:null,output_url:'/api/files/videos/qa-edit-2.mp4',status:'ready',error:null,publish_state:'published',instagram_permalink:'https://example.test/reel/qa',created_at:'2026-10-20T11:00:00.000Z'},
];
const product={id:'qa-product',name:'Caneca térmica com alça e tampa para levar na bolsa',shop:'Loja fictícia para QA',price:39.9,priceMax:49.9,sales:1234,rating:4.8,commissionRate:0.08,image:'/api/files/qa-product.png',url:'https://example.test/produto',affiliateUrl:'https://example.test/produto?ref=qa',checkedAt:'2026-10-20T12:00:00.000Z'};
const fixtures={
  '/api/library':videos,
  '/api/edits':edits,
  '/api/brand':{watermark:'@estudio.qa',watermark_position:'top-right',logo_url:null},
  '/api/instagram/status':{configured:false,username:'estudio.qa',apiVersion:'v26.0',publicBaseUrl:''},
  // The real automation status route has no /status suffix.
  '/api/instagram/automation':{enabled:false,configured:true,verify_token:'qa-fixture-token',webhook_url:'https://example.test/api/instagram/webhook',subscribed:false,verified_at:null,last_event_at:null,sent:0,failed:0,recent:[]},
  '/api/schedules':[{id:'qa-schedule',edit_id:'qa-edit-1',product:videos[0].name,run_at:Date.now()+86400000,state:'scheduled',error:null,permalink:null}],
  '/api/shopee/status':{configured:true},
  '/api/shopee/favorites':[product],
  '/api/shopee/products':{products:[product],page:1,hasNextPage:false},
  '/api/ai/status':{configured:false},
  '/api/projects':[],
  '/api/folders':[],
  '/api/voices':[],
  '/api/health':{status:'ok',services:{}},
};
const failures=[];
let checks=0;
async function check(name,run){
  try{await run();checks++;}
  catch(error){const message=`${name}: ${error.message}`;failures.push(message);console.error('FAIL '+message);}
}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function navigate(page,view){
  const opener=page.getByRole('button',{name:'Abrir menu principal',exact:true});
  if(await opener.isVisible())await opener.click();
  await page.locator('#workspace-navigation').getByRole('button',{name:labels[view],exact:true}).click();
  await page.waitForFunction(expected=>location.hash==='#'+expected,view);
  await settle(page);
  assert.equal(await page.locator('#workspace-navigation .workspace-nav-item[aria-current="page"]').textContent(),labels[view]);
  if(await opener.isVisible())assert.equal(await opener.getAttribute('aria-expanded'),'false','menu deve fechar após navegar');
}
async function audit(page,width,name){
  await settle(page);
  await check(`${width}px ${name} overflow`,async()=>{
    const layout=await page.evaluate(()=>({
      viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      offenders:[...document.querySelectorAll('.workspace-main *,.workspace-sidebar.is-open *')].filter(element=>{
        const rect=element.getBoundingClientRect();
        if(rect.width<=1||rect.height<=0||getComputedStyle(element).visibility==='hidden')return false;
        let left=rect.left,right=rect.right;
        for(let parent=element.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
          if(['hidden','clip','auto','scroll'].includes(getComputedStyle(parent).overflowX)){
            const clip=parent.getBoundingClientRect();left=Math.max(left,clip.left);right=Math.min(right,clip.right);
          }
        }
        return right>left&&(right>innerWidth+2||left< -2);
      }).slice(0,6).map(element=>({tag:element.tagName,className:element.getAttribute('class'),text:element.textContent?.trim().slice(0,70),left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right)})),
    }));
    assert.ok(layout.scroll<=width+2&&layout.offenders.length===0,JSON.stringify(layout));
  });
  if(width<=700)await check(`${width}px ${name} campos mobile`,async()=>{
    const fields=await page.locator('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]),textarea,select').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'&&parseFloat(getComputedStyle(element).fontSize)<16).map(element=>({tag:element.tagName,label:element.closest('label')?.textContent?.trim().slice(0,70),font:getComputedStyle(element).fontSize})));
    assert.equal(fields.length,0,JSON.stringify(fields));
  });
}
async function auditModal(page,width,name){
  const modal=page.locator('.studio-modal:visible');
  await modal.waitFor();
  await check(`${width}px ${name} dentro da tela`,async()=>{
    const rect=await modal.boundingBox();
    assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=844+1,JSON.stringify(rect));
  });
  await audit(page,width,name);
}
async function menuChecks(page,width){
  const opener=page.getByRole('button',{name:'Abrir menu principal',exact:true});
  if(!await opener.isVisible())return;
  await check(`${width}px menu abrir/fechar/Escape`,async()=>{
    await opener.click();
    assert.equal(await opener.getAttribute('aria-expanded'),'true');
    await page.getByRole('button',{name:'Fechar menu principal',exact:true}).click();
    assert.equal(await opener.getAttribute('aria-expanded'),'false');
    await opener.click();
    await page.keyboard.press('Escape');
    assert.equal(await opener.getAttribute('aria-expanded'),'false');
    await opener.click();
    await page.getByRole('button',{name:'Fechar menu',exact:true}).click({position:{x:width-5,y:10}});
    assert.equal(await opener.getAttribute('aria-expanded'),'false');
  });
}
async function videoFlow(page,width){
  await navigate(page,'videos');
  const library=page.locator('.library-card');
  await library.getByRole('searchbox',{name:'Buscar vídeo pelo nome'}).fill('Caneca');
  assert.equal(await library.locator('.studio-video-tile').count(),1,'busca filtra biblioteca');
  await library.getByRole('searchbox',{name:'Buscar vídeo pelo nome'}).fill('zzzz-inexistente');
  assert.equal(await library.locator('.studio-video-tile').count(),0,'busca mostra vazio');
  await library.getByRole('searchbox',{name:'Buscar vídeo pelo nome'}).fill('');
  assert.equal(await library.locator('.studio-video-tile').count(),2,'limpar busca restaura biblioteca');
  await library.locator('.studio-video-tile').first().click();
  const editor=page.locator('.editor-card');
  const caption='Descrição manual de QA: caneca de teste para a rotina. #produto';
  await editor.getByLabel('Descrição da publicação').fill(caption);
  await editor.getByLabel('Link do produto afiliado (opcional)').fill('https://example.test/produto?ref=qa');
  await audit(page,width,'vídeo descrição');
  await editor.getByRole('button',{name:'Personalizar marca',exact:true}).click();
  await editor.getByLabel('Marca d’água em texto').fill('@rascunho.qa');
  await editor.getByLabel(/^Posição/).selectOption('bottom-left');
  await audit(page,width,'vídeo marca');
  await editor.getByRole('button',{name:'Revisar vídeo',exact:true}).click();
  assert.ok(await editor.getByRole('button',{name:'Gerar vídeo com minha marca',exact:true}).isEnabled());
  assert.ok((await editor.locator('.review-summary').textContent()).includes(caption));
  await audit(page,width,'vídeo revisão');
  if(width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'data/mobile-check/1440-editor.png',fullPage:true});}
  await navigate(page,'photos');
  await navigate(page,'scenes');
  await navigate(page,'videos');
  assert.ok((await editor.locator('.review-summary').textContent()).includes(caption),'revisão persiste após navegar');
  const steps=page.getByRole('navigation',{name:'Etapas de criação',exact:true});
  await steps.getByRole('button',{name:/Descrição/}).click();
  assert.equal(await editor.getByLabel('Descrição da publicação').inputValue(),caption,'descrição deve persistir');
  await steps.getByRole('button',{name:/Sua marca/}).click();
  assert.equal(await editor.getByLabel('Marca d’água em texto').inputValue(),'@rascunho.qa','marca deve persistir');
  assert.equal(await editor.getByLabel(/^Posição/).inputValue(),'bottom-left','posição deve persistir');
}
async function photoFlow(page,width){
  await navigate(page,'photos');
  const photo=page.locator('#photo-reel-creator');
  await photo.getByLabel('Nome da montagem').fill('Montagem de QA');
  await photo.getByLabel('Adicionar fotos').setInputFiles([{name:'foto-1.png',mimeType:'image/png',buffer:PNG},{name:'foto-2.png',mimeType:'image/png',buffer:PNG}]);
  assert.equal(await photo.locator('.photo-reel-photos img').count(),2);
  await audit(page,width,'fotos seleção');
  await photo.getByRole('button',{name:'Continuar para personalizar →',exact:true}).click();
  await photo.getByLabel('Descrição do Reel').fill('Descrição manual do Reel com duas fotos de teste.');
  await photo.getByLabel('Marca d’água',{exact:true}).fill('@fotos.qa');
  await audit(page,width,'fotos personalizar');
  await photo.getByRole('button',{name:'Revisar montagem →',exact:true}).click();
  assert.ok((await photo.locator('.tool-review-summary').textContent()).includes('2 fotos'));
  assert.ok(await photo.getByRole('button',{name:'Gerar Reel com fotos e música',exact:true}).isEnabled());
  await audit(page,width,'fotos revisão');
  await navigate(page,'overview');
  await navigate(page,'photos');
  assert.equal(await photo.getByLabel('Nome da montagem').inputValue(),'Montagem de QA','nome de fotos persiste');
  assert.equal(await photo.locator('.photo-reel-photos img').count(),2,'fotos persistem');
  assert.ok((await photo.locator('.studio-caption-review:visible').textContent()).includes('duas fotos de teste'),'descrição de fotos persiste');
}
async function schedulerFlow(page,width){
  await navigate(page,'scheduler');
  const scheduler=page.locator('.video-scheduler');
  await scheduler.getByLabel('Vídeo finalizado').selectOption('qa-edit-1');
  await scheduler.getByLabel('Data e hora da publicação').fill('2030-01-02T10:30');
  await scheduler.getByRole('button',{name:'Revisar agendamento',exact:true}).click();
  await auditModal(page,width,'modal agendamento');
  assert.ok(await page.getByRole('dialog',{name:'Revisar agendamento',exact:true}).isVisible());
  await page.getByRole('button',{name:'Fechar revisão',exact:true}).click();
  assert.equal(await page.locator('.studio-modal:visible').count(),0,'revisão deve fechar sem agendar');
}
(async()=>{
  await mkdir('data/mobile-check',{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const width of WIDTHS){
      const blocked=[],unknown=[],pageErrors=[];
      const context=await browser.newContext({viewport:{width,height:844},isMobile:width<=700,hasTouch:width<=700,timezoneId:'America/Sao_Paulo',locale:'pt-BR',reducedMotion:'reduce',serviceWorkers:'block'});
      await context.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url()),method=request.method();
        if(!['GET','HEAD','OPTIONS'].includes(method)){
          blocked.push(`${method} ${url.pathname}`);
          await route.fulfill({status:405,contentType:'application/json',body:JSON.stringify({error:'QA bloqueou uma mutação'})});return;
        }
        if(url.pathname.startsWith('/api/')){
          if(url.pathname.startsWith('/api/files/')){await route.fulfill({status:200,contentType:url.pathname.endsWith('.png')?'image/png':'video/mp4',body:url.pathname.endsWith('.png')?PNG:Buffer.alloc(0)});return;}
          if(Object.hasOwn(fixtures,url.pathname)){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures[url.pathname])});return;}
          unknown.push(`${method} ${url.pathname}`);
          await route.fulfill({status:501,contentType:'application/json',body:JSON.stringify({error:'Rota sem fixture de QA'})});return;
        }
        if(url.origin!==new URL(BASE).origin){await route.abort('blockedbyclient');return;}
        await route.continue();
      });
      const page=await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror',error=>pageErrors.push(error.message));
      try{
        await page.goto(BASE+'/#overview',{waitUntil:'networkidle'});
        await page.locator('.overview-page').waitFor();
        await menuChecks(page,width);
        for(const view of Object.keys(labels)){
          await check(`${width}px navegar #${view}`,()=>navigate(page,view));
          await audit(page,width,view);
          if(view==='overview'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`data/mobile-check/${width}.png`,fullPage:true});}
          if(view==='automation')for(const tab of ['Simular resposta','Configuração','Visão geral']){
            await page.locator('.instagram-automation').getByRole('button',{name:tab,exact:true}).click();await audit(page,width,`automação ${tab}`);
          }
          if(view==='shopee'){
            const shopee=page.locator('.shopee-prospector');
            await shopee.getByRole('button',{name:'Favoritos (1)',exact:true}).click();await audit(page,width,'shopee favoritos');
            await shopee.locator('.tool-tabs').getByRole('button',{name:'Buscar produtos',exact:true}).click();
            await shopee.getByLabel('Produto ou categoria').fill('caneca');
            await shopee.locator('form').getByRole('button',{name:'Buscar produtos',exact:true}).click();
            await shopee.locator('.shopee-product').waitFor();await audit(page,width,'shopee resultados');
          }
          if(view==='scenes'){
            await page.locator('.scene-workspace > .studio-header').getByRole('button',{name:'Novo projeto',exact:true}).click();
            await page.locator('.scene-workspace').getByLabel('Tema',{exact:true}).fill('Rascunho de tema para QA');
            await audit(page,width,'cenas formulário manual');
          }
        }
        await check(`${width}px fluxo biblioteca e persistência do rascunho`,()=>videoFlow(page,width));
        await check(`${width}px fluxo fotos e revisão`,()=>photoFlow(page,width));
        await check(`${width}px revisão agendamento sem confirmar`,()=>schedulerFlow(page,width));
        await navigate(page,'overview');
        await page.locator('.instagram-connection').click();
        await auditModal(page,width,'modal conectar Instagram');
        await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
      }catch(error){failures.push(`${width}px: ${error.message}`);console.error(`FAIL ${width}px: ${error.message}`);await page.screenshot({path:`data/mobile-check/${width}-failure.png`,fullPage:true}).catch(()=>{});}
      await check(`${width}px nenhuma mutação`,async()=>assert.deepEqual(blocked,[]));
      await check(`${width}px todas APIs isoladas por fixtures`,async()=>assert.deepEqual([...new Set(unknown)],[]));
      await check(`${width}px sem erros JavaScript`,async()=>assert.deepEqual(pageErrors,[]));
      console.log(`${width}px: verificação concluída; ${blocked.length} mutações; ${unknown.length} rotas sem fixture`);
      await context.close();
    }
  }finally{await browser.close();}
  console.log(JSON.stringify({checksPassed:checks,failures},null,2));
  if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
