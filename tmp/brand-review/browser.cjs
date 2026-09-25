const { chromium }=require('C:/Users/Amirsaly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=[];
 for(const width of [360,768,1024,1440]) {
  await page.setViewportSize({width,height:1000});
  for(const route of ['/','/products','/contact','/about','/auth']) {
   await page.goto('http://127.0.0.1:5173'+route);
   await page.waitForTimeout(350);
   results.push({width,route,...await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth, viewport:innerWidth, logo:!!document.querySelector('img[src="/salyco-logo-navy.svg"]')?.naturalWidth, direction:document.documentElement.dir, heading:document.querySelector('h1')?.textContent}))});
   if((width===360||width===1440)&&(route==='/'||route==='/contact')) await page.screenshot({path:'tmp/brand-review/'+width+'-'+(route==='/'?'home':'contact')+'.png',fullPage:true});
  }
 }
 console.log(JSON.stringify({results,errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
