const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const entries=[...require('../data/glossary.json'),...require('../data/code-explanations.json')],chapters=require('../data/chapters.json'),C=require('../extension/core');
const root=path.resolve(__dirname,'..'),byId=new Map(entries.map(e=>[e.id,e]));
const inventory=[];let md='# 全18章の調査・解説対応表\n\n調査日：2026-10-30（日本時間）。本文・表・コード・注記を対象に、共通概念と章固有の暗黙の前提を抽出しました。\n\n原稿は `research/original/ja/` に保存。以下の項目数は辞書への対応数であり、初心者の疑問を100%尽くしたことを意味しません。本文・コードから直接解説へ到達できます。未登録の表現はChatGPTプランで生成・保存できます。\n\n';
for(const c of chapters){
 const filename=(c.number?c.slug:'index')+'.md',raw=fs.readFileSync(path.join(root,'research/original/ja',filename),'utf8');
 const match=C.matcher(entries,c.number,{kind:"code"}),found=[...new Set(match(raw).map(x=>x.id))],prose=raw.replace(/```[\s\S]*?```/g,'');
 const headings=prose.split('\n').filter(l=>/^#{1,3} /.test(l)).map(l=>l.replace(/^#+ /,''));
 const literalOnly=[...new Set([...prose.matchAll(/`([^`]+)`/g)].map(m=>m[1]))].filter(s=>!match(s).length);
 const item={number:c.number,title:c.title,source:'https://github.com/nuta/operating-system-in-1000-lines/blob/main/website/ja/'+filename,sha256:crypto.createHash('sha256').update(raw).digest('hex'),headings,extractedConcepts:found,implicitPrerequisites:c.prerequisites,unannotatedLiterals:literalOnly};inventory.push(item);
 md+=`## ${String(c.number).padStart(2,'0')} ${c.title}\n\n${c.summary}\n\n- 原稿：[${filename}](${item.source})\n- 調査した節：${headings.join(' / ')}\n- 前提・誤読しやすい点：${c.prerequisites.map(id=>byId.get(id).title+' (`'+id+'`)').join('、')}\n- 本文・コード中の対応項目（${found.length}）：${found.map(id=>byId.get(id).title).join('、')}\n\n`;
}
md+='## 抽出方針と残る表記\n\n一文字の変数、具体的なアドレス値、サンプル出力、ファイル名のすべてを別辞書項目にはしていません。たとえば `n` は関数の引数、`0x80200000` はアドレスと16進数、`sizeof(next->stack)` はsizeof・構造体・スタックの解説を組み合わせます。これらの未注釈リテラルも inventory.json に残し、追加調査できるようにしました。元のリンク・見出し・コードブロックにも注釈します。重なる表現は最長一致を優先します。\n\n## 正確性のための補足\n\n- 第02章：asm volatileはすべての最適化や並べ替えを止める指定ではない。CSRの権限はCSRごとに異なる。\n- 第04・09・12章：リンカシンボルはC変数の箱ではない。位置指定はRAMの実在を保証しない。\n- 第09章：終端は含まない。確保はページ単位。教材の計算は巨大な入力の桁あふれ・競合・個別解放に対応しない。\n- 第10章：この実装の並行実行は単一CPU上の切り替え。例外のネストからの正常復帰は対象外。\n- 第11章：物理ページ番号とアドレスを区別。Sv32仕様は教材のpaddr_tの幅と同一ではない。\n- 第13章：SPPがUモードへの復帰を選ぶ。SPIEだけで全割り込み源を有効にするわけではない。\n- 第14章：ecallは4バイトだが全RISC-V命令が4バイトとは限らない。本文のyieldシステムコールという説明はカーネル関数呼び出しとして補足。\n- 第15章：読み書き方向はデバイス基準。volatileとメモリフェンスは別。初期化例の状態上書き・機能交渉省略を一般化しない。\n- 第16章：diskは取得原稿では関数外の配列。本文のstaticという表記と静的記憶期間を区別。SUMはポインタ検証の代わりにはならない。\n\n参照した仕様のURLは data/sources.json。解説本文は原文の複製ではなく独自の補足です。\n';
fs.writeFileSync(path.join(root,'research/inventory.json'),JSON.stringify(inventory,null,2));fs.writeFileSync(path.join(root,'research/COVERAGE.md'),md);
console.log(`${chapters.length} chapters audited; ${entries.length} entries; ${entries.reduce((n,e)=>n+e.aliases.length,0)} aliases`);
