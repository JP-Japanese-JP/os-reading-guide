'use strict';
// No API keys, inherited Codex credentials, arbitrary URLs, or command execution RPC.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {spawn}=require('node:child_process');
const AI=require('./ai.js'),Accounts=require('./accounts.cjs');
const AUTH='https://auth.openai.com',API='https://api.openai.com/v1';
// Installed hosts use their own installation's credential directory, independent
// of environment variables inherited from the Chrome process.
const installed=path.basename(__dirname)==='host'&&path.basename(path.dirname(__dirname))==='OSReadingGuide';
const ROOT=installed?path.dirname(__dirname):path.join(process.env.LOCALAPPDATA||'', 'OSReadingGuide');
const FILE=path.join(ROOT,'credentials.dpapi');
const scope='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
function child(args,input='',releaseOutput=false){return new Promise((resolve,reject)=>{const p=spawn(ps,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.setEncoding('utf8');p.stdout.on('data',b=>out+=b);p.on('error',()=>reject(Error('Windows保護機構を起動できません。')));p.on('exit',code=>{if(releaseOutput){p.stdout.destroy();p.stderr.destroy();}code===0?resolve(out):reject(Error('Windowsの認証情報保護に失敗しました。'));});p.stdin.end(input);});}
async function protect(value,mode){return child(['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'protect.ps1'),mode],value);}
async function read(){try{return Accounts.normalize(JSON.parse(await protect(fs.readFileSync(FILE,'utf8'),'unprotect')));}catch(e){if(e.code==='ENOENT')return Accounts.normalize({host:'urn:uuid:'+crypto.randomUUID()});throw Error('保存した認証情報を復号できません。Windowsアカウントを確認してください。');}}
async function write(s){fs.mkdirSync(ROOT,{recursive:true});const tmp=FILE+'.'+process.pid;fs.writeFileSync(tmp,await protect(JSON.stringify(s),'protect'));fs.renameSync(tmp,FILE);}
async function locked(fn){fs.mkdirSync(ROOT,{recursive:true});const lock=path.join(ROOT,'session.lock');for(let i=0;i<600;i++){try{fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'pid'),String(process.pid));try{return await fn();}finally{fs.rmSync(lock,{recursive:true,force:true});}}catch(e){if(e.code!=='EEXIST')throw e;try{const pid=Number(fs.readFileSync(path.join(lock,'pid'),'utf8'));if(pid>0){try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH')fs.rmSync(lock,{recursive:true,force:true});}}}catch{}await new Promise(r=>setTimeout(r,500));}}throw Error('別のログイン・生成処理が進行中です。');}
async function json(url,options={}){let r;try{r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});}catch{throw Error('OpenAIへ接続できません。ネットワークを確認してください。');}if(!r.ok){if(r.status===401)throw Error('認証の有効期限が切れました。AI設定からログインし直してください。');if(r.status===429)throw Error('ChatGPTの利用上限に達しました。利用状況を確認し、回復を待ってください。');throw Error('OpenAIとの通信に失敗しました（HTTP '+r.status+'）。保存していません。');}return r.json();}
const form=values=>({method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
async function discovery(){const d=await json(AUTH+'/.well-known/openid-configuration');for(const k of ['jwks_uri','revocation_endpoint']){if(d[k]&&new URL(d[k]).origin!==AUTH)throw Error('認証サービスのURLを検証できません。');}return d;}
async function validateId(jwt,client,nonce,jwks){const parts=jwt.split('.');if(parts.length!==3)throw Error('IDトークンが不正です。');const head=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));if(head.alg!=='RS256')throw Error('署名方式を検証できません。');const jwk=jwks.keys.find(k=>k.kid===head.kid&&k.kty==='RSA');if(!jwk||!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('IDトークンの署名が不正です。');const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];if(claims.iss!==AUTH||!aud.includes(client)||claims.exp<=Date.now()/1000||claims.nonce!==nonce||!claims.sub||(aud.length>1&&claims.azp!==client))throw Error('IDトークンの本人情報を検証できません。');return claims;}
function tokenSet(t,previous={}){const scopes=(t.scope||previous.scope||'').split(' ');if(!scopes.includes('chatgpt.tokens.use.direct')||!t.access_token)throw Error('ChatGPTプランの利用が許可されていません。再ログインして許可してください。');return {...previous,...t,scope:scopes.join(' '),expiresAt:Date.now()+Number(t.expires_in||3600)*1000};}
async function openAuthorization(url){
 // URL travels through stdin, never a command-line log; no tokens enter browser storage.
 await child(['-NoProfile','-NonInteractive','-Command',"$url=[Console]::In.ReadToEnd(); Start-Process -FilePath $url"],url,true);
}
function callbackError(code){
 if(code==='3p_login_workspace_scope_denied')return Error('この登録は別のChatGPTアカウント／ワークスペース用です。「ChatGPTアカウントを切り替える」から別の登録を追加してください。');
 return Error('ログインまたはプラン利用が許可されませんでした。既存の接続は変更していません。');
}
async function login(s,{newAccount=false}={},deps={}){
 const save=deps.write||write,open=deps.open||openAuthorization;
 const selected=newAccount?undefined:Accounts.active(s);
 const state=crypto.randomBytes(32).toString('base64url'),nonce=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
 await save(s); // Persist stable host and legacy migration, preserving every account.
 const server=http.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const redirect='http://127.0.0.1:'+server.address().port+'/auth/callback';
 let timeout,settled=false;
 const callback=new Promise((resolve,reject)=>{
  timeout=setTimeout(()=>reject(Error('ログイン待機が終了しました。既存の接続は変更していません。')),deps.timeoutMs||240000);
  server.on('request',(req,res)=>{
   const u=new URL(req.url,redirect);
   if(settled||u.pathname!=='/auth/callback'||u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid callback');return;}
   settled=true;res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"});
   res.end('OS読書ガイド：認証結果を受け取りました。AI設定へ戻ってください。');
   if(u.searchParams.has('error'))reject(callbackError(u.searchParams.get('error')));else resolve(u.searchParams);
  });
 });callback.catch(()=>{});
 try{
  const params=Accounts.authorization(s,selected,{redirect,state,nonce,verifier});
  await open(AUTH+'/api/accounts/authorize?'+params);
  const result=await callback,client=result.get('client_id')||selected?.client_id;
  if(!client||client==='dynamic_agent_client'||(selected&&client!==selected.client_id)||!result.get('code'))throw Error('登録結果が不正です。既存の接続は変更していません。');
  let profile=selected||s.profiles.find(p=>p.client_id===client);
  if(!profile){profile={id:Accounts.profileId(client),label:'接続'+(s.profiles.length+1),client_id:client};s.profiles.push(profile);await save(s);}
  const t=await (deps.exchange||((body)=>json(AUTH+'/api/accounts/oauth/token',form(body))))({grant_type:'authorization_code',client_id:client,code:result.get('code'),code_verifier:verifier,redirect_uri:redirect,resource:API});
  const identity=await (deps.verify|| (async(t,client,nonce)=>{const d=await discovery();return validateId(t.id_token,client,nonce,await json(d.jwks_uri));}))(t,client,nonce);
  if(profile.subject&&profile.subject!==identity.sub)throw Error('登録済みアカウントと一致しません。既存の接続は変更していません。別アカウントは「ChatGPTアカウントを切り替える」から追加してください。');
  const next={...tokenSet(t),id:profile.id,label:profile.label,client_id:client,subject:identity.sub,email:identity.email||''};
  s.profiles=s.profiles.map(p=>p.id===profile.id?next:p);s.activeId=next.id;await save(s);
  return Accounts.status(s);
 }finally{clearTimeout(timeout);server.close();callback.catch(()=>{});}
}
async function access(s){if(!s.access_token)throw Error('AI設定でContinue with ChatGPTを押してログインしてください。');if(s.expiresAt<Date.now()+60000){const t=await json(AUTH+'/api/accounts/oauth/token',form({grant_type:'refresh_token',client_id:s.client_id,refresh_token:s.refresh_token,resource:API}));s=tokenSet(t,s);}return s;}
async function consumeSSE(body){const reader=body.getReader(),decoder=new TextDecoder();let buffer='',size=0,completed;const items=new Map(),texts=new Map();
 const event=block=>{const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')return;const e=JSON.parse(data);if(['error','response.failed','response.incomplete'].includes(e.type))throw Error('ChatGPTの生成が完了しませんでした。利用枠・接続状態を確認してください。辞書には保存していません。');if(e.type==='response.output_item.done')items.set(e.output_index,e.item);
 if(e.type==='response.output_text.delta'||e.type==='response.output_text.done'){const key=String(e.output_index||0)+':'+String(e.content_index||0);texts.set(key,e.type==='response.output_text.done'?e.text:(texts.get(key)||'')+e.delta);}
 if(e.type==='response.completed')completed=e.response;};
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4000000)throw Error('生成結果が大きすぎます。保存していません。');buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');let i;while((i=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,i));buffer=buffer.slice(i+2);}}
 if(buffer.trim())event(buffer);if(!completed)throw Error('生成が途中で切れました。保存していません。');if(!completed.output?.length){completed={...completed,output:[...items.entries()].sort((a,b)=>a[0]-b[0]).map(([,item])=>item)};if(!completed.output.some(item=>item.content?.some(c=>c.type==='output_text'))&&texts.size){completed.output.push({type:'message',role:'assistant',content:[...texts.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,text])=>({type:'output_text',text}))});}}
 AI.parse(completed);return completed;
}
async function handle(m){
 // Atomic credential-file replacement makes this read safe without waiting for OAuth.
 // Status must stay available while a different process waits for browser approval.
 if(m.action==='status')return {...Accounts.status(await read()),helperVersion:'1.4.5',accountProtocol:2};
 return locked(async()=>{
 const store=await read();let s=Accounts.active(store);
 if(m.action==='login')return login(store);
 if(m.action==='switch_account')return login(store,{newAccount:true});
 if(m.action==='select_account'){
  const selected=store.profiles.find(p=>p.id===m.profileId);if(!selected)throw Error('保存済みアカウントが見つかりません。');
  store.activeId=selected.id;await write(store);return Accounts.status(store);
 }
 if(m.action==='logout'){
  let revoked=true;
  if(s?.refresh_token)try{const d=await discovery();const r=await fetch(d.revocation_endpoint,{...form({token:s.refresh_token,token_type_hint:'refresh_token',client_id:s.client_id}),signal:AbortSignal.timeout(30000)});revoked=r.ok;}catch{revoked=false;}
  if(s){store.profiles=store.profiles.map(p=>p.id===s.id?Accounts.clearTokens(p):p);await write(store);}
  return {...Accounts.status(store),revoked};
 }
 if(!['models','generate'].includes(m.action))throw Error('未対応の操作です。');
 if(m.action==='generate'||m.accountId!==undefined)s=Accounts.assertAccount(store,m.accountId);
 if(!s)throw Error('AI設定でContinue with ChatGPTを押してログインしてください。');
 const refreshed=await access(s);if(refreshed!==s){store.profiles=store.profiles.map(p=>p.id===s.id?refreshed:p);await write(store);s=refreshed;}
 const headers={Authorization:'Bearer '+s.access_token};const catalog=await json(API+'/models',{headers});const models=(catalog.models||[]).filter(x=>x.visibility==='list').map(x=>({slug:x.slug,name:x.display_name}));if(m.action==='models')return {models,accountId:s.id};
 if(typeof m.term!=='string'||!m.term.trim()||m.term.length>200||JSON.stringify(m.context).length>20000||JSON.stringify(m.known).length>80000)throw Error('生成対象の形式が不正です。');const model=m.model||models[0]?.slug;if(!models.some(x=>x.slug===model))throw Error('このアカウントで利用できるモデルをAI設定で選んでください。');
 const r=await fetch(API+'/responses',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(AI.request(model,m.term,m.context,m.known)),signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('ChatGPTで生成できません（HTTP '+r.status+'）。利用状況とログインを確認してください。有料APIへの切り替えは行いません。');return {response:await consumeSSE(r.body),model};
 });}
function send(value){const b=Buffer.from(JSON.stringify(value));const h=Buffer.alloc(4);h.writeUInt32LE(b.length);process.stdout.write(Buffer.concat([h,b]));}
function main(){const settings=JSON.parse(fs.readFileSync(path.join(__dirname,'host-config.json'),'utf8'));if(!(settings.origins||[settings.origin]).includes(process.argv[2]))process.exit(1);let input=Buffer.alloc(0),started=false;process.stdin.on('data',b=>{if(started)return;input=Buffer.concat([input,b]);if(input.length<4)return;const n=input.readUInt32LE();if(n>200000){process.exit(1);}if(input.length>=n+4){started=true;let m;try{m=JSON.parse(input.subarray(4,n+4));}catch{send({ok:false,error:'入力形式が不正です。'});return;}handle(m).then(result=>send({ok:true,...result}),e=>send({ok:false,error:/^[一-龯ぁ-んァ-ヶ]/u.test(e.message)||/^(ChatGPT|OpenAI|Windows|IDトークン)/.test(e.message)?e.message:'処理に失敗しました。接続とログインを確認してください。保存していません。'})).finally(()=>{process.stdin.pause();});}});}
module.exports={validateId,tokenSet,consumeSSE,handle,protect,read,write,login,callbackError};if(require.main===module)main();

