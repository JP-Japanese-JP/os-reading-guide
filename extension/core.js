/* Pure matching and graph functions shared by the extension and tests. */
(() => {
  const norm = s => String(s).normalize('NFKC').toLowerCase();
  const refs = text => [...text.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)].map(m => m[1]);
  function validate(entries) {
    const ids = new Set();
    for (const e of entries) {
      if (!/^[a-z0-9-]+$/.test(e.id) || ids.has(e.id)) throw Error('IDの重複・不正: ' + e.id);
      ids.add(e.id);
      if (['title','short','detail'].some(k=>typeof e[k]!=='string'||!e[k].trim()||e[k].length>100000) || !Array.isArray(e.aliases) || e.aliases.length>100 || e.aliases.some(a => typeof a !== 'string' || !a.trim() || a.length>200)) throw Error('必須項目が不正: ' + e.id);
      if (e.prerequisites && (!Array.isArray(e.prerequisites)||e.prerequisites.some(id=>typeof id!=='string'))) throw Error('前提知識の形式が不正: '+e.id);
      if (e.keywords && (!Array.isArray(e.keywords)||e.keywords.some(s=>typeof s!=='string'))) throw Error('検索語の形式が不正: '+e.id);
      if (e.sources && (!Array.isArray(e.sources)||e.sources.some(s=>typeof s!=='string'))) throw Error('出典の形式が不正: '+e.id);
      if (e.priority!==undefined && !Number.isFinite(e.priority)) throw Error('優先度が不正: '+e.id);
      if (e.chapters && (!Array.isArray(e.chapters) || e.chapters.some(c => !Number.isInteger(c) || c < 0 || c > 17))) throw Error('章番号が不正: ' + e.id);
    }
    const graph = new Map(entries.map(e => [e.id, [...new Set([...(e.prerequisites || []), ...refs(e.short + e.detail)])]]));
    for (const [id, children] of graph) for (const child of children) if (!ids.has(child)) throw Error(id + ' の参照先がありません: ' + child);
    const visiting = new Set(), done = new Set();
    function visit(id) { if (visiting.has(id)) throw Error('循環参照: ' + id); if (done.has(id)) return; visiting.add(id); graph.get(id).forEach(visit); visiting.delete(id); done.add(id); }
    ids.forEach(visit);
    return true;
  }
  function matcher(entries, chapter, context={}) {
    const aliases = new Map();
    for (const e of entries) {
      for (const a of new Set([...e.aliases,...(e.title.length<=200?[e.title]:[])])) {
        // Recognizable code expressions also link in prose/popups; punctuation alone
        // is meaningful only in code (a Japanese sentence's brackets are not C syntax).
        if (e.matchMode==='code' && context.kind!=='code' && !/[A-Za-z0-9_]/.test(a)) continue;
        const old = aliases.get(a);
        const rank=x=>(x.chapters?.includes(chapter)?10000:!x.chapters?1000:0)+(x.priority||0);
        if (!old || rank(e)>rank(old)) aliases.set(a, e);
      }
    }
    const keys = [...aliases.keys()].sort((a,b) => b.length-a.length);
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(keys.map(escape).join('|') || '(?!)', 'gu');
    return text => {
      re.lastIndex = 0;
      const out = [];
      for (const m of text.matchAll(re)) {
        const a=m[0], start=m.index, end=start+a.length;
        if (/^[A-Za-z0-9_]/.test(a) && /[A-Za-z0-9_]/.test(text[start-1] || '')) continue;
        if (/[A-Za-z0-9_]$/.test(a) && /[A-Za-z0-9_]/.test(text[end] || '')) continue;
        out.push({start,end,id:aliases.get(a).id,text:a});
      }
      return out;
    };
  }
  function search(entries, query, chapter) {
    const q=norm(query).trim(); if (!q) return [];
    return entries.map(e => {
      let score=0;
      for (const a of [e.title,...e.aliases,...(e.keywords || [])]) { const n=norm(a); if(q===n) score+=100; else if(n.length>1 && q.includes(n)) score+=15+n.length; else if(q.length>1 && n.includes(q)) score+=10; }
      if (score && e.chapters?.includes(chapter)) score+=20+(e.priority||0);
      return {e,score};
    }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score || (b.e.priority||0)-(a.e.priority||0)).slice(0,12).map(r=>r.e);
  }
  function pushHistory(history, id) { const at=history.findIndex(x=>x.id===id); return at>=0 ? history.slice(0,at+1) : [...history,{id,expanded:false,scroll:0}].slice(-24); }
  // Exact means case-sensitive: C identifiers A/a and operators must stay distinct.
  const duplicates=(entries,term)=>entries.filter(e=>[e.title,...e.aliases].some(a=>a.trim()===term.trim()));
  function merge(base,overrides){const map=new Map(base.map(e=>[e.id,e]));overrides.forEach(e=>map.set(e.id,e));const all=[...map.values()];validate(all);return all;}
  globalThis.OSRGCore={norm,refs,validate,matcher,search,pushHistory,duplicates,merge};
  if (typeof module !== 'undefined') module.exports=globalThis.OSRGCore;
})();
