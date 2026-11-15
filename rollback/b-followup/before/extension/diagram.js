/* Bounded declarative diagrams. Labels are text, never HTML, code or URLs. */
(()=>{
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const str=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
  const arr=(x,n)=>Array.isArray(x)&&x.length>0&&x.length<=n;
  const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
  function requireValue(ok,message){if(!ok)throw Error(message);}
  function keys(x,allowed){requireValue(object(x)&&Object.keys(x).every(k=>allowed.includes(k)),'未対応の図プロパティがあります');}
  function parse(source){
    let d;try{d=JSON.parse(source);}catch{throw Error('図のJSONを確認してください');}
    requireValue(object(d)&&str(d.title,200),'図のtitleは1〜200文字で指定してください');
    const common=['mode','title','note'];if(d.note!==undefined)requireValue(str(d.note,600),'図のnoteは1〜600文字です');
    const fields={flow:['rows'],memory:['rows'],table:['columns','rows'],bits:['fields'],layout:['start','unit','segments','marks'],map:['columns','nodes','edges'],sequence:['lanes','steps']};
    requireValue(Object.hasOwn(fields,d.mode),'未対応の図のmodeです');keys(d,[...common,...fields[d.mode]]);
    if(['flow','memory'].includes(d.mode))requireValue(arr(d.rows,12)&&d.rows.every(x=>str(x,80)),'図のrowsは1〜12行、各行1〜80文字です');
    if(d.mode==='table'){
      requireValue(arr(d.columns,4)&&d.columns.every(x=>str(x,50)),'表のcolumnsは1〜4列です');
      requireValue(arr(d.rows,12)&&d.rows.every(r=>Array.isArray(r)&&r.length===d.columns.length&&r.every(x=>str(x,200))),'表のrowsは1〜12行、各セル1〜200文字で列数を揃えてください');
    }
    if(d.mode==='bits'){
      requireValue(arr(d.fields,16),'ビット欄は1〜16個です');
      for(const f of d.fields){keys(f,['label','bits','value']);requireValue(str(f.label,40)&&integer(f.bits,1,64)&&(f.value===undefined||str(f.value,80)),'ビット欄のlabel/bits/valueを確認してください');}
      requireValue(d.fields.reduce((n,f)=>n+f.bits,0)<=64,'合計ビット数は64以下です');
    }
    if(d.mode==='layout'){
      requireValue(integer(d.start,0,2**40)&&str(d.unit,20)&&arr(d.segments,12),'配置のstart/unit/segmentsを確認してください');
      for(const s of d.segments){keys(s,['label','size']);requireValue(str(s.label,160)&&integer(s.size,1,2**36),'領域のlabel/sizeを確認してください');}
      const size=d.segments.reduce((n,s)=>n+s.size,0);requireValue(Number.isSafeInteger(d.start+size),'配置の範囲が大きすぎます');
      if(d.marks!==undefined){requireValue(Array.isArray(d.marks)&&d.marks.length<=8,'境界は8個までです');for(const m of d.marks){keys(m,['offset','label']);requireValue(integer(m.offset,0,size)&&str(m.label,120),'境界のoffset/labelを確認してください');}}
    }
    if(d.mode==='map'){
      requireValue(arr(d.columns,3)&&d.columns.every(x=>str(x,50))&&arr(d.nodes,18)&&Array.isArray(d.edges)&&d.edges.length<=24,'対応図のcolumns/nodes/edgesを確認してください');
      const ids=new Set(),positions=new Set();for(const n of d.nodes){keys(n,['id','label','column','row']);requireValue(str(n.id,40)&&/^[a-z0-9-]+$/.test(n.id)&&!ids.has(n.id)&&str(n.label,120)&&integer(n.column,0,d.columns.length-1)&&integer(n.row,0,5),'ノードのID/位置/ラベルが不正です');const pos=n.column+':'+n.row;requireValue(!positions.has(pos),'ノードの位置が重複しています');ids.add(n.id);positions.add(pos);}
      for(const e of d.edges){keys(e,['from','to','label']);requireValue(ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to&&str(e.label,24),'矢印の参照先/ラベルが不正です');}
    }
    if(d.mode==='sequence'){
      requireValue(arr(d.lanes,4)&&d.lanes.every(x=>str(x,50))&&arr(d.steps,12),'時系列のlanes/stepsを確認してください');
      for(const s of d.steps){keys(s,['from','to','label']);requireValue(integer(s.from,0,d.lanes.length-1)&&integer(s.to,0,d.lanes.length-1)&&str(s.label,120),'時系列のfrom/to/labelを確認してください');}
    }
    return d;
  }
  // Both closed and unclosed fences are detected, including a malformed opening line.
  function blocks(text){
    const result=[];let at=0;
    while((at=text.indexOf('```diagram',at))!==-1){const openEnd=text.indexOf('\n',at),close=openEnd<0?-1:text.indexOf('```',openEnd+1);if(openEnd<0||close<0){result.push({start:at,end:text.length,error:'図の終端 ``` がありません',source:text.slice(at)});break;}const opening=text.slice(at,openEnd).trim();result.push({start:at,end:close+3,source:text.slice(openEnd+1,close),...(opening!=='```diagram'?{error:'開始行は ```diagram のみにしてください'}:{})});at=close+3;}
    return result;
  }
  function validateText(text,label='詳しい説明'){
    requireValue(typeof text==='string','説明は文字列で指定してください');const list=blocks(text);
    for(let i=0;i<list.length;i++){const b=list[i];try{if(b.error)throw Error(b.error);parse(b.source);}catch(e){throw Error(`${label}の図${i+1}（${text.slice(0,b.start).split('\n').length}行目）：${e.message}。文章は編集欄に残っています。`);}}
    return list.length;
  }
  function validateEntry(e){for(const k of ['short','detail'])validateText(e[k],(e.title||e.id||'解説')+' / '+k);}
  function hasDiagram(text){return blocks(text).some(b=>{try{if(b.error)return false;parse(b.source);return true;}catch{return false;}});}
  function wrapLabel(label,width=18){const lines=[];for(const paragraph of label.split('\n')){let line='';for(const token of paragraph.match(/[A-Za-z0-9_]+|[^]/gu)||[]){const chars=Array.from(token);if(Array.from(line).length+chars.length>width&&line){lines.push(line);line='';}while(chars.length>width)lines.push(chars.splice(0,width).join(''));line+=chars.join('');}lines.push(line);}return lines;}
  // Japanese glyphs are wider than Latin letters; keep addresses/identifiers together.
  function wrapVisual(label,width){const weight=c=>/^[\x20-\x7e]$/.test(c)?.55:1;const measure=s=>Array.from(s).reduce((n,c)=>n+weight(c),0),lines=[];for(const paragraph of label.split('\n')){let line='';for(const token of paragraph.match(/[A-Za-z0-9_]+|[^]/gu)||[]){if(measure(line+token)>width&&line){lines.push(line);line='';}for(const c of token){if(measure(line+c)>width&&line){lines.push(line);line='';}line+=c;}}lines.push(line);}return lines;}
  const css=`.osrg-diagram{--dg-bg:#f4f8f5;--dg-ink:#153e33;--dg-line:#527b69;--dg-soft:#e1ece5;--dg-accent:#965317;margin:20px 0;padding:12px;border:1px solid var(--dg-line);border-radius:9px;background:var(--dg-bg);color:var(--dg-ink);white-space:normal;font:14px/1.65 system-ui,'Yu Gothic UI',sans-serif}.osrg-diagram *{box-sizing:border-box}.osrg-diagram figcaption{font-weight:700;font-size:15px;margin-bottom:10px}.osrg-diagram .dg-scroll{max-width:100%;overflow:auto;overscroll-behavior:contain;border-radius:4px}.osrg-diagram .dg-scroll:focus-visible{outline:2px solid var(--dg-accent);outline-offset:2px}.osrg-diagram svg{display:block;color:var(--dg-ink)}.osrg-diagram .dg-box{fill:var(--dg-soft);stroke:var(--dg-line)}.osrg-diagram .dg-line{stroke:var(--dg-line);stroke-width:1.8;fill:none}.osrg-diagram .dg-ink{fill:var(--dg-ink)}.osrg-diagram .dg-paper{fill:var(--dg-bg)}.osrg-diagram table{border-collapse:collapse;width:100%;min-width:310px;font:inherit;color:inherit}.osrg-diagram th,.osrg-diagram td{border:1px solid var(--dg-line);padding:8px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;min-width:65px}.osrg-diagram th{background:var(--dg-soft)}.osrg-diagram .dg-note{font-size:12px;margin:10px 0;white-space:pre-wrap}.osrg-diagram .dg-bits{display:flex;align-items:stretch;width:max-content;min-width:100%}.osrg-diagram .dg-bit{border:1px solid var(--dg-line);padding:8px;text-align:center;min-width:40px;overflow-wrap:anywhere;background:var(--dg-soft)}.osrg-diagram .dg-bit small{display:block}.osrg-diagram .dg-layout{display:flex;gap:12px;align-items:flex-start}.osrg-diagram .dg-band{width:52px;flex:none;border:1px solid var(--dg-line);height:300px;display:flex;flex-direction:column}.osrg-diagram .dg-segment{border-bottom:1px solid var(--dg-bg);min-height:1px;color:#fff;text-align:center;overflow:hidden;font-weight:bold}.osrg-diagram .dg-legend{min-width:0;flex:1}.osrg-diagram .dg-legend ol{margin:0;padding-left:22px}.osrg-diagram .dg-legend li{margin-bottom:12px;white-space:pre-wrap;overflow-wrap:anywhere}.osrg-diagram details{margin-top:12px}.osrg-diagram summary{cursor:pointer}.osrg-diagram pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(prefers-color-scheme:dark){.osrg-diagram{--dg-bg:#1e3028;--dg-ink:#e0f0e5;--dg-line:#94b8a5;--dg-soft:#304e3e;--dg-accent:#ffd099}}`;
  function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function sv(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
  function textAt(svg,label,x,y,width=18,anchor='start',fontSize=15,wrap=wrapLabel){const t=sv('text',{class:'dg-ink','font-size':fontSize,'text-anchor':anchor});wrap(label,width).forEach((line,n)=>{const s=sv('tspan',{x,y:y+n*20});s.textContent=line;t.append(s);});svg.append(t);}
  let serial=0;
  function canvas(fig,w,h,d){const wrap=el('div',undefined,'dg-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',d.title+'（横に広い図は左右にスクロール）');const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':description(d).join('。')});svg.style.maxWidth='none';const markerId='osrg-arrow-'+(++serial);const defs=sv('defs'),marker=sv('marker',{id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(sv('path',{d:'M 0 0 L 10 5 L 0 10 z',class:'dg-ink'}));defs.append(marker);svg.append(defs);wrap.append(svg);fig.append(wrap);return {svg,arrow:'url(#'+markerId+')'};}
  function description(d){
    if(['flow','memory'].includes(d.mode))return [d.title,...d.rows.map((r,i)=>d.mode==='flow'?`${i+1}. ${r}`:r)];
    if(d.mode==='table')return [d.title,...d.rows.map(r=>r.map((v,i)=>d.columns[i]+'：'+v).join('、'))];
    if(d.mode==='bits'){let top=d.fields.reduce((n,f)=>n+f.bits,0)-1;return [d.title,...d.fields.map(f=>{const s=`ビット${top}〜${top-f.bits+1}：${f.label}${f.value?' = '+f.value:''}`;top-=f.bits;return s;})];}
    if(d.mode==='layout'){let pos=d.start;return [d.title,...d.segments.map(s=>{const line=`0x${pos.toString(16)}〜0x${(pos+s.size-1).toString(16)}：${s.label}（${s.size}${d.unit}）`;pos+=s.size;return line;}),...(d.marks||[]).map(m=>`境界0x${(d.start+m.offset).toString(16)}：${m.label}`)];}
    if(d.mode==='map')return [d.title,...d.nodes.map(n=>d.columns[n.column]+'：'+n.label),...d.edges.map(e=>`${d.nodes.find(n=>n.id===e.from).label} → ${d.nodes.find(n=>n.id===e.to).label}：${e.label}`)];
    return [d.title,...d.steps.map((s,i)=>`${i+1}. ${d.lanes[s.from]} → ${d.lanes[s.to]}：${s.label}`)];
  }
  function draw(fig,d){
    if(['flow','memory'].includes(d.mode)){
      const sizes=d.rows.map(r=>Math.max(58,wrapLabel(r).length*20+22));const {svg}=canvas(fig,340,sizes.reduce((n,h)=>n+h+28,0),d);svg.style.width='100%';svg.style.height='auto';svg.style.maxWidth='420px';let y=0;d.rows.forEach((r,i)=>{svg.append(sv('rect',{x:3,y:y+2,width:334,height:sizes[i],rx:6,class:'dg-box'}));textAt(svg,r,15,y+24);if(d.mode==='flow'&&i<d.rows.length-1)textAt(svg,'↓',163,y+sizes[i]+23);y+=sizes[i]+28;});
    }else if(d.mode==='table'){
      const wrap=el('div',undefined,'dg-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',d.title);const table=el('table'),head=el('thead'),tr=el('tr');for(const c of d.columns){const th=el('th',c);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');for(const r of d.rows){const row=el('tr');r.forEach((c,i)=>{const td=el(i===0?'th':'td',c);if(i===0)td.scope='row';row.append(td);});body.append(row);}table.append(body);wrap.append(table);fig.append(wrap);
    }else if(d.mode==='bits'){
      const wrap=el('div',undefined,'dg-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',d.title);const band=el('div',undefined,'dg-bits');let bit=d.fields.reduce((n,f)=>n+f.bits,0)-1;d.fields.forEach(f=>{const c=el('div',undefined,'dg-bit');c.style.width=Math.max(f.label.length>2?60:40,f.bits*14)+'px';c.append(el('small',bit===bit-f.bits+1?String(bit):`${bit}:${bit-f.bits+1}`),el('strong',f.label));if(f.value)c.append(el('small',f.value));band.append(c);bit-=f.bits;});wrap.append(band);fig.append(wrap,el('p','上はビット番号（最下位は0）。小さい欄は読みやすさのため拡大しています。', 'dg-note'));
    }else if(d.mode==='layout'){
      const layout=el('div',undefined,'dg-layout'),band=el('div',undefined,'dg-band'),legend=el('div',undefined,'dg-legend'),list=el('ol');const colors=['#386c58','#98551d','#495f91','#86608d'];const total=d.segments.reduce((n,s)=>n+s.size,0);let pos=d.start;
      d.segments.forEach((s,i)=>{const c=el('div',s.size/total>.07?String(i+1):'', 'dg-segment');c.style.height=(s.size/total*100)+'%';c.style.background=colors[i%colors.length];band.append(c);const li=el('li');li.style.borderLeft='5px solid '+colors[i%colors.length];li.style.paddingLeft='8px';li.append(el('strong',s.label),el('div',`0x${pos.toString(16)}〜0x${(pos+s.size-1).toString(16)}`),el('div',`${s.size} ${d.unit}`));list.append(li);pos+=s.size;});legend.append(list);layout.append(band,legend);fig.append(el('p','上から下へアドレス増加。左の帯は量に比例（極小領域は最低1px）、番号は右の一覧に対応。','dg-note'),layout);for(const m of d.marks||[])fig.append(el('p',`境界 0x${(d.start+m.offset).toString(16)}：${m.label}`,'dg-note'));
    }else if(d.mode==='map'){
      const gap=240,cardH=Math.max(80,...d.nodes.map(n=>wrapVisual(n.label,10).length*20+26)),stride=cardH+110,top=Math.max(...d.columns.map(c=>wrapLabel(c,12).length))*20+30;
      const w=(d.columns.length-1)*gap+180,h=(Math.max(...d.nodes.map(n=>n.row))+1)*stride+top,{svg,arrow}=canvas(fig,w,h,d);
      d.columns.forEach((c,i)=>textAt(svg,c,i*gap+90,22,12,'middle'));const points=new Map(d.nodes.map(n=>[n.id,{x:n.column*gap+12,y:n.row*stride+top}]));
      for(const e of d.edges){const a=points.get(e.from),b=points.get(e.to);let sx,sy,tx,ty,p,labelX,labelY;if(a.x===b.x){sx=a.x+78;tx=b.x+78;sy=a.y+(b.y>a.y?cardH:0);ty=b.y+(b.y>a.y?0:cardH);p=`M${sx},${sy} L${tx},${ty}`;labelX=sx+8;labelY=Math.min(sy,ty)+24;}else{const right=b.x>a.x;sx=a.x+(right?156:0);sy=a.y+cardH/2;tx=b.x+(right?0:156);ty=b.y+cardH/2;const mid=(sx+tx)/2;p=`M${sx},${sy} H${mid} V${ty} H${tx}`;labelX=Math.min(sx,tx)+8;labelY=sy-wrapVisual(e.label,5).length*20-5;}svg.append(sv('path',{d:p,class:'dg-line','marker-end':arrow}));textAt(svg,e.label,labelX,labelY,5,'start',13,wrapVisual);}
      d.nodes.forEach(n=>{const p=points.get(n.id);svg.append(sv('rect',{x:p.x,y:p.y,width:156,height:cardH,rx:6,class:'dg-box'}));textAt(svg,n.label,p.x+10,p.y+23,10,'start',13,wrapVisual);});fig.append(el('p','箱は保存場所や主体、矢印はラベルに示した参照・操作です。配置は模式図です。','dg-note'));
    }else{
      const w=Math.max(520,d.lanes.length*230),row=Math.max(140,...d.steps.map(s=>wrapVisual('12. '+s.label,13).length*20+65)),top=Math.max(...d.lanes.map(l=>wrapLabel(l,12).length))*20+40,{svg,arrow}=canvas(fig,w,top+d.steps.length*row,d);const x=i=>w/d.lanes.length*(i+.5);
      d.lanes.forEach((l,i)=>{textAt(svg,l,x(i),22,12,'middle');svg.append(sv('path',{d:`M${x(i)},${top-15} V${top+d.steps.length*row}`,class:'dg-line','stroke-dasharray':'5 5'}));});
      d.steps.forEach((s,i)=>{const y=top+25+i*row,sx=x(s.from),tx=x(s.to),label=`${i+1}. ${s.label}`;if(s.from===s.to){const bx=Math.max(4,Math.min(w-224,sx-110));svg.append(sv('rect',{x:bx,y:y-25,width:220,height:row-25,rx:6,class:'dg-box'}));textAt(svg,label,bx+9,y,13,'start',15,wrapVisual);}else{const lines=wrapVisual(label,Math.max(13,Math.floor(Math.abs(tx-sx)/15)));svg.append(sv('path',{d:`M${sx},${y+lines.length*20+5} H${tx}`,class:'dg-line','marker-end':arrow}));const center=(sx+tx)/2;svg.append(sv('rect',{x:Math.min(sx,tx),y:y-22,width:Math.abs(tx-sx),height:lines.length*20+8,class:'dg-paper'}));lines.forEach((line,n)=>textAt(svg,line,center,y+n*20,80,'middle'));}});fig.append(el('p','上から下へ時間が進みます。縦の線は各主体、横の矢印は情報・制御の受け渡しです。','dg-note'));
    }
    if(['bits','map','sequence','table'].includes(d.mode))fig.append(el('p','左右が見切れる場合は、図の中を横にスクロールできます。','dg-note'));
    if(d.note)fig.append(el('p',d.note,'dg-note'));
  }
  function renderText(parent,text,plain){let pos=0;for(const b of blocks(text)){plain(text.slice(pos,b.start));const fig=el('figure',undefined,'osrg-diagram');const style=el('style',css);fig.append(style);try{if(b.error)throw Error(b.error);const d=parse(b.source);fig.append(el('figcaption',d.title));draw(fig,d);const alt=el('details'),summary=el('summary','図を文章で読む'),list=el(['flow','sequence'].includes(d.mode)?'ol':'ul');for(const line of description(d).slice(1)){const li=el('li');plain(line,li);list.append(li);}alt.append(summary,list);fig.append(alt);}catch(e){fig.append(el('p','図を表示できません。前後の文章をお読みください。'),el('p',e.message),el('pre',b.source));}parent.append(fig);pos=b.end;}plain(text.slice(pos));}
  const api={parse,blocks,validateText,validateEntry,hasDiagram,renderText,wrapLabel,wrapVisual,description};globalThis.OSRGDiagram=api;if(typeof module!=='undefined')module.exports=api;
})();
