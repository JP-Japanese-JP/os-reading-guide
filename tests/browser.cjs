const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright'));
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const chapters=require('../data/chapters.json');const report={checks:[],chapters:[],errors:[]};
const check=(name)=>{report.checks.push(name);console.log('PASS',name);};
(async()=>{
 fs.mkdirSync('tests/evidence',{recursive:true});
 const ctx=await chromium.launchPersistentContext(path.resolve('tests/.chrome-profile-'+Date.now()),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1440,height:1000}});
 try{
 const cdp=await ctx.browser().newBrowserCDPSession();report.browser=await cdp.send('Browser.getVersion');const {id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve('extension')});report.extension=id;
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const base='https://operating-system-in-1000-lines.vercel.app/ja';
 await page.goto(base+'/09-memory-allocation');await page.locator('.osrg-term').first().waitFor();
 const panel=page.locator('#osrg-host .panel');
 await page.locator('.osrg-term[data-osrg-id="allocation"]').first().hover();await panel.waitFor({state:'visible'});check('09: hover opens explanation');
 await page.locator('.osrg-term[data-osrg-id="allocation"]').first().click();
 await panel.getByRole('button',{name:'詳しい説明を読む',exact:true}).click();
 await panel.getByRole('button',{name:'メモリのページ',exact:true}).click();
 assert.equal(await panel.locator('h2').innerText(),'メモリのページ');
 await panel.getByRole('button',{name:'4KBと4096バイト',exact:true}).click();
 assert.equal(await panel.locator('h2').innerText(),'4KBと4096バイト');
 await panel.getByRole('button',{name:'← 戻る',exact:true}).click();assert.equal(await panel.locator('h2').innerText(),'メモリのページ');
 await panel.getByRole('button',{name:'← 戻る',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'詳しい説明を閉じる'}).count(),1);check('09: nested links, back, expanded state restoration');
 await page.screenshot({path:'tests/evidence/09-explanation.png'});
 await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);check('Escape closes dialog');
 const term=page.locator('.osrg-term[data-osrg-id="alignment"]').first();await term.focus();await page.keyboard.press('Enter');await panel.waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await term.evaluate(e=>e===document.activeElement),true);check('keyboard activation and focus restoration');
 const before=await page.locator('.vp-doc pre').allTextContents();assert.equal(await page.locator('pre .osrg-term,a .osrg-term').count(),0);check('code blocks and existing links remain unannotated');
 await page.locator('.vp-doc pre').first().evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(range);});
 await page.keyboard.press('Alt+Shift+Q');await panel.waitFor({state:'visible'});assert.ok((await panel.locator('textarea').first().inputValue()).includes('__free_ram'));check('code selection opens contextual question');
 await panel.locator('textarea').first().fill('未知の表現xyzzy');await panel.getByRole('button',{name:'関連解説を探す',exact:true}).click();assert.ok((await panel.innerText()).includes('見つかりません'));await panel.getByRole('button',{name:'質問を保存',exact:true}).click();await panel.getByText('質問を保存しました（直近200件）。',{exact:true}).waitFor();check('unknown question: honest no-answer state and local save');
 await page.screenshot({path:'tests/evidence/09-question.png'});await page.keyboard.press('Escape');await page.evaluate(()=>getSelection().removeAllRanges());
 await page.getByRole('button',{name:'読書ガイド',exact:true}).click();await panel.getByRole('button',{name:'解説を追加',exact:true}).click();const fields=panel.locator('input,textarea');await fields.nth(0).fill('個人解説テスト');await fields.nth(1).fill('実用的');await fields.nth(2).fill('テスト用の短い説明です。');await fields.nth(3).fill('HTMLは実行されません。<img src=x onerror=alert(1)>');await panel.getByRole('button',{name:'このChromeに保存',exact:true}).click();await panel.getByRole('heading',{name:'個人解説テスト'}).waitFor();assert.equal(await panel.locator('img').count(),0);await page.reload();await page.locator('.osrg-term').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.osrg-term')].some(e=>e.textContent==='実用的'));check('custom explanation persists; content rendered as text');
 await page.getByRole('button',{name:'読書ガイド',exact:true}).click();await panel.getByRole('button',{name:'下線を一時的に消す',exact:true}).click();assert.equal(await page.locator('.osrg-term').count(),0);assert.deepEqual(await page.locator('.vp-doc pre').allTextContents(),before);await panel.getByRole('button',{name:'下線を有効にする',exact:true}).click();await page.locator('.osrg-term').first().waitFor();check('toggle restores original text, code unchanged');await page.keyboard.press('Escape');
 if(chapters.length>1){
   // Real VitePress client-side navigation, not a synthetic DOM fixture.
   await page.locator('a[href="/ja/10-process"]').first().click();await page.waitForURL('**/ja/10-process');await page.waitForFunction(()=>document.querySelector('.osrg-term[data-osrg-id="process"]'));check('SPA next chapter receives annotations');
   await page.goBack();await page.waitForURL('**/ja/09-memory-allocation');await page.waitForFunction(()=>document.querySelector('.osrg-term[data-osrg-id="allocation"]'));check('browser back restores chapter annotations');
 }
 for(const c of chapters){const start=Date.now();await page.goto(base+(c.number?'/'+c.slug:''));await page.locator('.osrg-term').first().waitFor();await page.getByRole('button',{name:'読書ガイド',exact:true}).click();assert.ok((await panel.locator('h2').innerText()).includes(c.title));const count=await page.locator('.osrg-term').count();assert.equal(await page.locator('pre .osrg-term,a .osrg-term,.osrg-term .osrg-term').count(),0);report.chapters.push({number:c.number,title:c.title,annotations:count,loadAndGuideMs:Date.now()-start});}
 check('all configured chapter URLs: annotated, guide correct, no nested marks');
 await page.goto(base+'/09-memory-allocation');await page.locator('.osrg-term').first().waitFor();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'読書ガイド',exact:true}).click();const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);await page.screenshot({path:'tests/evidence/mobile.png'});check('390px viewport remains within screen');
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'tests/evidence/dark.png'});check('dark mode screenshot');
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});await page.keyboard.press('Escape');
 await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://operating-system-in-1000-lines.vercel.app'});
 await page.getByRole('button',{name:'読書ガイド',exact:true}).click();await panel.getByRole('button',{name:'文章を質問する',exact:true}).click();await panel.locator('textarea').first().fill('このアドレスは何を表しますか');await panel.getByRole('button',{name:'質問文をコピー',exact:true}).click();await panel.getByText('質問文をコピーしました。',{exact:true}).waitFor();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('このアドレスは何を表しますか'));check('question clipboard contains context prompt');
 await panel.getByRole('button',{name:'章のガイド',exact:true}).click();const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'JSONを書き出す',exact:true}).click();const download=await downloadPromise;await download.saveAs('tests/evidence/personal-export.json');const saved=JSON.parse(fs.readFileSync('tests/evidence/personal-export.json','utf8'));assert.ok(saved.questions.some(q=>q.question==='未知の表現xyzzy'));assert.ok(saved.custom.some(e=>e.title==='個人解説テスト'));check('personal JSON exports saved questions and edits');
 const choose=page.waitForEvent('filechooser');await panel.getByRole('button',{name:'JSONを読み込む',exact:true}).click();await (await choose).setFiles('tests/evidence/personal-export.json');await panel.getByText('個人データを読み込みました。同じIDの解説は更新しました。',{exact:true}).waitFor();check('personal JSON imports successfully');
 const chooseBad=page.waitForEvent('filechooser');await panel.getByRole('button',{name:'JSONを読み込む',exact:true}).click();await (await chooseBad).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,custom:[{id:'bad',title:'bad',aliases:['bad'],short:'bad',detail:'[[bad]]'}],questions:[]}))});await panel.getByText('読み込めません: 循環参照: bad',{exact:true}).waitFor();check('cyclic custom JSON is rejected');
 await page.goto('https://example.com');assert.equal(await page.locator('#osrg-host').count(),0);check('unrelated origin receives no content script');
 await page.goto('https://operating-system-in-1000-lines.vercel.app/en/');assert.equal(await page.locator('#osrg-host:visible').count(),0);check('non-Japanese pages show no guide');
 assert.deepEqual(report.errors,[]);check('no uncaught page errors');
 }finally{fs.writeFileSync('tests/evidence/browser-report.json',JSON.stringify(report,null,2));await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
