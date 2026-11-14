(async()=>{
 const $=id=>document.getElementById(id),status=$('status'),model=$('model');let accountId='',busyCount=0,signingIn=false;
 $('extension-id').textContent=chrome.runtime.id;
 $('repair-command').textContent='powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\install-helper.ps1 -ExtensionId '+chrome.runtime.id;
 $('copy-repair').onclick=async()=>{try{await navigator.clipboard.writeText($('repair-command').textContent);status.textContent='修復コマンドをコピーしました。配布フォルダーで開いたPowerShellへ貼り付けて実行してください。';}catch{status.textContent='コピーできませんでした。表示されたコマンドを選択してコピーしてください。';}};
 const rpc=async(action,payload={})=>{const r=await chrome.runtime.sendMessage({type:'account',action,...payload});if(!r?.ok)throw Error(r?.error||'接続に失敗しました。');return r;};
 const busy=value=>{busyCount+=value?1:-1;for(const id of ['login','logout','refresh','switch-account','use-account','accounts'])$(id).disabled=busyCount>0;};
 async function refresh({withModels=true}={}){
  const s=await rpc('status');
  const version=v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v)?v:'不明';
  const registered=chrome.runtime.getManifest?.();
  const worker=registered?.background?.service_worker;
  const workerName=typeof worker==='string'&&/^[a-z0-9.-]+\.js$/.test(worker)?worker:'不明';
  $('connection-diagnostic').textContent='接続診断：画面 1.4.5／バックグラウンド '+version(s.backgroundVersion)+'／補助 '+version(s.helperVersion)+'／一覧 '+(Array.isArray(s.profiles)?s.profiles.length+'件':typeof s.profiles)+'／ログイン情報 '+(typeof s.signedIn==='boolean'?String(s.signedIn):'なし')+'／接続先 '+(s.requestedNativeHost==='jp.osreadingguide.chatgpt.v2'?'v2':'旧または不明')+'／Chrome登録 '+version(registered?.version)+' ('+workerName+')';
  if(!Array.isArray(s.profiles)){
   $('account').textContent='ログイン状態の応答形式を確認できません。';
   throw Error('接続の応答にアカウント一覧がありません。下の「接続診断」の表示をお知らせください。再ログインや辞書削除は不要です。');
  }
  accountId=s.accountId||'';
  const profiles=s.profiles.map((p,index)=>({...p,label:'接続'+(index+1)}));
  const active=profiles.find(p=>p.active);
  $('account').textContent=s.signedIn?'Using ChatGPT plan：'+(active?.label||'')+' '+s.email:signingIn?'ChatGPTの認証手続き中です。完了後に接続状態を更新します。':'選択中の接続は未ログインです。';
  $('accounts').replaceChildren();
  for(const p of profiles){const o=new Option(p.label+'：'+(p.email||'本人確認未完了')+(p.signedIn?'':'（再ログインが必要）'),p.id);$('accounts').append(o);}
  if(accountId)$('accounts').value=accountId;
  const saved=await chrome.storage.local.get(['aiModel','planConfirmed','aiAccountId']);
  $('confirmed').checked=!!saved.planConfirmed&&saved.aiAccountId===accountId;
  if(withModels)model.replaceChildren();
  if(s.signedIn&&withModels){const r=await rpc('models',{accountId});for(const m of r.models){const o=new Option(m.name||m.slug,m.slug);model.append(o);}if([...model.options].some(o=>o.value===saved.aiModel))model.value=saved.aiModel;}
 }
 async function run(fn){busy(true);try{await fn();}catch(e){status.textContent=e.message;}finally{busy(false);}}
 async function signIn(action){
  // An already usable saved session needs a display refresh, not another browser login.
  if(action==='login'){
   const existing=await rpc('status');
   if(existing.signedIn){try{await refresh();status.textContent='保存済みのログインを確認しました。再ログインは不要です。';return;}catch(e){if(!/認証の有効期限|再ログイン|ログインし直|HTTP 400|HTTP 401/.test(e.message))throw e;}}
  }
  $('confirmed').checked=false;
  signingIn=true;
  try{await refresh({withModels:false});
  if(!$('account').textContent.startsWith('Using ChatGPT plan'))$('account').textContent='ChatGPTの認証手続き中です。完了後に接続状態を更新します。';
  status.textContent=action==='switch_account'?'公式画面で本来使いたいChatGPTアカウントとワークスペースを選んでください。既存の接続は認証成功まで維持します。':'公式ログイン画面で操作してください。最大4分待機します。';
  await rpc(action);await refresh();status.textContent='認証を検証して接続を切り替えました。この接続のクレジット利用OFFを確認し、モデルを選んで設定を保存してください。';}finally{signingIn=false;}
 }
 $('login').onclick=()=>run(()=>signIn('login'));
 $('switch-account').onclick=()=>run(()=>signIn('switch_account'));
 $('use-account').onclick=()=>run(async()=>{if(!$('accounts').value)throw Error('保存済みの接続を選んでください。');$('confirmed').checked=false;await rpc('select_account',{profileId:$('accounts').value});await refresh();status.textContent='保存済みの接続を選びました。表示されたアカウントとクレジット利用OFFを確認して設定を保存してください。未ログインならContinue with ChatGPTから再接続します。';});
 $('logout').onclick=()=>run(async()=>{const r=await rpc('logout');$('confirmed').checked=false;await refresh();status.textContent=r.revoked?'選択中の接続からログアウトしました。他の接続と辞書は残っています。':'端末からログアウトしましたが、遠隔での認証取消を確認できません。ChatGPT設定でも接続を解除してください。';});
 $('refresh').onclick=()=>run(async()=>{await refresh();status.textContent='接続状態を更新しました。';});
 $('settings').onsubmit=async e=>{e.preventDefault();await run(async()=>{
  const current=await rpc('status');if(!current.signedIn||current.accountId!==accountId)throw Error('アカウントが変更されました。「接続を再確認」で表示を更新してください。');
  if(!model.value||!$('confirmed').checked)throw Error('現在の接続のモデルを選び、プラン利用とクレジット利用OFFを確認してください。');
  await chrome.storage.local.set({aiModel:model.value,planConfirmed:true,aiAccountId:accountId});status.textContent='このChatGPT接続の設定を保存しました。教材から解説を生成できます。';
 });};
 async function refreshVisible(){
  if(document.visibilityState==='hidden')return;
  if(signingIn){try{await refresh({withModels:false});}catch{}return;}
  if(!busyCount)await run(refresh);
 }
 window.addEventListener('focus',refreshVisible);
 document.addEventListener('visibilitychange',refreshVisible);
 await run(refresh);
})();
