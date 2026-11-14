/* Annotate logical text runs across syntax-highlighting spans without changing text. */
(() => {
  const excluded='button,script,style,textarea,input,select,svg,math,[contenteditable]:not([contenteditable="false"]),.header-anchor';
  const blocks=new Set(['DIV','P','LI','UL','OL','PRE','CODE','KBD','TD','TH','TR','TABLE','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','SECTION','ARTICLE','BR']);
  let sequence=0;
  function clear(root){if(!root)return;root.querySelectorAll('.osrg-term').forEach(e=>e.replaceWith(document.createTextNode(e.textContent)));root.normalize();}
  function collect(root){const runs=[];let current=[];
    const flush=()=>{if(current.length)runs.push(current);current=[];};
    function walk(node){if(node.nodeType===Node.TEXT_NODE){if(node.textContent)current.push(node);return;}if(node.nodeType!==Node.ELEMENT_NODE)return;if(node.matches(excluded)){flush();return;}const boundary=blocks.has(node.tagName);if(boundary)flush();for(const child of node.childNodes)walk(child);if(boundary)flush();}
    walk(root);flush();return runs;
  }
  function annotateRun(nodes,match){
    if(nodes.some(n=>!n.isConnected))return;
    const text=nodes.map(n=>n.textContent).join('');const hits=match(text);if(!hits.length)return;
    for(const hit of hits)hit.group=String(++sequence);
    let offset=0;
    for(const node of nodes){const str=node.textContent,end=offset+str.length,parts=hits.filter(h=>h.start<end&&h.end>offset);if(parts.length){const frag=document.createDocumentFragment();let p=0;for(const hit of parts){const start=Math.max(0,hit.start-offset),stop=Math.min(str.length,hit.end-offset);frag.append(document.createTextNode(str.slice(p,start)));const span=document.createElement('span');span.className='osrg-term';span.textContent=str.slice(start,stop);span.dataset.osrgId=hit.id;span.dataset.osrgText=hit.text;span.dataset.osrgGroup=hit.group;
        // Links retain their native click and keyboard semantics; hover/Alt+click opens the guide.
        if(!node.parentElement.closest('a')){span.tabIndex=0;span.setAttribute('role','button');span.setAttribute('aria-haspopup','dialog');span.setAttribute('aria-label',hit.text+'の解説');}
        frag.append(span);p=stop;
      }frag.append(document.createTextNode(str.slice(p)));node.replaceWith(frag);}offset=end;}
  }
  globalThis.OSRGAnnotations={clear,collect,annotateRun};
})();
