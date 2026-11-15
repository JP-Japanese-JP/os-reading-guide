const {test}=require('node:test'),a=require('node:assert/strict'),D=require('../extension/diagram'),AI=require('../extension/ai'),C=require('../extension/core');
const entries=[...require('../data/glossary.json'),...require('../data/code-explanations.json')];
const fence=d=>'```diagram\n'+JSON.stringify(d)+'\n```';
const diagram={mode:'table',title:'値と場所',columns:['場所','値'],rows:[['0x1000','0x8000']]};
const response=data=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]});
const data={title:'生成テスト',short:'概要',detail:'読み方\n'+fence(diagram)+'\n意味の説明',scopeNote:'',prerequisites:[],diagramDecision:{rating:'A',reason:'値と保存場所を対応させる',existingTerm:''}};
test('all embedded diagrams validate, cover five representations, and preserve their numerical examples',()=>{
 const defs=entries.flatMap(e=>D.blocks(e.detail).map(b=>D.parse(b.source)));a.equal(defs.length,34);a.deepEqual([...new Set(defs.map(d=>d.mode))].sort(),['bits','layout','map','sequence','table']);
 const va=defs.find(d=>d.mode==='bits'&&d.title.includes('0x2000f034'));a.equal(va.fields.reduce((s,f)=>s+f.bits,0),32);a.equal((0x2000f034>>>22)&1023,128);a.equal((0x2000f034>>>12)&1023,15);a.equal(0x2000f034&4095,0x34);
 const queue=defs.find(d=>d.mode==='layout'&&d.title.includes('Legacy'));a.equal(queue.segments.slice(0,3).reduce((s,x)=>s+x.size,0),4096);a.equal(queue.start/4096,0x80240);
 const frame=defs.find(d=>d.mode==='layout'&&d.title.includes('52バイト'));a.equal(frame.start+frame.segments.reduce((s,x)=>s+x.size,0),0x80001000);a.equal((0x80001000-124)%16,4);
});
test('all diagram modes reject out-of-range dimensions, references and executable properties',()=>{
 const invalid=[{...diagram,rows:[['wrong']]},{...diagram,onclick:'alert(1)'},{mode:'bits',title:'x',fields:[{label:'x',bits:65}]},{mode:'layout',title:'x',start:0,unit:'B',segments:[{label:'x',size:-1}]},{mode:'layout',title:'x',start:0,unit:'B',segments:[{label:'x',size:1}],marks:[{label:'outside',offset:2}]},{mode:'sequence',title:'x',lanes:['CPU'],steps:[{from:0,to:1,label:'bad'}]},{mode:'map',title:'x',columns:['A'],nodes:[{id:'n',label:'x',column:0,row:0}],edges:[{from:'n',to:'missing',label:'x'}]}];for(const d of invalid)a.throws(()=>D.parse(JSON.stringify(d)));
 const good={mode:'map',title:'x',columns:['A'],nodes:[{id:'n',label:'x',column:0,row:0}],edges:[]};a.throws(()=>D.parse(JSON.stringify({...good,nodes:[...good.nodes,{id:'b',label:'x',column:0,row:0}]})));
 a.equal(D.parse(JSON.stringify({...diagram,title:'<img src=x onerror=alert(1)>'})).title,'<img src=x onerror=alert(1)>');
});
test('broken fences are rejected before persistence, including malformed opening lines',()=>{
 for(const text of ['```diagram','```diagram\n{}','```diagram bad\n{}\n```',fence(diagram)+'\n```diagram\n{}\n```'])a.throws(()=>D.validateText(text),/図/);
 a.equal(D.hasDiagram('```diagram\n{}\n```'),false);a.equal(D.hasDiagram(fence(diagram)),true);a.deepEqual(D.wrapLabel('住所\n0x80253000'),['住所','0x80253000']);
});
test('AI decision and diagrams are validated without truncating valid output',()=>{
 a.ok(AI.schema.required.includes('diagramDecision'));a.equal(AI.parse(response(data)).detail,data.detail);
 for(const decision of [{rating:'C',reason:'不要',existingTerm:''},{rating:'A',reason:'',existingTerm:''}])a.throws(()=>AI.parse(response({...data,diagramDecision:decision})));
 a.throws(()=>AI.parse(response({...data,detail:'本文のみ'})),/共有図/);
 a.throws(()=>AI.parse(response({...data,detail:'本文のみ',diagramDecision:{rating:'A',reason:'共通図',existingTerm:'ない語'}})),/本文/);
 a.throws(()=>AI.parse(response({...data,scopeNote:'```diagram\n{}\n```'})),/図/);
 a.throws(()=>AI.parse(response({...data,detail:'本文のみ',scopeNote:fence(diagram),diagramDecision:{rating:'C',reason:'図なし',existingTerm:''}})),/判断と内容/);
 a.throws(()=>AI.parse(response({...data,prerequisites:[{term:'前提',short:'概要',detail:'```diagram\n{}\n```'}]})),/図/);
 a.equal(AI.parse(response({...data,detail:'本文でポインタの図を参照',diagramDecision:{rating:'A',reason:'同じ例',existingTerm:'ポインタ'}})).diagramDecision.existingTerm,'ポインタ');
});
test('navigation can revisit a shared diagram while prerequisite cycles remain invalid',()=>{
 const aEntry={id:'a',title:'a',aliases:['a'],short:'a',detail:'[[b|図：b]]',prerequisites:[]},bEntry={...aEntry,id:'b',title:'b',aliases:['b'],detail:'[[a|関連するa]]'};
 a.equal(C.validate([aEntry,bEntry]),true);a.throws(()=>C.validate([{...aEntry,prerequisites:['b']},{...bEntry,prerequisites:['a']}]),/循環/);a.throws(()=>C.validate([{...aEntry,detail:'[[missing]]'},bEntry]),/参照先/);
});
test('registered syntax and missing alias explanations reach the corrected entries',()=>{
 const matcher=C.matcher(entries,14,{kind:'code'});for(const [word,id] of [['return','code-control'],['switch','code-control'],['jr','code-asm-jump'],['SMAP','sum'],['cf','shell-syntax'],['virtq_init','virtqueue'],['参照の局所性','satp']])a.equal(matcher(word)[0]?.id,id,word);
});

test('visual wrapping preserves address tokens and improves mixed Japanese/Latin labels',()=>{
 a.deepEqual(D.wrapVisual('VPN[1]',5),['VPN[1]']);a.deepEqual(D.wrapVisual('next番号',5),['next番号']);a.deepEqual(D.wrapVisual('0x80253034',10),['0x80253034']);
 for(const label of ['漢'.repeat(120),'a'.repeat(120),'場所0x80253034に置く😀'.repeat(5)])a.equal(D.wrapVisual(label,10).join(''),label);
});
test('critical explanations match the preserved textbook command and structure definitions',()=>{
 const fs=require('node:fs'),read=n=>fs.readFileSync('research/original/ja/'+n,'utf8');
 const app=read('12-application.md'),trap=read('08-exception.md'),virtio=read('15-virtio-blk.md');
 a.match(app,/--set-section-flags \.bss=alloc,contents -O binary/);a.match(app,/64 \* 1024/);
 a.match(trap,/addi sp, sp, -4 \* 31/);a.match(trap,/call handle_trap/);
 a.match(virtio,/#define VIRTQ_ENTRY_NUM\s+16/);a.match(virtio,/struct virtq_used used __attribute__\(\(aligned\(PAGE_SIZE\)\)\)/);
 a.equal(entries.find(e=>e.id==='raw').detail.includes('--set-section-flags .bss=alloc,contents'),true);
});
