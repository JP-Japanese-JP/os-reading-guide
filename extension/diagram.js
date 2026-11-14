/* Accept only a small JSON vocabulary. Never execute or insert generated markup. */
(()=>{
  function parse(source){
    const d=JSON.parse(source);
    if(!d||!['flow','memory'].includes(d.mode)||typeof d.title!=='string'||d.title.length>200||!Array.isArray(d.rows)||!d.rows.length||d.rows.length>12||d.rows.some(x=>typeof x!=='string'||x.length>80))throw Error('図の形式が不正です');
    return d;
  }
  // Preserve short ASCII identifiers and addresses; bound even an unbroken long word.
  function wrapLabel(label,width=18){
    const lines=[];let line='';
    for(const token of label.match(/[A-Za-z0-9_]+|[^]/gu)||[]){
      const chars=Array.from(token);
      if(Array.from(line).length+chars.length>width&&line){lines.push(line);line='';}
      while(chars.length>width){lines.push(chars.splice(0,width).join(''));}
      line+=chars.join('');
    }
    if(line||!lines.length)lines.push(line);
    return lines;
  }
  function renderText(parent,text,plain){
    let pos=0;const re=/```diagram\s*\n([\s\S]*?)```/g;let found=false;
    for(const m of text.matchAll(re)){
      found=true;plain(text.slice(pos,m.index));
      const fig=document.createElement('figure');
      fig.style.cssText='margin:20px 0;padding:12px;border:1px solid #82998a;border-radius:8px;white-space:normal';
      try{
        const d=parse(m[1]);
        const cap=document.createElement('figcaption');cap.textContent=d.title;fig.append(cap);
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
        const rows=d.rows.map(label=>{const lines=wrapLabel(label);return {lines,height:Math.max(100,lines.length*18+24)};});
        const totalHeight=rows.reduce((sum,r)=>sum+r.height+24,0);
        svg.setAttribute('viewBox',`0 0 340 ${totalHeight}`);
        svg.setAttribute('role','img');svg.setAttribute('aria-label',d.title+'：'+d.rows.join(' → '));
        svg.style.cssText='width:100%;max-width:420px;display:block;margin:8px auto';
        let y=0;
        rows.forEach((row,i)=>{
          const r=document.createElementNS(ns,'rect');
          for(const [k,v] of Object.entries({x:5,y:y+5,width:330,height:row.height,rx:5,fill:'#eef6f0',stroke:'#4f7660'}))r.setAttribute(k,v);
          svg.append(r);
          const t=document.createElementNS(ns,'text');t.setAttribute('fill','#173c2c');t.setAttribute('font-size','16');
          row.lines.forEach((line,n)=>{const span=document.createElementNS(ns,'tspan');span.setAttribute('x','18');span.setAttribute('y',String(y+25+n*18));span.textContent=line;t.append(span);});
          svg.append(t);
          if(d.mode==='flow'&&i<rows.length-1){const a=document.createElementNS(ns,'text');a.setAttribute('x','163');a.setAttribute('y',String(y+row.height+20));a.setAttribute('fill','#4f7660');a.textContent='↓';svg.append(a);}
          y+=row.height+24;
        });
        fig.append(svg);
        const alt=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ol');
        summary.textContent='図を文章で読む';alt.append(summary);
        for(const row of d.rows){const li=document.createElement('li');plain(row,li);list.append(li);}
        alt.append(list);fig.append(alt);
      }catch{
        const p=document.createElement('p');p.textContent='図を表示できません。前後の文章をお読みください。';
        const pre=document.createElement('pre');pre.textContent=m[1];pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';fig.append(p,pre);
      }
      parent.append(fig);pos=m.index+m[0].length;
    }
    if(found)plain(text.slice(pos));else plain(text.replaceAll('```diagram','図の定義（未完了）'));
  }
  globalThis.OSRGDiagram={parse,renderText,wrapLabel};
  if(typeof module!=='undefined')module.exports=globalThis.OSRGDiagram;
})();
