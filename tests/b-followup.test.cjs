const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto'),D=require('../extension/diagram'),C=require('../extension/core');
const entries=[...require('../data/glossary.json'),...require('../data/code-explanations.json')],baseline=require('../research/b-followup-baseline.json'),changes=require('../research/b-followup-changes.json'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
test('B followup preserves all 194 identities, metadata, previous prose, references and 26 diagrams',()=>{
 a.equal(entries.length,194);let count=0;
 for(const b of baseline.entries){const e=entries.find(e=>e.id===b.id);a.ok(e);const {short,detail,...meta}=e;a.equal(hash(JSON.stringify(meta)),b.metadataSha256,e.id);a.equal(hash(short),b.shortSha256,e.id);
 const c=changes.items.find(x=>x.id===e.id),suffix=c?'\n\n'+c.addedText.join('\n\n'):'';if(c)a.ok(detail.endsWith(suffix),e.id);a.equal(hash(c?detail.slice(0,-suffix.length):detail),b.detailSha256,e.id);
 for(const d of b.diagrams){a.ok(D.blocks(detail).some(x=>x.source===d),e.id);count++;}for(const id of b.refs)a.ok(C.refs(detail).includes(id));D.validateEntry(e);
 }a.equal(count,26);a.equal(changes.items.length,23);C.validate(entries);
});
test('B diagrams preserve element sizes, terminating byte and equivalent comparison times',()=>{
 const defs=id=>D.blocks(entries.find(e=>e.id===id).detail).map(b=>D.parse(b.source));
 const arr=defs('array')[0];a.deepEqual(arr.segments.map(x=>x.size),[4,4,4]);a.equal(arr.marks.at(-1).offset,12);
 const buf=defs('buffer')[0];a.deepEqual(buf.segments.map(x=>x.size),[3,1,4]);a.equal(buf.marks.at(-1).offset,8);
 const multi=defs('multitask')[0];for(let i=0;i<3;i++)for(const cell of multi.rows[i])a.ok(cell.startsWith('t'+i+':')||cell.startsWith('t'+i+'：'));
 const ledger=require('../research/audit-resolution.json');a.equal(ledger.items.filter(x=>x.diagramRating==='B'&&x.bStatus).length,112);a.equal(Object.values(ledger.bFollowup.statusCounts).reduce((a,b)=>a+b),112);
});
