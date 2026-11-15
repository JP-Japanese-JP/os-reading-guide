// Reconcile implementation with the prior audit, without re-scoring entries.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../extension/core'),D=require('../extension/diagram');
const glossary=require('../data/glossary.json'),code=require('../data/code-explanations.json'),all=[...glossary,...code];
const ledger=require('../research/audit-resolution.json'),by=new Map(all.map(e=>[e.id,e]));
assert.equal(glossary.length,165);assert.equal(code.length,29);assert.equal(ledger.count,194);
assert.equal(ledger.items.length,194);assert.equal(new Set(ledger.items.map(x=>x.id)).size,194);
assert.deepEqual(ledger.items.map(x=>x.id).sort(),all.map(e=>e.id).sort());C.validate(all);
const diagrams=[];
for(const e of all){D.validateEntry(e);for(const b of D.blocks(e.detail)){const d=D.parse(b.source);diagrams.push({id:e.id,mode:d.mode,title:d.title});}}
for(const item of ledger.items){
  if(['P1','P2'].includes(item.priority))assert.ok(item.actions.length,item.id+' is unresolved');
  if(item.diagramRating==='A')assert.ok(item.diagramOwners.length,item.id+' has no diagram path');
  for(const id of item.diagramOwners){assert.ok(D.hasDiagram(by.get(id)?.detail||''),id+' has no valid diagram');if(id!==item.id)assert.ok(C.refs(by.get(item.id).detail).includes(id),item.id+' has no shared-diagram link');}
}
const ratings=Object.fromEntries(['A','B','C'].map(r=>[r,ledger.items.filter(x=>x.diagramRating===r).length]));
assert.deepEqual(ratings,{A:41,B:112,C:41});
assert.equal(C.matcher(all,6,{kind:'code'})('return')[0].id,'code-control');assert.equal(C.matcher(all,14,{kind:'code'})('switch')[0].id,'code-control');
const changed=ledger.items.filter(x=>x.actions.length);
const report={auditCommit:ledger.auditCommit,total:all.length,glossary:glossary.length,code:code.length,tracked:ledger.items.length,untracked:[],changed:changed.length,priorRatings:ratings,diagramEntries:new Set(diagrams.map(x=>x.id)).size,diagramBlocks:diagrams.length,diagrams,AWithDiagramPath:ledger.items.filter(x=>x.diagramRating==='A'&&x.diagramOwners.length).length,priorityResolved:Object.fromEntries(['P1','P2'].map(p=>[p,changed.filter(x=>x.priority===p).length])),referencesValid:true,prerequisitesAcyclic:true,sha256:Object.fromEntries(['glossary','code-explanations'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('data/'+n+'.json')).digest('hex')]))};
fs.mkdirSync('tests/evidence',{recursive:true});fs.writeFileSync('tests/evidence/content-review-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
