const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright'));
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const profile=path.resolve('tests/.chrome-account-persistence-'+Date.now());
const entry={id:'account-preservation-fixture',title:'保持確認',aliases:['保持確認'],short:'保持確認',detail:'個人辞書と図は認証と独立しています。',prerequisites:[]};
const questions=[{question:'保持するメモ'}];
async function launch(){const ctx=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});const c=await ctx.browser().newBrowserCDPSession();const {id}=await c.send('Extensions.loadUnpacked',{path:path.resolve('extension')});const p=await ctx.newPage();await p.goto('chrome-extension://'+id+'/options.html');await p.waitForFunction(()=>!document.getElementById('refresh').disabled);return {ctx,p};}
(async()=>{
 let {ctx,p}=await launch();let first;
 try{
  first=await p.evaluate(()=>chrome.runtime.sendMessage({type:'account',action:'status'}));assert.equal(first.ok,true);assert.equal(first.signedIn,true);
  await p.evaluate(({entry,questions})=>chrome.storage.local.set({custom:[entry],questions,planConfirmed:false}),{entry,questions});
 }finally{await ctx.close();}
 ({ctx,p}=await launch());
 try{
  const next=await p.evaluate(()=>chrome.runtime.sendMessage({type:'account',action:'status'}));assert.equal(next.ok,true);assert.equal(next.signedIn,true);assert.equal(next.accountId,first.accountId);assert.equal(next.profiles.length,2);
  const models=await p.evaluate(accountId=>chrome.runtime.sendMessage({type:'account',action:'models',accountId}),next.accountId);assert.equal(models.ok,true);assert.ok(models.models.some(m=>m.slug==='gpt-6.1-sol'));
  const db=await p.evaluate(()=>chrome.storage.local.get(['custom','questions','planConfirmed']));assert.deepEqual(db.custom,[entry]);assert.deepEqual(db.questions,questions);assert.equal(db.planConfirmed,false);assert.equal(await p.locator('#confirmed').isChecked(),false);
  const report={date:'2026-11-02',realNativeMessaging:true,chromeClosedAndReopened:true,sameActiveRegistration:true,signedInAfterRestart:true,savedRegistrations:next.profiles.length,modelCount:models.models.length,gpt61SolAvailable:true,personalAndQuestionsPreserved:true,creditsOffNotYetConfirmed:true,generationConsentRemainsDisabled:true,generationPerformed:false,pcRestartPerformed:false};
  fs.writeFileSync('tests/evidence/account-restart-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await ctx.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
