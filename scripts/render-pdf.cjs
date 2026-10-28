const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
 try {
  const page = await browser.newPage({viewport:{width:794,height:1123}});
  await page.goto(pathToFileURL(resolve('docs/assignment-answers.html')).href);
  await page.emulateMedia({media:'print'});
  const sizes = await page.locator('.page').evaluateAll(pages => pages.map(p=>({height:p.getBoundingClientRect().height,width:p.getBoundingClientRect().width})));
  if(sizes.some(s=>s.height>1005)) throw Error('Content exceeds the A4 page budget: '+JSON.stringify(sizes));
  await page.pdf({path:'docs/assignment-answers-draft.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
  for(let i=0;i<sizes.length;i++) await page.locator('.page').nth(i).screenshot({path:`artifacts/answers-page-${i+1}.png`});
  console.log(JSON.stringify({pages:sizes.length,sizes}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
