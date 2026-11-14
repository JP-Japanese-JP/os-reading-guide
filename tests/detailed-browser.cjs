const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright'));
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const entries=require('../data/glossary.json');
const cases=[['allocation','09-memory-allocation'],['sv32','11-page-table'],['context','10-process']];
async function fits(figure,width){
  const bounds=await figure.boundingBox();
  assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width,'figure fits viewport');
  assert.ok(await figure.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'figure has no horizontal overflow');
}
(async()=>{
  const ctx=await chromium.launchPersistentContext(path.resolve('tests/.chrome-detailed-'+Date.now()),{
    executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
    ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],
    viewport:{width:1440,height:1000}
  });
  const errors=[],results=[];
  ctx.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{
    const c=await ctx.browser().newBrowserCDPSession();
    const {id}=await c.send('Extensions.loadUnpacked',{path:path.resolve('extension')});
    for(const [entryId,slug] of cases){
      const entry=entries.find(e=>e.id===entryId);
      const b=await ctx.newPage();
      await b.goto('https://operating-system-in-1000-lines.vercel.app/ja/'+slug+'#osrg-entry='+entryId);
      const h=b.locator('#osrg-host');
      await h.locator('h2').waitFor();
      assert.equal(await h.locator('figure').count(),0);
      assert.equal(await h.locator('.short').innerText(),entry.short);
      await h.getByRole('button',{name:'詳しい説明を読む',exact:true}).click();
      const figure=h.locator('figure').first();
      await figure.locator('svg').waitFor();
      const labels=await figure.locator('svg text tspan').allTextContents();
      if(entryId==='allocation')assert.ok(labels.some(s=>s.includes('0x80222fff')),'address stays on one line');
      if(entryId==='context')assert.ok(labels.some(s=>s.includes('CPU')),'CPU stays on one line');
      assert.equal(await h.locator('div.detail').count(),1);
      if(entryId==='allocation')assert.ok((await h.locator('.panel').innerText()).includes('8192'));
      assert.ok(await h.locator('.panel').evaluate(e=>e.scrollHeight>e.clientHeight));
      await figure.scrollIntoViewIfNeeded();await fits(figure,1440);
      await b.screenshot({path:'tests/evidence/detailed-'+entryId+'-popup.png'});
      await b.setViewportSize({width:390,height:844});
      await figure.scrollIntoViewIfNeeded();await fits(figure,390);
      await b.screenshot({path:'tests/evidence/detailed-'+entryId+'-mobile.png'});
      await figure.locator('summary').click();
      assert.ok(await figure.locator('details .link').count()>0);
      const d=await ctx.newPage();
      await d.goto('chrome-extension://'+id+'/dictionary.html#'+entryId);
      const df=d.locator('figure').first();await df.locator('svg').waitFor();
      await df.scrollIntoViewIfNeeded();
      await d.screenshot({path:'tests/evidence/detailed-'+entryId+'-dictionary.png'});
      await d.setViewportSize({width:390,height:844});
      await df.scrollIntoViewIfNeeded();await fits(df,390);
      await d.screenshot({path:'tests/evidence/detailed-'+entryId+'-dictionary-mobile.png'});
      results.push({id:entryId,shortThenDetail:true,scrollable:true,actualBaseDiagram:true,dictionary:true,mobileFits:true,textDiagramLinks:true});
      await b.close();await d.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync('tests/evidence/detailed-report.json',JSON.stringify({cases:results,pageErrors:errors},null,2));
    console.log('PASS all three base diagrams, overview/detail, scrolling, dictionary, 390px layouts and text links');
  }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

