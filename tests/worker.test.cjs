const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){let listener;const db={custom:[],questions:[{question:'keep'}]};const C=require('../extension/core'),entries=[...require('../data/glossary.json'),...require('../data/code-explanations.json')];const ctx=vm.createContext({console,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,importScripts(){},OSRGDiagram:require('../extension/diagram'),OSRGCore:C,OSRGData:{entries},OSRGAI:require('../extension/ai'),chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listener=f}},storage:{local:{async get(k){return structuredClone(db);},async set(v){Object.assign(db,structuredClone(v));}}}}});vm.runInContext(fs.readFileSync('extension/'+require('../extension/manifest.json').background.service_worker,'utf8'),ctx);const rpc=m=>new Promise(r=>listener(m,{id:'test',url:'chrome-extension://test/options.html'},r));return {rpc,db,ctx,entries};}
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

const D=require('../extension/diagram');
const diagramText='説明の前\n```diagram\n'+JSON.stringify({mode:'bits',title:'32ビット',fields:[{label:'上位',bits:20},{label:'下位',bits:12}]})+'\n```\n説明の後';
test('invalid diagram saves/imports are atomic and old personal diagrams remain loadable',async()=>{
 const {rpc,db}=setup();const bad={...e,detail:'以前の文章\n```diagram\n{}\n```\n続き'};db.custom=[bad];const old=JSON.stringify(db);
 const result=await rpc({type:'save',entry:{...e,detail:'```diagram\n{}'},expected:JSON.stringify(bad)});assert.equal(result.ok,false);assert.match(result.error,/図/);assert.equal(JSON.stringify(db),old);
 const valid={...e,id:'new-diagram',aliases:['new-diagram'],detail:diagramText};
 assert.equal((await rpc({type:'import',data:{version:1,custom:[valid,{...bad,id:'invalid',aliases:['invalid']}],questions:[]}})).ok,false);assert.equal(JSON.stringify(db),old);
 assert.equal((await rpc({type:'save',entry:valid})).ok,true);assert.equal(db.custom[0].detail,bad.detail);assert.equal(db.custom[1].detail,diagramText);
 assert.equal((await rpc({type:'import',data:{version:1,custom:[{...bad,detail:'conflict'}],questions:[]}})).skipped,1);assert.equal(db.custom[0].detail,bad.detail);
});
function fakeGenerate(ctx,db,data,inspect=()=>{}){db.planConfirmed=true;db.aiAccountId='synthetic-account';db.aiModel='synthetic-model';let received,disconnected;ctx.chrome.runtime.connectNative=()=>({onMessage:{addListener:f=>received=f},onDisconnect:{addListener:f=>disconnected=f},disconnect(){disconnected();},postMessage(m){inspect(m);setTimeout(()=>received({ok:true,response:{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]}}),0);}});}
const generated={title:'図を伴う生成',short:'概要',detail:diagramText,scopeNote:'補足',prerequisites:[],diagramDecision:{rating:'A',reason:'ビットの幅を分ける',existingTerm:''}};
test('generation validates, saves and re-imports a diagram with its decision',async()=>{
 const {rpc,db,ctx}=setup();fakeGenerate(ctx,db,generated);const r=await rpc({type:'generate',term:'図を伴う生成'});assert.equal(r.ok,true);assert.equal(db.custom[0].diagramDecision.rating,'A');assert.ok(db.custom[0].detail.includes(diagramText));D.validateEntry(db.custom[0]);
 const target=setup();assert.equal((await target.rpc({type:'import',data:{version:1,custom:db.custom,questions:[]}})).ok,true);assert.deepEqual(target.db.custom,db.custom);
});
test('malformed generated diagrams are rejected without altering any personal data',async()=>{
 const {rpc,db,ctx}=setup();db.custom=[e];fakeGenerate(ctx,db,{...generated,detail:'```diagram\n{}\n```'});const old=JSON.stringify(db.custom);const r=await rpc({type:'generate',term:'図の不正データ'});assert.equal(r.ok,false);assert.equal(JSON.stringify(db.custom),old);
});
test('generated shared diagrams get a stable explicit link; nonexistent shared figures are rejected',async()=>{
 const {rpc,db,ctx}=setup();const g={...generated,detail:'ポインタの図で値と番地を確かめます。',diagramDecision:{rating:'A',reason:'同じ番地の例を使う',existingTerm:'ポインタ'}};
 fakeGenerate(ctx,db,g,m=>assert.ok(m.known.some(k=>k.id==='pointer'&&k.hasDiagram)));assert.equal((await rpc({type:'generate',term:'共有図テスト',context:{excerpt:'ポインタ'}})).ok,true);assert.ok(db.custom[0].detail.includes('[[pointer|図：共有解説]]'));
 fakeGenerate(ctx,db,{...g,detail:'存在しない図を参照',diagramDecision:{...g.diagramDecision,existingTerm:'存在しない図'}});assert.equal((await rpc({type:'generate',term:'共有図の失敗'})).ok,false);assert.equal(db.custom.length,1);
});
