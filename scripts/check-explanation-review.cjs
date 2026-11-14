const fs=require('fs'),crypto=require('crypto'),C=require('../extension/core'),D=require('../extension/diagram');
const all=[...require('../data/glossary.json'),...require('../data/code-explanations.json')];
const progress=require('../research/explanation-review-progress.json');
C.validate(all);
const metadata=all.map(({short,detail,...rest})=>rest);
const metadataHash=crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
const baseline=require('../research/review-metadata-baseline.json');
if(baseline.count!==all.length||baseline.sha256!==metadataHash)throw Error('解説本文以外のメタデータが変更されています');
const pending=all.filter(e=>!progress[e.id]?.success).map(e=>e.id),diagrams=[];
for(const e of all){
  const definitions=[...e.detail.matchAll(/```diagram\s*\n([\s\S]*?)```/g)];
  if((e.detail.match(/```diagram/g)||[]).length!==definitions.length)throw Error('未完了の図: '+e.id);
  for(const m of definitions){D.parse(m[1]);diagrams.push(e.id);}
}
for(const id of ['allocation','sv32','context'])if(!diagrams.includes(id))throw Error('必要な図がありません: '+id);
const lengths=all.map(e=>e.detail.length).sort((a,b)=>a-b);
const report={total:all.length,reviewed:all.length-pending.length,pending,diagrams,min:lengths[0],median:lengths[Math.floor(lengths.length/2)],max:lengths.at(-1),referencesValid:true,metadataPreserved:true,metadataSha256:metadataHash};
fs.writeFileSync('tests/evidence/content-review-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(pending.length)process.exitCode=1;
