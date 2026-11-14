// Apply only source-checked editorial corrections after the generation batch has exited.
const fs=require('fs'),C=require('../extension/core');
const files=['data/glossary.json','data/code-explanations.json'];
const lists=files.map(f=>JSON.parse(fs.readFileSync(f))),all=lists.flat();
const corrections=[
  ['code-width',
    'なお、Cには`short`という整数型もありますが、解説データの概要欄の名前である`short`とは別のものです。',
    '`short`もCの整数型です。型名だけで幅を決めつけず、対象環境の規則や`sizeof`で確認します。'],
  ['code-ternary',
    '`is_write ? OUT : IN`は、`is_write`が真なら`OUT`、偽なら`IN`を選ぶ例です。ただし、これらの名前が具体的に何を意味するかは定義によります。この記号だけから入出力の方向などを確定することはできません。',
    '教材の`is_write ? VIRTIO_BLK_T_OUT : VIRTIO_BLK_T_IN`は、`is_write`が真ならディスクへの書き込み要求、偽ならディスクからの読み込み要求の種類を選びます。一方、`is_write ? 0 : VIRTQ_DESC_F_WRITE`は、ディスク読み込み時にデバイスが受け取り先メモリへ書けるようにするフラグの選択です。条件式の書き方は同じでも、要求の種類とメモリの読み書き方向は別の情報です。'],
  ['file-api',
    '戻り値は、呼び出しの結果を呼び出し元へ伝える整数です。提示されたシェルは、`readfile`の戻り値を読み込んだバイト数として使っています。ただし、エラー時の値や書き込み時の正確な規約は、関数宣言だけでは分からず、カーネル側の実装も確認する必要があります。',
    '第16章の`handle_syscall`では、指定した名前のファイルが見つからなければ-1を返します。見つかった場合は、読み込みも書き込みも、実際に`memcpy`へ渡した`len`を返します。書き込みでは既存ファイルの内容とサイズを更新し、`fs_flush`でディスクへ書き戻します。新しい名前のファイルを作る処理はありません。\n\nただし、掲載コードの長さ調整は一般的な読み込みAPIとは異なります。`len > sizeof(file->data)`の場合だけ`len = file->size`とし、それ以外ではファイルサイズより長い要求もそのままコピーします。例えば内容が19バイトでも`readfile(..., 128)`なら128バイトをコピーして128を返し得ます。「常に要求長とファイルサイズの小さい方を返す」と読んではいけません。負の長さやユーザーバッファの検査も不足しており、実用化するなら長さ・容量・権限を検証する必要があります。'],
  ['static-disk',
    'この章の説明対象となるコードでは、`disk`は関数の外に定義された配列とされています。そのため、本文の「`static`として宣言」という表現と、実際にキーワードが書かれているかどうかは区別する必要があります。また、今回提示された抜粋には宣言行そのものがないため、その表記は抜粋だけからは確認できません。いずれにしても、ここで重要なのは、ディスク内容を保持する大きな配列が関数内の自動記憶期間の配列ではない、という点です。',
    '第16章の原稿では、`uint8_t disk[DISK_MAX_SIZE];`が`fs_init`などの関数の外に定義されています。宣言行に`static`キーワードはありません。本文の「staticとして宣言」という表現はコード表記とは一致しませんが、この配列が静的記憶期間を持ち、関数呼び出しごとのスタックに置かれるローカル配列ではないという要点は変わりません。キーワードの有無と保存場所の寿命を分けて読んでください。'],
  ['code-predecrement','さらに復帰先を表す`ra`の位置に開始関数`pc`のアドレスを置きます。','さらに復帰先を表す`ra`の位置に、開始先アドレスを表す整数引数`pc`の値を置きます。'],
  ['io',
    '通知の直後には、デバイスがまだデータを転送している可能性があります。',
    '上の手順は教材コードの流れです。一般のVirtio実装では、`avail.index`を更新すること自体が要求の公開になるため、その更新より前にも、要求内容・ディスクリプタ・リング要素をデバイスから見えるようにする順序保証が必要です。通知直前のバリアだけで常に十分という意味ではありません。詳しくはメモリバリアの解説も参照してください。\n\n通知の直後には、デバイスがまだデータを転送している可能性があります。']
];
for(const [id,before,after] of corrections){
  const e=all.find(e=>e.id===id);if(!e)throw Error(id);
  if(e.detail.includes(after))continue;
  if(!e.detail.includes(before))throw Error('correction source differs: '+id);
  e.detail=e.detail.replace(before,after);
}
C.validate(all);
for(let i=0;i<files.length;i++)fs.writeFileSync(files[i],JSON.stringify(lists[i],null,2)+'\n');
console.log('Applied source-checked corrections:',corrections.map(x=>x[0]).join(', '));


