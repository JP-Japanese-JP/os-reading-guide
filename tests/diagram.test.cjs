const {test}=require('node:test'),a=require('assert/strict'),D=require('../extension/diagram.js');test('diagram schema rejects executable markup and unbounded layouts',()=>{a.throws(()=>D.parse('<svg onload=alert(1)>'));a.throws(()=>D.parse(JSON.stringify({title:'x',mode:'script',rows:['x']})));a.throws(()=>D.parse(JSON.stringify({title:'x',mode:'flow',rows:Array(13).fill('x')})));a.equal(D.parse(JSON.stringify({title:'test',mode:'memory',rows:['0x1000: page A','0x2000: page B']})).rows.length,2);});

 test('long detail and diagram definitions survive generation parsing without truncation',()=>{const AI=require('../extension/ai');const detail='背景と具体例。'.repeat(2500)+'\n'+String.fromCharCode(96).repeat(3)+'diagram\n'+JSON.stringify({mode:'flow',title:'手順',rows:['開始','完了']})+'\n'+String.fromCharCode(96).repeat(3);const data={title:'詳細の検証',short:'短い概要',detail,scopeNote:'',prerequisites:[]};const parsed=AI.parse({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]});a.equal(parsed.detail,detail);a.equal(parsed.short,data.short);});

test('diagram wrapping preserves addresses and CPU labels without losing text',()=>{
  const label='0x80221000〜0x80222fff：CPUのメモリ';
  const lines=D.wrapLabel(label);
  a.equal(lines.join(''),label);
  for(const word of ['0x80221000','0x80222fff','CPU'])a.ok(lines.some(line=>line.includes(word)));
  for(const label of ['a'.repeat(80),'漢'.repeat(80),'😀'.repeat(40),'abcdefghij '.repeat(7)]){
    const lines=D.wrapLabel(label);a.equal(lines.join(''),label);
    a.ok(lines.every(line=>Array.from(line).length<=18));
  }
});
