const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright'));
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const ctx=await chromium.launchPersistentContext(path.resolve('tests/.chrome-native-recovery-'+Date.now()),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1200,height:1000}});
 try{
  const d=await ctx.browser().newBrowserCDPSession();const {id}=await d.send('Extensions.loadUnpacked',{path:path.resolve('extension')});
  const p=await ctx.newPage();await p.goto('chrome-extension://'+id+'/options.html');
  await p.waitForFunction(()=>!document.getElementById('refresh').disabled);
  const workerStatus=await p.evaluate(()=>chrome.runtime.sendMessage({type:'account',action:'status'}));
  assert.equal(workerStatus.ok,true);assert.equal(workerStatus.signedIn,true);
  const command=await p.locator('#repair-command').textContent();
  assert.ok(command.includes('.\\scripts\\install-helper.ps1 -ExtensionId '+id));
  const saved=await p.evaluate(()=>chrome.storage.local.get(null));
  // Redirect only this disposable test worker to a nonexistent host; no registry mutation.
  const worker=ctx.serviceWorkers()[0];assert.ok(worker);
  await worker.evaluate(()=>{globalThis.__osrgConnect=chrome.runtime.connectNative;chrome.runtime.connectNative=()=>__osrgConnect('jp.osreadingguide.unregistered_test');});
  try{
   await p.locator('#refresh').click();
   await p.waitForFunction(()=>document.getElementById('status').textContent.includes('Chrome：Specified native messaging host not found.'));
   assert.ok((await p.locator('#status').textContent()).includes('setup-helper.cmd'));
   await p.locator('#repair-command').scrollIntoViewIfNeeded();
   await p.screenshot({path:'tests/evidence/native-repair-desktop.png',fullPage:true,mask:[p.locator('#account'),p.locator('#accounts')]});
   await p.setViewportSize({width:390,height:844});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:'tests/evidence/native-repair-mobile.png',fullPage:true,mask:[p.locator('#account'),p.locator('#accounts')]});
  }finally{await worker.evaluate(()=>{chrome.runtime.connectNative=__osrgConnect;delete globalThis.__osrgConnect;});}
  await p.locator('#refresh').click();
  await p.waitForFunction(()=>document.getElementById('status').textContent==='接続状態を更新しました。',{},{timeout:45000});
  const final=await p.evaluate(()=>chrome.runtime.sendMessage({type:'account',action:'status'}));
  assert.equal(final.ok,true);assert.equal(final.signedIn,true);
  assert.deepEqual(await p.evaluate(()=>chrome.storage.local.get(null)),saved);
  const report={extensionId:id,workerConnected:true,signedInPreserved:true,missingHostErrorDisplayed:true,repairCommandHasCurrentId:true,mobileFits:true,reconnectSucceeded:true,storageUnchanged:true,generationPerformed:false};
  fs.writeFileSync('tests/evidence/native-recovery-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await ctx.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

