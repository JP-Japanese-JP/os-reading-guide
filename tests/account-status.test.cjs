const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),os=require('os'),cp=require('child_process');
async function ui(initial){
 const state={signedIn:false,email:'',accountId:'',profiles:[],...initial},actions=[],events={},elements={};let finishLogin;
 for(const id of ['connection-diagnostic','status','model','extension-id','repair-command','copy-repair','login','logout','refresh','switch-account','use-account','accounts','account','confirmed','settings'])elements[id]={value:'',textContent:'',disabled:false,checked:false,options:[],replaceChildren(){this.options=[];this.value='';},append(o){this.options.push(o);if(!this.value)this.value=o.value;}};
 const ctx=vm.createContext({Option:class{constructor(text,value){this.textContent=text;this.value=value;}},document:{visibilityState:'visible',getElementById:id=>elements[id],addEventListener:(name,fn)=>events[name]=fn},window:{addEventListener:(name,fn)=>events[name]=fn},navigator:{clipboard:{writeText:async()=>{}}},chrome:{runtime:{id:'test',getManifest:()=>({version:'1.4.4',background:{service_worker:'service-worker.js'}}),async sendMessage(m){actions.push(m.action);if(m.action==='status')return {ok:true,...state};if(m.action==='models'&&state.simulateNetworkFailure)throw Error('OpenAIへ接続できません。ネットワークを確認してください。');if(m.action==='models')return {ok:true,models:[{slug:'gpt-6.1-sol'}]};if(m.action==='login')return new Promise(r=>finishLogin=()=>r({ok:true}));throw Error('unexpected operation');}},storage:{local:{async get(){return {planConfirmed:false};},async set(){throw Error('settings must not be changed');}}}}});
 await vm.runInContext(fs.readFileSync('extension/options.js','utf8'),ctx);return {state,actions,events,elements,complete(){finishLogin();}};
}
const signed={signedIn:true,email:'example@example.invalid',accountId:'account-2',profiles:[{id:'account-2',label:'接続2',email:'example@example.invalid',signedIn:true,active:true}]};
test('returning to settings refreshes stale signed-out display from saved authentication',async()=>{
 const u=await ui();a.match(u.elements.account.textContent,/未ログイン/);Object.assign(u.state,signed);await u.events.focus();a.match(u.elements.account.textContent,/Using ChatGPT plan/);a.equal(u.elements.accounts.options.length,1);a.equal(u.elements.model.value,'gpt-6.1-sol');a.equal(u.elements.confirmed.checked,false);
});
test('Continue uses an already usable saved login without opening another OAuth flow',async()=>{
 const u=await ui(signed);await u.elements.login.onclick();a.equal(u.actions.includes('login'),false);a.match(u.elements.status.textContent,/再ログインは不要/);a.equal(u.elements.login.disabled,false);
});
test('pending login can refresh authentication status without queueing model requests',async()=>{
 const u=await ui();const pending=u.elements.login.onclick();await new Promise(r=>setImmediate(r));a.match(u.elements.account.textContent,/認証手続き中/);a.equal(u.elements.login.disabled,true);
 Object.assign(u.state,signed);const modelCalls=u.actions.filter(x=>x==='models').length;await u.events.focus();a.match(u.elements.account.textContent,/Using ChatGPT plan/);a.equal(u.actions.filter(x=>x==='models').length,modelCalls);
 u.complete();await pending;a.equal(u.elements.login.disabled,false);a.equal(u.elements.model.value,'gpt-6.1-sol');
});
test('read-only native status is not blocked by another live authentication lock',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'osrg-status-')),root=path.join(temp,'OSReadingGuide'),lock=path.join(root,'session.lock');fs.mkdirSync(lock,{recursive:true});fs.writeFileSync(path.join(lock,'pid'),String(process.pid));
 const code="require('./native/host.cjs').handle({action:'status'}).then(s=>console.log(JSON.stringify({signedIn:s.signedIn,profiles:s.profiles.length})))";
 try{const r=cp.spawnSync(process.execPath,['-e',code],{cwd:path.resolve(__dirname,'..'),env:{...process.env,LOCALAPPDATA:temp},encoding:'utf8',timeout:2000});a.equal(r.status,0,r.stderr);a.deepEqual(JSON.parse(r.stdout),{signedIn:false,profiles:0});a.ok(fs.existsSync(lock));}
 finally{a.ok(temp.startsWith(path.join(os.tmpdir(),'osrg-status-')));fs.rmSync(temp,{recursive:true});}
});

test('old host response is diagnosed instead of shown as signed out',async()=>{const u=await ui({profiles:undefined});a.match(u.elements.account.textContent,/応答形式/);a.match(u.elements.status.textContent,/接続診断/);a.match(u.elements['connection-diagnostic'].textContent,/一覧 undefined/);await u.elements.login.onclick();a.equal(u.actions.includes('login'),false);});
test('temporary model network failure does not initiate another login',async()=>{const u=await ui({...signed,simulateNetworkFailure:true});await u.elements.login.onclick();a.equal(u.actions.includes('login'),false);a.match(u.elements.account.textContent,/Using ChatGPT plan/);a.match(u.elements.status.textContent,/ネットワーク/);});

test('connection diagnostic contains only safe shape and version metadata',async()=>{const u=await ui({...signed,backgroundVersion:'1.4.4',helperVersion:'1.4.4'});const d=u.elements['connection-diagnostic'].textContent;a.match(d,/バックグラウンド 1.4.4／補助 1.4.4／一覧 1件／ログイン情報 true/);a.match(d,/Chrome登録 1.4.4 \(service-worker.js\)/);a.ok(!d.includes(signed.email));a.ok(!d.includes(signed.accountId));});

test('settings renders Japanese connection numbers even from a corrupted stored label',async()=>{const u=await ui({...signed,profiles:[{...signed.profiles[0],label:'接綁E'}]});a.match(u.elements.account.textContent,/接続1/);a.match(u.elements.accounts.options[0].textContent,/^接続1：/);a.ok(!u.elements.account.textContent.includes('接綁E'));});
