const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){let listener;const db={custom:[],questions:[{question:'keep'}]};const C=require('../extension/core'),entries=[...require('../data/glossary.json'),...require('../data/code-explanations.json')];const ctx=vm.createContext({console,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,importScripts(){},OSRGCore:C,OSRGData:{entries},OSRGAI:require('../extension/ai'),chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listener=f}},storage:{local:{async get(k){return structuredClone(db);},async set(v){Object.assign(db,structuredClone(v));}}}}});vm.runInContext(fs.readFileSync('extension/'+require('../extension/manifest.json').background.service_worker,'utf8'),ctx);const rpc=m=>new Promise(r=>listener(m,{id:'test',url:'chrome-extension://test/options.html'},r));return {rpc,db,ctx,entries};}
const e={id:'test-entry',title:'テスト語',aliases:['テスト語'],short:'short',detail:'detail',prerequisites:[]};
test('simultaneous saves preserve both; stale edits and duplicates rejected',async()=>{const {rpc,db}=setup();await Promise.all([rpc({type:'save',entry:e}),rpc({type:'save',entry:{...e,id:'second',aliases:['second']}})]);assert.equal(db.custom.length,2);assert.equal((await rpc({type:'save',entry:{...e,detail:'stale'},expected:'bad'})).ok,false);assert.ok((await rpc({type:'save',entry:{...e,id:'duplicate'}})).existing.includes(e.id));assert.equal(db.questions[0].question,'keep');});
test('import restores base edits without overwriting personal edits',async()=>{const {rpc,db,entries}=setup();const edit={...entries[0],short:'restored'};assert.equal((await rpc({type:'import',data:{version:1,custom:[edit],questions:[]}})).ok,true);assert.equal(db.custom[0].short,'restored');await rpc({type:'import',data:{version:1,custom:[{...edit,short:'conflict'}],questions:[]}});assert.equal(db.custom[0].short,'restored');});
test('deleting a referenced custom entry keeps dependent explanation text',async()=>{const {rpc,db}=setup();db.custom=[e,{...e,id:'dependent',aliases:['dependent'],detail:'[[test-entry|ラベル]]',prerequisites:['test-entry']}];assert.equal((await rpc({type:'delete',id:e.id,expected:JSON.stringify(e)})).ok,true);assert.equal(db.custom[0].detail,'ラベル');assert.deepEqual(db.custom[0].prerequisites,[]);});
test('generation stops before native call without plan confirmation',async()=>{const {rpc,db}=setup();const r=await rpc({type:'generate',term:'unknown'});assert.equal(r.ok,false);assert.ok(r.error.includes('クレジット'));assert.equal(db.custom.length,0);});

test('native disconnect reads lastError and gives actionable missing/forbidden diagnostics',async()=>{
 for(const reason of ['Specified native messaging host not found.','Access to the specified native messaging host is forbidden.','Native host has exited.']){
  const {rpc,ctx,db}=setup();let disconnected,read=0;
  Object.defineProperty(ctx.chrome.runtime,'lastError',{get(){read++;return {message:reason};}});
  ctx.chrome.runtime.connectNative=()=>({onMessage:{addListener(){}},onDisconnect:{addListener(fn){disconnected=fn;}},disconnect(){},postMessage(){setTimeout(disconnected,0);}});
  const r=await rpc({type:'account',action:'status'});
  assert.equal(r.ok,false);assert.equal(read,1);assert.ok(r.error.includes(reason));assert.ok(r.error.includes('setup-helper.cmd'));assert.ok(r.error.includes('拡張ID：test'));assert.equal(db.custom.length,0);
 }
});
test('native success remains successful when intentional disconnect fires',async()=>{
 const {rpc,ctx}=setup();let received,disconnected,read=0;
 Object.defineProperty(ctx.chrome.runtime,'lastError',{get(){read++;return undefined;}});
 ctx.chrome.runtime.connectNative=()=>({onMessage:{addListener(fn){received=fn;}},onDisconnect:{addListener(fn){disconnected=fn;}},disconnect(){disconnected();},postMessage(){setTimeout(()=>received({ok:true,signedIn:true}),0);}});
 const r=await rpc({type:'account',action:'status'});assert.equal(r.ok,true);assert.equal(r.signedIn,true);assert.equal(r.backgroundVersion,'1.4.5');assert.equal(read,1);
});

test('account changes clear only generation consent, preserving custom data and questions',async()=>{
 const {rpc,ctx,db}=setup();db.custom=[e];db.planConfirmed=true;db.aiAccountId='old-account';
 let received,disconnected;
 ctx.chrome.runtime.connectNative=()=>({onMessage:{addListener(fn){received=fn;}},onDisconnect:{addListener(fn){disconnected=fn;}},disconnect(){disconnected();},postMessage(message){assert.equal(message.action,'select_account');assert.equal(message.profileId,'new-account');setTimeout(()=>received({ok:true,accountId:'new-account'}),0);}});
 const r=await rpc({type:'account',action:'select_account',profileId:'new-account'});
 assert.equal(r.ok,true);assert.equal(db.planConfirmed,false);assert.equal(db.aiAccountId,'');assert.equal(db.custom[0].id,e.id);assert.equal(db.questions[0].question,'keep');
});
