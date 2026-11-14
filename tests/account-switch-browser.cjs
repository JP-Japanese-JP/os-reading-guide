const {chromium}=require(process.env.PLAYWRIGHT_PATH||require('node:path').join(require('node:os').homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright'));
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const ctx=await chromium.launchPersistentContext(path.resolve('tests/.chrome-account-ui-'+Date.now()),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1200,height:1000}});
 try{
  const cd=await ctx.browser().newBrowserCDPSession();const {id}=await cd.send('Extensions.loadUnpacked',{path:path.resolve('extension')});
  const p=await ctx.newPage();await p.goto('chrome-extension://'+id+'/dictionary.html');
  const worker=ctx.serviceWorkers()[0];assert.ok(worker);
  await worker.evaluate(()=>{
   const profiles=[{id:'account-a',label:'接続1',email:'first@example.invalid',signedIn:true,active:true}];let accountId='account-a';
   globalThis.__deny=true;globalThis.__seen=[];
   const status=()=>({ok:true,signedIn:true,email:profiles.find(x=>x.id===accountId).email,accountId,profiles:profiles.map(p=>({...p,active:p.id===accountId}))});
   chrome.runtime.connectNative=()=>{
    let receive,disconnect;
    return {onMessage:{addListener(fn){receive=fn;}},onDisconnect:{addListener(fn){disconnect=fn;}},disconnect(){disconnect?.();},postMessage(m){
     __seen.push({action:m.action,accountId:m.accountId});
     setTimeout(()=>{
      let result;
      if(m.action==='status')result=status();
      if(m.action==='models')result=m.accountId===accountId?{ok:true,models:[{slug:'model-'+accountId,name:'モデル '+accountId}],accountId}:{ok:false,error:'account mismatch'};
      if(m.action==='select_account'){accountId=m.profileId;result=status();}
      if(m.action==='switch_account'){
       if(__deny)result={ok:false,error:'この登録は別のChatGPTアカウント／ワークスペース用です。「ChatGPTアカウントを切り替える」から別の登録を追加してください。'};
       else{if(!profiles.some(x=>x.id==='account-b'))profiles.push({id:'account-b',label:'接続2',email:'plus@example.invalid',signedIn:true});accountId='account-b';result=status();}
      }
      if(m.action==='generate')result={ok:false,error:m.accountId!==accountId?'ChatGPTアカウントが変更されました。':'No generation in this test'};
      receive(result||{ok:false,error:'Unexpected test operation'});
     },0);
    }};
   };
  });
  const personal={id:'keep-account-test',title:'保持テスト',aliases:['保持テスト'],short:'保持',detail:'図と個人辞書を保持',prerequisites:[]};
  const questions=[{question:'keep this memo'}];
  await p.evaluate(({personal,questions})=>chrome.storage.local.set({custom:[personal],questions,planConfirmed:true,aiAccountId:'account-a',aiModel:'model-account-a'}),{personal,questions});
  await p.goto('chrome-extension://'+id+'/options.html');await p.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await p.locator('#switch-account').click();await p.waitForFunction(()=>document.getElementById('status').textContent.includes('別のChatGPTアカウント'));
  assert.ok((await p.locator('#account').textContent()).includes('first@example.invalid'));
  assert.equal((await p.evaluate(()=>chrome.storage.local.get('planConfirmed'))).planConfirmed,false);
  await worker.evaluate(()=>{__deny=false;});
  await p.locator('#switch-account').click();await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('認証を検証して'));
  assert.ok((await p.locator('#account').textContent()).includes('plus@example.invalid'));
  assert.equal(await p.locator('#accounts option').count(),2);assert.equal(await p.locator('#confirmed').isChecked(),false);
  assert.equal(await p.locator('#model').inputValue(),'model-account-b');
  await p.locator('#confirmed').check();await p.locator('#settings button[type=submit]').click();
  await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('このChatGPT接続の設定を保存'));
  assert.equal((await p.evaluate(()=>chrome.storage.local.get('aiAccountId'))).aiAccountId,'account-b');
  await p.screenshot({path:'tests/evidence/account-switch-desktop.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:'tests/evidence/account-switch-mobile.png',fullPage:true});
  await p.locator('#accounts').selectOption('account-a');await p.locator('#use-account').click();await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('保存済みの接続を選びました'));
  assert.ok((await p.locator('#account').textContent()).includes('first@example.invalid'));
  const db=await p.evaluate(()=>chrome.storage.local.get(['custom','questions','planConfirmed']));assert.deepEqual(db.custom,[personal]);assert.deepEqual(db.questions,questions);assert.equal(db.planConfirmed,false);
  const report={syntheticNativeResponses:true,failedSwitchKeepsPrevious:true,newAccountSelected:true,modelListFollowsAccount:true,consentBoundToAccount:true,savedAccountSelection:true,personalAndQuestionsPreserved:true,mobileFits:true,noRealLoginOrGeneration:true};
  fs.writeFileSync('tests/evidence/account-switch-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await ctx.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
