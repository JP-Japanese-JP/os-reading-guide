# 解説品質の改訂

## 原因調査

旧初期データは一般概念165項目が詳細74〜142文字（中央値103文字）、コード29項目が102〜254文字（中央値126文字）でした。表示UIが切り捨てているのではなく、保存済み本文が短い状態でした。short/detailの分離は既存構造として維持しています。旧生成処理には概要を短くする指示と前提知識の少数制限がありましたが、詳細の技術上限は1万文字規模で、この初期本文の短さを直接強制するものではありません。

## 編集基準

各概念に必要な定義・仕組み・背景・具体例・教材との関係を選び、長さや見出しを統一しません。特に型と値、整数演算とポインタ演算、物理アドレスと仮想アドレス、CPUの仕様と教材の簡略化を区別します。短い構文は必要な説明だけに留めます。専門語は文中で定義するか、既存の解説リンクからたどります。

改訂処理は原稿の該当章と既存項目を参照してshort/detailだけを更新します。ID、表記、文脈指定、参照関係、出典を維持します。ブラウザ内のcustomには書き込みません。進捗はexplanation-review-progress.json、全件検査はnode scripts/check-explanation-review.cjsで確認できます。生成結果の正確性を形式検査だけで保証することはできないため、教材中の処理と重要な区別を別途確認します。

図解は限定したJSON定義から拡張自身がSVGを組み立てます。自由なSVG、HTML、スクリプト、外部URLは実行・取得しません。図は補助情報とし、文章だけでも説明を追えるようにします。

## 教材・仕様との内容照合（2026-11-01）

形式検査とは別に、次の誤読しやすい境界を原稿のコード・計算例と照合しました。

| 対象 | 照合した区別 |
| --- | --- |
| 第4・9章、allocation / static-local / symbol | リンカの位置指定とRAMの存在、アドレスと中身、整数加算とポインタ加算、終端を含まない範囲、ゼロ初期化と割り当て管理 |
| 第10章、context / first-switch / kernel-stack | raとs0〜s11の52バイト、spの保存先、初回用の人工的な復元領域、通常呼び出しとトラップで異なる保存条件、例外のネストの限界 |
| 第11・13章、sv32 / ppn / pte / satp / modes / sret | 仮想32ビットと最大34ビットの物理アドレス、PTEとsatpのビット配置、4KiBと4MiB、SPPとSPIE、sfence.vmaと一般のfence |
| 第14章、syscall / ecall-user / ecall-next / getchar / exit | 教材のa3規約とSBIの規約、ecallだけを4バイト進める理由、ポーリングと休止、終了状態と資源回収 |
| 第15章、descriptor / rings / volatile / barrier | デバイス基準のWRITE、リング番号とデータアドレス、volatile・コンパイラバリア・CPUフェンス、available indexへの公開より前の順序保証 |
| 第16章、tar-layout / octal / flush / sum / trust | 512バイトのヘッダ・パディング、文字列の8進数、RAM上の変更と書き戻し、SUMと入力検査、グローバル配列の静的記憶域期間 |

照合用原稿はresearch/original/ja/内の取得済みファイルを使用しています。重要仕様は[RISC-V Supervisor ISA](https://docs.riscv.org/reference/isa/v20260120/priv/supervisor.html)、[GCC Extended Asm](https://gcc.gnu.org/onlinedocs/gcc/Extended-Asm.html)、[Virtio仕様](https://docs.oasis-open.org/virtio/virtio/v1.3/virtio-v1.3.html)も参照しました。教材の簡略化を仕様一般の保証として説明しないことを重視しています。これは重点項目の内容照合であり、全文章を独立した専門家が査読したという意味ではありません。

生成バッチは成功したIDだけを保存し、再開時に飛ばします。8件の生成がタイムアウトしたため、環境変数OSRG_REVIEW_BATCH_SIZE=4で小分けに再開できるようにしました（未指定時は従来どおり8件）。失敗した応答からshort/detailを取り込まず、APIキーや別の有料APIへ切り替えません。

## 最終編集と全件検査

2026-11-01にgpt-6.1-solで194/194件の改訂が完了しました。成功済み129件を再生成せず、未改訂65件のみ再開しました。生成タイムアウト時の未完了結果は保存していません。

原稿全体との照合後、scripts/apply-review-corrections.cjsで6項目を補正しました。file-apiは実装の戻り値と長さ検査の限界、static-diskは実在する宣言行、code-predecrementは整数引数pcの意味、ioは要求公開前のバリア、code-ternaryは実際のVirtioの選択式、code-widthは辞書の実装事情を含まない型の説明にしました。補正スクリプトは生成終了後に実行し、short/detail以外を変更しません。

scripts/add-review-diagrams.cjsでallocation・sv32・contextに図と文章を追加しました。最終の詳細本文は471〜2055文字、中央値821文字です。これは結果の記録であり、各項目への文字数目標ではありません。概要は22〜94文字です。

check-explanation-review.cjsは194件の改訂済みID、参照の整合性と非循環性、図のJSON形式と未完了フェンス、3図の存在、本文以外のメタデータの同一性を検査します。review-metadata-baseline.jsonは再開前のID・表記・文脈指定・前提参照・出典などのハッシュです。最終のextension/data.jsとdata/*.jsonの全項目一致も確認しています。

画面確認で見つかった16進アドレス・CPUの途中改行は、図のASCII語を保つ折り返しで改善しました。長いラベルで行数が増えた場合は箱の高さも広がります。これは図の保存形式を変更せず、文字をtextContentとして挿入する安全性も維持します。
