(() => {
  'use strict';
  if (globalThis.__OSRGLoaded) return;
  globalThis.__OSRGLoaded=true;
  const {entries:base,chapters}=OSRGData, C=OSRGCore;
  let entries=base, byId=new Map(base.map(e=>[e.id,e])), chapter=null, article=null;
  let history=[], rootView='guide', question='', selection='', contextText='', origin=null, pinned=false;
  let hoverTimer, closeTimer, scanTimer, lastPath='', disabled=false, custom=[];
  let editing=false,scanGeneration=0,formTerm='',lastDictionaryJump='';
  async function rpc(type,data={}){const result=await chrome.runtime.sendMessage({type,...data});if(!result?.ok)throw Error(result?.error||'拡張機能を再読み込みしてください。');return result;}
  async function refreshDictionary(){const data=await chrome.storage.local.get('custom');const next=data.custom||[];const all=merge(next);custom=next;entries=all;byId=new Map(all.map(e=>[e.id,e]));history=history.filter(h=>byId.has(h.id));removeMarks();scan();}
  const host=document.createElement('div'); host.id='osrg-host';
  const shadow=host.attachShadow({mode:'open'});
  const style=document.createElement('style');
  style.textContent=`
    :host{all:initial;color-scheme:light dark;font-family:system-ui,'Yu Gothic UI',sans-serif;font-size:14px;line-height:1.75;color:#253c3c}
    *{box-sizing:border-box} [hidden]{display:none!important}
    button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus,textarea:focus{outline:2px solid #278b80;outline-offset:2px}
    button{border:1px solid #d6e1df;background:#fff;color:#315854;border-radius:7px;padding:5px 10px;line-height:1.6}button:hover{background:#edf5f1}
    .dock{position:fixed;right:20px;bottom:18px;z-index:2147483646;display:flex;gap:7px;align-items:center}.dock button{box-shadow:0 3px 16px #162e2720;background:#234f49;color:#fff;border-color:#234f49;padding:8px 14px}
    .panel{position:fixed;width:min(430px,calc(100vw - 24px));max-height:calc(100vh - 100px);z-index:2147483647;border:1px solid #c7d7d1;background:#fbfdfb;border-radius:14px;box-shadow:0 14px 60px #142c3330;overflow:auto;overscroll-behavior:contain}
    header{position:sticky;top:0;z-index:1;background:#f2f7f3;border-bottom:1px solid #dce6df;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px}
    header span{font-size:12px;letter-spacing:.07em;color:#42665f}.body{padding:14px 20px 20px}h2{font-size:21px;line-height:1.5;margin:10px 0 12px;font-weight:650;color:inherit}h3{font-size:14px;margin:19px 0 8px}p,.detail{margin:8px 0 14px;white-space:pre-wrap;overflow-wrap:anywhere}.muted{font-size:12px;color:#60736e}.short{font-size:15px;line-height:1.9}
    nav{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:12px}nav button{border:0;padding:2px 4px;background:transparent;font-size:12px}.link{border:0;background:none;padding:0 2px;text-decoration:underline dotted;text-underline-offset:3px;color:#23766c;border-radius:3px;display:inline;font:inherit}
    .chips{display:flex;gap:6px;flex-wrap:wrap}.chips button{font-size:13px;text-align:left}.rule{border-top:1px solid #dce6df;margin-top:18px;padding-top:12px}.result{display:block;text-align:left;width:100%;margin:8px 0;padding:10px}.result small{display:block;color:#60736e;font-size:12px}
    label{display:block;margin-top:12px;font-size:13px}input,textarea{width:100%;border:1px solid #bccdc5;background:#fff;color:#243b35;border-radius:6px;padding:8px}textarea{min-height:100px;resize:vertical}.actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.notice{background:#eaf3ec;border-radius:8px;padding:10px;font-size:13px}.status{font-size:12px;white-space:pre-wrap}a{color:#287268}
    @media(prefers-color-scheme:dark){:host{color:#e4eee9}.panel{background:#202b29;border-color:#485c53}header{background:#263731;border-color:#485c53}header span,.muted,.result small{color:#b4c7bd}button{background:#273b33;color:#e2eee8;border-color:#4c6358}button:hover{background:#344c42}.link,a{color:#9ed4bf}input,textarea{background:#17221e;color:#e4eee9}.notice{background:#2d4237}.rule{border-color:#485c53}}
  `;
  const dock=document.createElement('div');dock.className='dock';
  const guideBtn=button('読書ガイド',()=>openRoot('guide',guideBtn));
  const askBtn=button('選択から解説を追加',()=>{formTerm=selection;openRoot('add',askBtn);});askBtn.hidden=true;
  dock.append(askBtn,guideBtn);
  const panel=document.createElement('section');panel.className='panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','OS読書ガイド');
  shadow.append(style,dock,panel); document.documentElement.append(host);
  function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function button(text,click,cls){const b=el('button',text,cls);b.type='button';b.addEventListener('click',click);return b;}
  function entryLink(id,label){const e=byId.get(id);return e?button(label||e.title,()=>openEntry(id,null,true),'link'):el('span',label||id);}
  function rich(parent,text){
    if(text.includes("```diagram")){OSRGDiagram.renderText(parent,text,(t,target=parent)=>rich(target,t));return;}
    const available=entries.filter(e=>e.id!==history.at(-1)?.id);
    function plain(target,part,kind){const matches=C.matcher(available,chapter?.number,{kind})(part);let pos=0;for(const m of matches){target.append(document.createTextNode(part.slice(pos,m.start)),entryLink(m.id,m.text));pos=m.end;}target.append(document.createTextNode(part.slice(pos)));}
    let pos=0;for(const m of text.matchAll(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]|`([^`]+)`/g)){plain(parent,text.slice(pos,m.index),'prose');if(m[3]){const code=el('code');plain(code,m[3],'code');parent.append(code);}else parent.append(entryLink(m[1],m[2]));pos=m.index+m[0].length;}plain(parent,text.slice(pos),'prose');
  }
  function clearTimers(){clearTimeout(hoverTimer);clearTimeout(closeTimer);}
  function close(restore=false){clearTimers();panel.hidden=true;pinned=false;history=[];if(restore&&origin?.isConnected)origin.focus({preventScroll:true});}
  function position(anchor){const r=anchor?.getBoundingClientRect();const width=Math.min(430,innerWidth-24);let left=r?Math.min(r.left,innerWidth-width-12):innerWidth-width-20;const height=Math.min(540,innerHeight-100);let top=r?(r.bottom+height+70<innerHeight?r.bottom+10:r.top-height-10):Math.min(100,innerHeight/5);left=Math.max(12,left);top=Math.max(12,top);panel.style.left=left+'px';panel.style.top=top+'px';panel.style.maxHeight=Math.max(120,innerHeight-top-70)+'px';}
  function remember(){if(history.length)history.at(-1).scroll=panel.scrollTop;}
  function openEntry(id,anchor,fromPanel=false){if(!byId.has(id))return;clearTimers();if(!fromPanel){history=[];rootView='guide';origin=anchor;position(anchor);}else{remember();pinned=true;}history=C.pushHistory(history,id);panel.hidden=false;render();if(fromPanel)panel.querySelector('h2')?.focus({preventScroll:true});}
  function openRoot(view,anchor){clearTimers();history=[];rootView=view;origin=anchor;pinned=true;position(null);panel.hidden=false;render();}
  function render(){
    editing=false;
    const active=shadow.activeElement;const oldFocus=panel.contains(active)?active.textContent:null;
    const scroll=history.at(-1)?.scroll||0;panel.replaceChildren();
    const head=el('header');head.append(el('span','OS READING GUIDE'),button('閉じる ×',()=>close(true)));panel.append(head);
    const body=el('div',undefined,'body');panel.append(body);
    const nav=el('nav');nav.setAttribute('aria-label','解説をたどった道順');nav.append(button('章のガイド',()=>{history=[];rootView='guide';render();}));
    if(rootView==='question')nav.append(button('質問',()=>{history=[];render();}));
    history.forEach((item,i)=>{nav.append(el('span','›'),button(byId.get(item.id).title,()=>{remember();history=history.slice(0,i+1);render();}));});body.append(nav);
    if(history.length){
      const item=history.at(-1),e=byId.get(item.id);
      body.append(button('← 戻る',()=>{history.pop();render();}));const title=el('h2',e.title);title.tabIndex=-1;body.append(title);
      const short=el('p',undefined,'short');rich(short,e.short);body.append(short);
      const more=button(item.expanded?'詳しい説明を閉じる':'詳しい説明を読む',()=>{item.expanded=!item.expanded;item.scroll=panel.scrollTop;render();});more.setAttribute('aria-expanded',String(item.expanded));body.append(more);
      if(item.expanded){const p=el('div',undefined,'detail');rich(p,e.detail);body.append(p);}
      if(e.prerequisites?.length){body.append(el('h3','ここから前提知識へ'));const chips=el('div',undefined,'chips');e.prerequisites.forEach(id=>chips.append(entryLink(id)));body.append(chips);}
      if(e.chapters)body.append(el('p','この意味を使う章：'+e.chapters.map(n=>String(n).padStart(2,'0')).join('・'),'muted'));
      const variants=entries.filter(other=>other.id!==e.id&&other.aliases.some(a=>e.aliases.includes(a)));
      if(variants.length){body.append(el('h3','同じ表現の別の意味'));const choices=el('div',undefined,'chips');variants.forEach(v=>choices.append(entryLink(v.id)));body.append(choices);}
      if(origin?.closest?.('a'))body.append(el('p','元のリンクは通常クリックで開きます。解説を固定するにはAlt＋クリック、またはこのパネル内をクリックしてください。','muted'));
      if(e.generated)body.append(el('p','AI生成・内容未確認'+(e.origin?.chapter?' ／ 生成時：'+e.origin.chapter:''),'muted'));
      const foot=el('div',undefined,'rule');foot.append(button('この解説を編集',()=>editEntry(e)));
      if(custom.some(x=>x.id===e.id))foot.append(button(base.some(x=>x.id===e.id)?'個人編集を解除':'この解説を削除',()=>confirmDelete(e)));
      if(chapter){const a=el('a',' 教材の原稿');a.href='https://github.com/nuta/operating-system-in-1000-lines/blob/main/website/ja/'+(chapter.number===0?'index':chapter.slug)+'.md';a.target='_blank';a.rel='noopener noreferrer';foot.append(a);}
      for(const source of (OSRGData.sources||[]).filter(s=>s.id!=='textbook'&&e.sources?.includes(s.id))){const p=el('p',undefined,'muted');const a=el('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);foot.append(p);}body.append(foot);
    }else if(rootView==='add'){renderAdd(body);}else if(rootView==='question'){renderQuestion(body);}else{renderGuide(body);}
    if(oldFocus){const target=[...panel.querySelectorAll('button')].find(b=>b.textContent===oldFocus)||panel.querySelector('h2');if(target){target.tabIndex=target.tagName==='H2'?-1:0;target.focus({preventScroll:true});}}
    panel.scrollTop=scroll;
  }
  function renderGuide(body){
    body.append(el('h2',chapter?String(chapter.number).padStart(2,'0')+' '+chapter.title:'読書ガイド'));
    if(chapter){body.append(el('p',chapter.summary,'short'),el('h3','この章の前提知識'));const chips=el('div',undefined,'chips');chapter.prerequisites.forEach(id=>chips.append(entryLink(id)));body.append(chips);}
    body.append(el('h3','用語・分からない表現を調べる'));const input=el('input');input.placeholder='例：4KB境界、static、なぜ終端を含めない？';input.setAttribute('aria-label','用語検索');body.append(input);const results=el('div');body.append(results);input.addEventListener('input',()=>showResults(results,input.value));
    body.append(el('p','本文・コードの点線にホバーで短い説明、クリックで固定。元のリンクは通常クリックで移動、Alt＋クリックで解説を開きます。解説の「戻る」で復帰できます。','muted'));
    const actions=el('div',undefined,'actions');actions.append(button('解説辞書を開く',()=>rpc('dictionary').catch(e=>status(e.message))),button('解説を追加',()=>{formTerm=selection;openRoot('add',guideBtn);}),button('AI設定',()=>rpc('settings').catch(e=>status(e.message))),button(disabled?'下線を有効にする':'下線を一時的に消す',()=>{disabled=!disabled;removeMarks();scan();render();}));body.append(actions);
    body.append(el('h3','個人データ'));const personal=el('div',undefined,'actions');personal.append(button('JSONを書き出す',exportPersonal),button('JSONを読み込む',importPersonal),button('従来の質問メモ',()=>{question=selection;openRoot('question',guideBtn);}));body.append(personal,el('p','既存の質問・個人辞書を保持しています。AI生成時だけ入力文字列と周囲の文脈をOpenAIへ送ります。','muted'));
    const status=el('p','', 'status');status.id='status';body.append(status);
  }
  function showResults(target,q){target.replaceChildren();const found=C.search(entries,q,chapter?.number);if(!found.length&&q.trim())target.append(el('p','対応する保存済み解説が見つかりません。「解説を追加」でこの表現の解説を新設できます。','muted'));for(const e of found){const b=button(e.title,()=>openEntry(e.id,null,true),'result');b.append(el('small',e.short.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,'$2')));target.append(b);}}
  function renderQuestion(body){
    body.append(el('h2','この表現を質問する'),el('p','保存済み解説から関連する項目を探します。未知の質問への新しい回答は生成しません。回答がない場合も、文脈付きの質問を手元に残せます。','notice'));
    const label=el('label','選択した表現・質問');const q=el('textarea');q.value=question;label.append(q);body.append(label);const results=el('div');
    const actions=el('div',undefined,'actions');actions.append(button('関連解説を探す',()=>{question=q.value;showResults(results,question);}),button('質問文をコピー',async()=>{question=q.value;await copy(promptText());}),button('質問を保存',async()=>{question=q.value;try{const {questions=[]}=await chrome.storage.local.get('questions');questions.push({question,selection,context:contextText,url:location.href,chapter:chapter?.title,created:new Date().toISOString()});await chrome.storage.local.set({questions});status('質問を保存しました。');}catch{status('保存できませんでした。JSONの書き出しやコピーをお試しください。');}}));body.append(actions,results);showResults(results,question);
    body.append(el('h3','質問に添える文脈'),el('p',contextText||'本文を選択すると、周囲の段落がここに入ります。','muted'));const preview=el('details');preview.append(el('summary','コピーされる質問文を見る'));const text=el('textarea');text.readOnly=true;text.value=promptText();q.addEventListener('input',()=>{question=q.value;text.value=promptText();});preview.append(text);body.append(preview);
    const s=el('p','','status');s.id='status';s.setAttribute('role','status');body.append(s);
  }
  function promptText(){return `「1000行でOSを作ってみよう」${chapter?.title||''}を読む初学者です。\nURL: ${location.href}\n質問: ${question}\n選択した表現: ${selection}\n周囲の本文: ${contextText}\n定義に加え、この文脈での役割と必要な前提知識を、日本語で具体例を使って説明してください。教材の簡略化と一般的な実装を区別してください。`;}
  function status(text){let s=shadow.getElementById('status');if(!s){s=el('p','','status');s.id='status';panel.append(s);}s.textContent=text;}
  async function copy(text){try{await navigator.clipboard.writeText(text);status('質問文をコピーしました。');}catch{status('自動コピーできませんでした。「コピーされる質問文を見る」を開き、手動でコピーしてください。');}}
  async function exportPersonal(){try{const data=await chrome.storage.local.get(['custom','questions']);const blob=new Blob([JSON.stringify({version:1,custom:data.custom||[],questions:data.questions||[]},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='os-reading-guide-personal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('個人データを書き出しました。');}catch(e){status('書き出しに失敗しました: '+e.message);}}
  function merge(overrides){return C.merge(base,overrides);}
  function importPersonal(){const input=el('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>2e6)throw Error('2MB以下のJSONを選んでください');const d=JSON.parse(await file.text());const result=await rpc('import',{data:d});await refreshDictionary();status('個人データを読み込みました。既存データを維持しました。競合のため保留：'+result.skipped+'件');}catch(e){status('読み込めません: '+e.message);}};input.click();}
  function generationContext(term){
    const all=article?.innerText||'';const index=all.indexOf(term);const around=index<0?all.slice(0,4000):all.slice(Math.max(0,index-2000),index+term.length+5000);
    return {url:location.href,chapter:chapter?String(chapter.number).padStart(2,'0')+' '+chapter.title:'',heading:article?.querySelector('h1')?.textContent||document.title,excerpt:(term===selection&&contextText?contextText+'\n\n':'')+around};
  }
  function showDuplicates(target,term){target.replaceChildren();const duplicates=C.duplicates(entries,term);if(duplicates.length){target.append(el('p','登録済みです。上書き・重複生成は行いません。','notice'));duplicates.forEach(e=>target.append(button(e.title,()=>openEntry(e.id,null,true),'result')));}return duplicates;}
  function renderAdd(body){
    body.append(el('h2','解説を追加'),el('p','語句・記号・コード片・分かりにくい表現を入力してください。周囲の本文やコードを使って、解説を生成して保存します。','short'));
    const label=el('label','解説する文字列');const input=el('input');input.value=formTerm;input.maxLength=200;input.placeholder='例：--sp、__attribute__((packed))';label.append(input);body.append(label);
    const duplicates=el('div');body.append(duplicates);const preview=el('details');preview.append(el('summary','生成に送る文脈を確認'));const context=el('p',generationContext(input.value.trim()).excerpt,'muted');preview.append(context);body.append(preview);
    body.append(el('p','Using ChatGPT plan：生成時に文字列・章名・URL・周辺文脈・関連解説をOpenAIへ送信し、ChatGPTの対象利用枠を使います。有料APIへの切替はありません。保存済みの解説を読むだけなら通信しません。','muted'));
    const actions=el('div',undefined,'actions');const generate=button('解説を生成・追加',async()=>{
      const term=input.value.trim();formTerm=term;if(!term){status('解説する文字列を入力してください。');return;}if(showDuplicates(duplicates,term).length)return;
      generate.disabled=true;input.disabled=true;status('解説を生成しています… 保存は生成完了後に行います。');const pageAtStart=location.pathname;
      try{const result=await rpc('generate',{term,context:generationContext(term),chapter:chapter?.number});await refreshDictionary();if(pageAtStart!==location.pathname||!body.isConnected)return;if(result.existing){showDuplicates(duplicates,term);status('別の操作で登録済みになりました。重複は追加していません。');}else{openEntry(result.id,null,true);status('解説を保存しました。本文・コードへ反映しました。');}}
      catch(e){if(body.isConnected)status(e.message);}finally{generate.disabled=false;input.disabled=false;}
    });actions.append(generate,button('AI設定',()=>rpc('settings').catch(e=>status(e.message))),button('手動で追加',()=>{selection=input.value;editEntry();}));body.append(actions);
    input.addEventListener('input',()=>{formTerm=input.value;showDuplicates(duplicates,formTerm.trim());context.textContent=generationContext(formTerm.trim()).excerpt;});showDuplicates(duplicates,input.value.trim());
    const s=el('p','','status');s.id='status';s.setAttribute('role','status');body.append(s);
  }
  function confirmDelete(e){const body=panel.querySelector('.body');editing=true;body.replaceChildren(el('h2','個人データの削除'),el('p',base.some(x=>x.id===e.id)?'この個人編集を解除し、同じIDの初期解説へ戻します。':'「'+e.title+'」を個人辞書から削除します。他の解説の文章は残し、この項目への明示リンクだけを解除します。'));body.append(button('キャンセル',render),button('削除を実行',async()=>{try{const result=await rpc('delete',{id:e.id,expected:JSON.stringify(e)});await refreshDictionary();history=[];rootView='guide';render();status(result.restored?'初期解説へ戻しました。':'個人解説を削除しました。');}catch(err){status(err.message);}}));}
  function editEntry(e){
    editing=true;
    const body=panel.querySelector('.body');body.replaceChildren(button('← キャンセル',render),el('h2',e?'解説を編集':'解説を追加'));
    const fields={};for(const [key,label,value] of [['title','表示名',e?.title||''],['aliases','本文で下線にする語句（改行で区切る）',e?.aliases.join('\n')||selection],['short','短い説明',e?.short||''],['detail','詳しい説明（[[id|表示名]]で他の解説へリンク）',e?.detail||'']]){const l=el('label',label);const input=el(key==='title'?'input':'textarea');input.value=value;l.append(input);fields[key]=input;body.append(l);}
    body.append(button('このChromeに保存',async()=>{try{const item={...(e||{}),id:e?.id||'personal-'+crypto.randomUUID(),title:fields.title.value.trim(),aliases:fields.aliases.value.split('\n').map(s=>s.trim()).filter(Boolean),short:fields.short.value.trim(),detail:fields.detail.value.trim(),prerequisites:e?.prerequisites||[]};const result=await rpc('save',{entry:item,expected:e?JSON.stringify(e):null});if(result.existing){status('この表現は登録済みです。既存の解説から編集してください。');return;}await refreshDictionary();history=[{id:item.id,expanded:true,scroll:0}];render();}catch(err){status('保存できません: '+err.message);}}));const s=el('p','','status');s.id='status';body.append(s);
  }
  function removeMarks(){scanGeneration++;observer.disconnect();OSRGAnnotations.clear(article);observe();}
  function jumpFromDictionary(){const key=location.pathname+location.hash;if(!location.hash.startsWith('#osrg-entry=')||key===lastDictionaryJump)return;const id=location.hash.slice(12),entry=byId.get(id);if(!entry)return;const marks=[...article.querySelectorAll('.osrg-term')];const mark=marks.find(n=>n.dataset.osrgId===id)||marks.find(n=>entry.aliases.includes(n.dataset.osrgText));if(mark){lastDictionaryJump=key;mark.scrollIntoView({block:'center'});pinned=true;openEntry(id,mark);}}
  addEventListener('hashchange',()=>{lastDictionaryJump='';jumpFromDictionary();});
  function scan(){
    const path=location.pathname.replace(/\/$/,'').replace(/\.html$/,'');
    const next=chapters.find(c=>path==='/ja'+(c.number?'/'+c.slug:''));
    if(path!==lastPath){lastPath=path;close();selection='';contextText='';askBtn.hidden=true;removeMarks();}
    chapter=next||null;host.hidden=!chapter;if(!chapter)return;
    article=document.querySelector('.vp-doc');if(!article||disabled)return;
    observer.disconnect();article.dataset.osrgReady='false';OSRGAnnotations.clear(article);const runs=OSRGAnnotations.collect(article);
    const prose=C.matcher(entries,chapter.number),code=C.matcher(entries,chapter.number,{kind:'code'});
    const token=++scanGeneration,initialArticle=article,initialPath=location.pathname;let index=0;
    function batch(){if(token!==scanGeneration||disabled)return;if(location.pathname!==initialPath||!initialArticle.isConnected){observe();scan();return;}const end=Math.min(index+12,runs.length);for(;index<end;index++){const nodes=runs[index];const isCode=nodes[0]?.parentElement?.closest('pre,code,kbd');OSRGAnnotations.annotateRun(nodes,isCode?code:prose);}if(index<runs.length)requestAnimationFrame(batch);else{article.dataset.osrgReady='true';observe();jumpFromDictionary();}}
    batch();
  }
  document.addEventListener('pointerover',event=>{const term=event.target.closest?.('.osrg-term');if(!term||pinned)return;clearTimers();hoverTimer=setTimeout(()=>openEntry(term.dataset.osrgId,term),260);});
  document.addEventListener('pointerout',event=>{if(event.target.closest?.('.osrg-term')&&!pinned){clearTimeout(hoverTimer);closeTimer=setTimeout(()=>{if(!pinned)close();},500);}});
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));panel.addEventListener('pointerleave',()=>{if(!pinned)closeTimer=setTimeout(()=>close(),500);});
  panel.addEventListener('pointerdown',()=>{pinned=true;clearTimers();});
  document.addEventListener('click',event=>{const term=event.target.closest?.('.osrg-term');if(term){if(getSelection()?.toString().trim())return;if(term.closest('a')){if(!event.altKey)return;event.preventDefault();event.stopPropagation();}pinned=true;openEntry(term.dataset.osrgId,term);}else if(!event.composedPath().includes(host)&&!panel.hidden)close();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}if(event.altKey&&event.shiftKey&&event.code==='KeyQ'&&chapter){event.preventDefault();captureSelection();formTerm=selection;openRoot('add',guideBtn);}const term=event.target.closest?.('.osrg-term')||(event.altKey?event.target.closest?.('a')?.querySelector('.osrg-term'):null);if(term&&(event.key==='Enter'||event.key===' ')){event.preventDefault();pinned=true;openEntry(term.dataset.osrgId,term);panel.querySelector('button')?.focus();}});
  function captureSelection(){const shadowSelection=shadow.getSelection?.();const sel=shadowSelection&&!shadowSelection.isCollapsed?shadowSelection:getSelection();if(!sel||sel.isCollapsed)return;const inArticle=article?.contains(sel.anchorNode)&&article.contains(sel.focusNode);const inPanel=panel.contains(sel.anchorNode)&&panel.contains(sel.focusNode);if(!inArticle&&!inPanel)return;selection=sel.toString().trim().slice(0,3000);const parent=sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement;contextText=(parent.closest('p,li,td,pre')||parent).textContent.slice(0,7000);askBtn.hidden=!selection;}
  document.addEventListener('pointerup',captureSelection);document.addEventListener('keyup',event=>{if(event.key==='Shift')captureSelection();});
  addEventListener('resize',()=>{if(!panel.hidden)position(null);});
  addEventListener('popstate',()=>setTimeout(scan,50));
  const observer=new MutationObserver(records=>{if(!records.some(r=>r.target!==host&&!host.contains(r.target)&&!(r.target.parentElement?.closest('.osrg-term'))&&!(r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===1&&n.classList?.contains('osrg-term')))))return;clearTimeout(scanTimer);scanTimer=setTimeout(scan,90);});
  function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
  observe();
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.custom)refreshDictionary().then(()=>{if(!panel.hidden&&!editing&&rootView!=='add')render();}).catch(e=>status('個人辞書を読み込めません: '+e.message));});
  chrome.storage.local.get('custom').then(data=>{try{custom=data.custom||[];entries=merge(custom);byId=new Map(entries.map(e=>[e.id,e]));}catch(err){custom=[];console.warn('OS読書ガイド: 保存データが不正のため初期辞書を使用',err);}scan();}).catch(()=>scan());
})();
