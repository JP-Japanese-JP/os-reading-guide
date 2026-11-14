importScripts('data.js','core.js','ai.js');
const C=OSRGCore,base=OSRGData.entries;
let queue=Promise.resolve();const inFlight=new Map();
const transaction=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;};
async function state(){const data=await chrome.storage.local.get('custom');return {custom:data.custom||[],all:C.merge(base,data.custom||[])};}
const stamp=()=>new Date().toISOString();
function native(action,payload={}){return new Promise((resolve,reject)=>{
  const port=chrome.runtime.connectNative('jp.osreadingguide.chatgpt.v2');
  const timer=setTimeout(()=>{done=true;port.disconnect();reject(Error('補助プログラムの応答がありません。AI設定を確認してください。'));},300000);
  let done=false;port.onMessage.addListener(result=>{done=true;clearTimeout(timer);port.disconnect();result.ok?resolve(result):reject(Error(result.error||'補助プログラムに接続できません。'));});
  port.onDisconnect.addListener(()=>{
    // Read lastError inside this callback, even after an intentional disconnect.
    const reason=chrome.runtime.lastError?.message||'';
    clearTimeout(timer);if(done)return;done=true;
    let help='Windows補助プログラムに接続できません。';
    if(/not found/i.test(reason))help='Windows補助プログラムの登録が見つかりません。';
    else if(/forbidden/i.test(reason))help='この拡張IDはWindows補助プログラムで許可されていません。';
    reject(Error(help+' AI設定の「接続の修復」を確認し、setup-helper.cmdで再登録してください。拡張ID：'+chrome.runtime.id+(reason?'\nChrome：'+reason:'')));
  });
  port.postMessage({action,...payload});
});}
async function generate(message){
  const term=String(message.term||'').trim();if(!term||term.length>200)throw Error('解説する文字列を1〜200文字で入力してください。');
  const existing=C.duplicates((await state()).all,term);if(existing.length)return {existing:existing.map(e=>e.id)};
  if(inFlight.has(term))return inFlight.get(term);
  const task=(async()=>{
    const {aiModel='',planConfirmed=false,aiAccountId=''}=await chrome.storage.local.get(['aiModel','planConfirmed','aiAccountId']);
    if(!planConfirmed||!aiAccountId)throw Error('AI設定で現在のChatGPTアカウントを確認し、プラン利用とクレジット利用OFFを確認して設定を保存してください。');
    const context={url:String(message.context?.url||'').slice(0,600),chapter:String(message.context?.chapter||'').slice(0,200),heading:String(message.context?.heading||'').slice(0,300),excerpt:String(message.context?.excerpt||'').slice(0,12000)};
    const {all}=await state();const known=C.search(all,term+' '+context.excerpt,Number(message.chapter)).map(e=>({term:e.title,aliases:e.aliases,definition:e.short}));
    const result=await native('generate',{accountId:aiAccountId,model:aiModel,term,context,known});
    const generated=OSRGAI.parse(result.response);
    return transaction(async()=>{
      // Reread only when committing: edits and additions from other tabs survive a slow API call.
      const {custom,all}=await state();const duplicate=C.duplicates(all,term);if(duplicate.length)return {existing:duplicate.map(e=>e.id)};
      const additions=[],prerequisites=[];const created=stamp();
      for(const p of generated.prerequisites){if(p.term.trim()===term)continue;const found=C.duplicates([...all,...additions],p.term)[0];if(found){prerequisites.push(found.id);continue;}const id='ai-'+crypto.randomUUID();additions.push({id,title:p.term.trim(),aliases:[p.term.trim()],short:p.short,detail:p.detail,prerequisites:[],generated:true,model:aiModel,createdAt:created,updatedAt:created,origin:context});prerequisites.push(id);}
      const entry={id:'ai-'+crypto.randomUUID(),title:generated.title,aliases:[term],short:generated.short,detail:generated.detail+(generated.scopeNote?'\n\nこの文脈での意味：'+generated.scopeNote:''),prerequisites:[...new Set(prerequisites)],generated:true,model:aiModel,createdAt:created,updatedAt:created,origin:context};
      additions.push(entry);const next=[...custom,...additions];C.merge(base,next);await chrome.storage.local.set({custom:next});return {id:entry.id,added:additions.length};
    });
  })();inFlight.set(term,task);try{return await task;}finally{inFlight.delete(term);}
}
async function handle(message,sender){
  if(sender.id!==chrome.runtime.id)throw Error('許可されていない呼び出しです。');
  const own=sender.url?.startsWith(chrome.runtime.getURL(''));
  const textbook=sender.url?.startsWith('https://operating-system-in-1000-lines.vercel.app/ja');
  if(!own&&!textbook)throw Error('教材ページから操作してください。');
  if(message.type==='account'){
    if(sender.url!==chrome.runtime.getURL('options.html')||!['status','login','logout','models','switch_account','select_account'].includes(message.action))throw Error('AI設定から操作してください。');
    if(['login','logout','switch_account','select_account'].includes(message.action))await chrome.storage.local.set({planConfirmed:false,aiAccountId:''});
    return native(message.action,{...(message.action==='select_account'?{profileId:message.profileId}:{}),...(message.action==='models'?{accountId:message.accountId}: {})});
  }
  if(message.type==='settings'){await chrome.runtime.openOptionsPage();return {};}
  if(message.type==='dictionary'){await chrome.tabs.create({url:chrome.runtime.getURL('dictionary.html')});return {};}
  if(message.type==='generate')return generate(message);
  if(message.type==='save')return transaction(async()=>{
    const {custom,all}=await state();const entry=message.entry;const old=all.find(e=>e.id===entry.id);
    if(old&&JSON.stringify(old)!==message.expected)throw Error('別の画面で更新されました。解説を開き直して編集してください。');
    const duplicateAliases=entry.aliases.filter(a=>!old?.aliases.includes(a)).flatMap(a=>C.duplicates(all.filter(x=>x.id!==entry.id),a));
    if(duplicateAliases.length)return {existing:[...new Set(duplicateAliases.map(e=>e.id))]};
    const next=custom.filter(e=>e.id!==entry.id).concat({...entry,updatedAt:stamp()});C.merge(base,next);await chrome.storage.local.set({custom:next});return {id:entry.id};
  });
  if(message.type==='delete')return transaction(async()=>{
    const {custom,all}=await state();const entry=custom.find(e=>e.id===message.id);if(!entry)throw Error('個人解説が見つかりません。');
    if(JSON.stringify(entry)!==message.expected)throw Error('別の画面で更新されました。開き直してください。');
    const original=base.find(e=>e.id===message.id);const next=custom.filter(e=>e.id!==message.id);
    if(!original){for(const e of all){if(e.id===message.id)continue;const ref=C.refs(e.short+e.detail).includes(message.id)||(e.prerequisites||[]).includes(message.id);if(!ref)continue;
      const updated={...e,prerequisites:(e.prerequisites||[]).filter(id=>id!==message.id)};for(const k of ['short','detail'])updated[k]=e[k].replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,(full,id,label)=>id===message.id?(label||entry.title):full);const at=next.findIndex(x=>x.id===e.id);if(at>=0)next[at]=updated;else next.push(updated);
    }}C.merge(base,next);await chrome.storage.local.set({custom:next});return {restored:!!original};
  });
  if(message.type==='import')return transaction(async()=>{
    const d=message.data;if(d.version!==1||!Array.isArray(d.custom)||!Array.isArray(d.questions)||JSON.stringify(d).length>2000000)throw Error('個人データの形式が不正です。');
    const {custom,all}=await state();const next=[...custom];let skipped=0;
    // Import is a merge. Conflicting data never silently replaces the user's existing edits.
    for(const e of d.custom){const old=next.find(x=>x.id===e.id);if(old){if(JSON.stringify(old)!==JSON.stringify(e))skipped++;continue;}if(!base.some(x=>x.id===e.id)&&e.aliases?.some(a=>C.duplicates([...all,...next],a).length)){skipped++;continue;}next.push(e);}
    C.merge(base,next);const {questions=[]}=await chrome.storage.local.get('questions');const qs=[...new Map([...questions,...d.questions].map(q=>[JSON.stringify(q),q])).values()];await chrome.storage.local.set({custom:next,questions:qs});return {skipped};
  });
  throw Error('未対応の操作です。');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{handle(message,sender).then(data=>reply({ok:true,...data,backgroundVersion:'1.4.5',requestedNativeHost:'jp.osreadingguide.chatgpt.v2'}),err=>reply({ok:false,error:err.message}));return true;});
chrome.action?.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('dictionary.html')}));
