// Visual QA only: never uploads, generates paid text, schedules or publishes.
const {chromium}=require('C:/Users/Adriano/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {mkdir}=require('node:fs/promises');
(async()=>{
  await mkdir('data/mobile-check',{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const width of [320,375,390,768,1280]){
      const page=await browser.newPage({viewport:{width,height:844},isMobile:width<700,hasTouch:width<700});
      await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
      await page.locator('.studio').waitFor();
      await page.locator('.studio-automation summary').click();
      const tile=page.locator('.studio-video-tile').first();if(await tile.count())await tile.click();
      const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('.studio *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2);}).slice(0,5).map(e=>e.className)}));
      if(overflow.scroll>width+2)throw new Error('Overflow: '+JSON.stringify(overflow));
      if(width<700){
        const smallFields=await page.locator('.studio-field input:not([type=file]),.studio-field textarea,.studio-field select').evaluateAll(fields=>fields.filter(e=>e.getBoundingClientRect().width&&parseFloat(getComputedStyle(e).fontSize)<16).length);
        if(smallFields)throw new Error(`${width}px: campos pequenos causariam zoom no iPhone`);
      }
      await page.locator('.studio-header button').click();
      const modal=await page.locator('.studio-modal').boundingBox();if(!modal||modal.x<0||modal.x+modal.width>width+1)throw new Error(`${width}px: modal fora da tela`);
      await page.screenshot({path:`data/mobile-check/${width}.png`});
      await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
      if(width===390&&await tile.count()){
        await page.locator('.editor-card').evaluate(e=>e.scrollIntoView({block:'start'}));
        await page.screenshot({path:'data/mobile-check/390-editor.png'});
      }
      console.log(`${width}px: sem rolagem horizontal; modal dentro da tela`);
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
