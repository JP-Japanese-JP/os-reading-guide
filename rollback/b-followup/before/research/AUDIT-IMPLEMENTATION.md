# 品質監査に基づく改善実装

2026-11-15。開始ブランチ `main`、開始コミット `5a002242a003eba2f2a76e175d20a245f8f88326`。開始時に未コミット変更はなかった。コミット・pushは行っていない。

前回の監査成果物5点を使用し、再採点や194件の再監査は行わなかった。評価レポート、全件評価JSON/Markdown、verification、audit-summaryの対象コミットと現在の開始コミットが一致した。

## 結果と対応範囲

| 照合対象 | 結果 |
|---|---|
| 初期搭載 | 用語165＋コード29＝194件。IDの追加・削除なし |
| 必要な本文・登録表記・参照・図の変更 | 69件。残る125件の内容は維持 |
| P1 | raw、trap-stateの2件を反映 |
| P2 | 50件の指摘の目的に対応 |
| 対応一覧 | 194件すべてを記録。未記録0件 |
| 図 | 25項目に26図。既存3項目の図も更新 |
| 元の図解A | 41件すべてに図または共通図への明示案内 |
| 元の図解B | 112件中8件に図・共通図への案内。104件は任意の個別追加を見送り |
| 元の図解C | 41件に図を増やしていない |

[全件の対応一覧](AUDIT-RESOLUTION.md) と [機械可読の対応記録](audit-resolution.json) に、元の指摘・提案、変更内容、図の参照先、変更したフィールド、追加・削除した段落を記録した。「対応済み」は本文等の必要な問題への対応であり、Bの任意図まで全て追加した意味ではない。図の対応は別欄で明示している。

## 初学者がつまずく箇所への修正

- **raw**：教材の実コマンドにある `.bss=alloc,contents` を示し、`.bss`内の64KiBスタックも生バイナリの内容になる理由を説明した。イメージ内のゼロ、ページを確保するときのゼロ、最後のページの余白、spの設定を分けた。ELFとリンカスクリプト、ゼロ初期化の解説から案内する。
- **trap-state**：124Bは31レジスタ分の保存量であり、C呼出し時の16B整列を保証しないと明記した。元spが16の倍数なら `(sp-124)%16=4`。退避量・余白・フレームの並び・元spの復元を合わせて検証する注意を補った。常にクラッシュするとは断定していない。独自切替アセンブリの52B退避を同じ問題と決めつけず、通常関数へ入る境界を区別した。
- **variable / linker-script**：関数外のdiskはstaticキーワードなしでも静的記憶域期間を持つ。第4章の配置、第9章の空きRAM範囲追加、第12章のuser.ldを区別した。
- **scheduler / kernel-stack / satp / virtqueue**：idle_procの最初の保存、csrrwの交換、sfence.vmaとsatpの3命令、16ディスクリプタと4096境界・QUEUE_PFNを、掲載コードの具体的な動作に対応させた。
- **登録表記**：return/switchのaliasをcode-basicsからcode-controlへ移した。jr、bool/true/false、SMAP、cf、virtq_init、参照の局所性、パースと容量定数などは、登録語から到達した本文で意味を確認できるよう補足した。本文中の一般説明と教材固有の条件を分けている。
- **既存の有用な注意**：file-apiの長さ・終端の問題、Virtioの公開前バリア、DRIVER_OKの累積ビットの問題は保持した。図でも教材の不備を正しい一般則として描かず、期待する順序や値との違いを明示した。
- **説明の効率**：通常の関数呼出しの説明を主軸に残し、切替やnakedの特殊例は参照へ整理した。allocationやentry-itemの重複説明を減らした。一律の長文化はしていない。

IDs、見出し、prerequisites、章スコープ、既存メタデータは保持。登録表記の削除・追加は上記return/switchの移管のみ。前提関係は非循環のまま、関連項目へ戻る明示リンクを許可した。すべてのリンク先の存在を検証し、履歴の上限・戻る操作は維持している。

## 図の構成と教育的な意図

| 図のまとまり | 主な所有項目 | 見せるもの |
|---|---|---|
| 番地と値 | pointer、symbol、code-array-pointer | 保存場所の住所、そこにある値、参照先の違い |
| 領域と境界 | allocation、first-switch、virtqueue、tar-layout | サイズの比率、開始/終端、境界が領域ではないこと |
| 保存と再開 | context、trap-state、syscall | A/BのスタックとCPU、CPU自動保存とOSの仕事、U/S/Mの受け渡し |
| アドレス変換 | sv32の2図、pte、ppn、copy-isolate | 10/10/12の分割、二つの添字、PTEフラグ、別の物理領域への対応 |
| ビルドと起動 | raw、build-options | ファイルの変換工程と実行時のメモリ準備の違い |
| Virtio | descriptor、io、rings、init-virtio | next番号とaddr、機器視点のWRITE、要求公開の順序、カウンタ、状態ビットの期待値と掲載値 |
| その他の難所 | buddy、multiprocessor、async、endian、flex-array | 分割木、操作の交錯、保存状態の比較、バイト順、配列とポインタ欄の配置差 |

古い3図のうち、allocationは量と境界を分けた比例配置へ、contextはA/CPU/Bの対応図へ、sv32はビット分割と数値例の探索図へ変更した。旧flowの処理順を理解するための文章は保持し、同じ箱の重複を増やさず目的に合った表現へ置き換えた。

図ごとに重要な条件・省略を文章に残した。例えばSv32は4KiBページで有効なPTEと権限を前提とし、4MiBページやTLBの経路は省略する。virtqueueはLegacyかつN=16、図のアドレスは仮定。first-switchの整列した数値例だけで実コード全体の整列を保証しない。図の色だけで情報を区別せず、番号・ラベル・文章版を備える。

## 実装上の指摘への対応

| 監査の論点 | 対応・判断 |
|---|---|
| 図の必要性の判断が任意で、採否理由が残らない | 新規生成スキーマにdiagramDecisionを追加。A/B/C・概念ごとの理由・既存図の参照語を要求。Aは図か共有先が必要、Cは図なし。Bの省略は許容 |
| 一括生成の弱い文脈や従来の生成方法に依存 | 監査前の一括生成・補正4スクリプトは、対応表が存在すると停止する歴史的スクリプトにした。旧本文や3図を再適用させない。今後は項目と文脈を指定した既存UIから生成・編集する。モデル設定を無関係に変えない |
| flow/memoryでは位置・幅・主体を表現できない | table/bits/layout/map/sequenceを追加。JSONから固定DOM/SVGへ描画。旧2形式も互換維持 |
| 不正図が保存されてから初めて問題に気づく | 生成応答、前提項目、scopeNote、手動保存、追加されるimport項目、ビルドで共通検査。図番号・行番号付きエラー。保存失敗時にフォームを保持 |
| 閉じ忘れのフェンスを検出しにくい | 閉じていないフェンス・不正な開始行も検出。旧保存データは原文と周囲の文章を残して表示 |
| 図が詳細欄に埋もれる | 「図解を読む」、編集プレビュー、図への共有リンクを追加。共有リンクで詳細を展開し、固定ヘッダーの下に図の先頭を表示 |
| 図の再利用 | 既存の解説IDへ明示リンクし、本文と図を同じ保存単位で保持。生成中に共有先の図が変わった場合も保存前に再検査 |
| 表JSONの[[とリンク記法が衝突 | 図の定義と本文の参照を分けて検査。実際の生成→保存→再読込テストで比較表を確認 |
| native側の生成にも新検証が必要 | ビルド・補助プログラム配布にdiagram.jsを含めた。認証方式、ホストID、モデル選択、API経路は変更していない |
| 3件しか保存されない固定上限や脱落の疑い | 今回も3件を上限とする処理は導入していない。監査の事実に従い、旧データ自体の図の少なさと採否・表現力を改善。生成が過去に隠れて捨てられたという未確認の推測は採用しない |

図の共有は既存IDと編集・バックアップ機構を使う方式を選んだ。画像ファイル管理や任意の描画プログラムの実行を増やさずに、比較・空間配置・ビット・参照・主体別時間軸を使い分けられる。第三者の描画ライブラリやネットワーク依存は追加していない。[詳しいスキーマ](DIAGRAMS.md) を参照。

## 検証結果

| 検証 | 結果 |
|---|---|
| npm run build | 194件・18章、図形式・参照先・前提DAG検証に成功 |
| npm test | 58/58成功。図の境界検査、AI判断、保存拒否、import原子性、共有先、個人編集、既存認証/接続等の回帰を含む |
| 最終AI検査の追加後 | scopeNoteも含む図採否の整合を確認し、quality/native/workerの関連26テストを再実行して全件成功 |
| check-explanation-review.cjs | 194件のID・対応記録を照合、A41件の案内先、P1/P2の対応、26図を確認 |
| quality-browser.cjs | 実Chromeの隔離プロファイル。26図×明色1440px・暗色1440px・暗色390px＝78表示を保存。SVG文字の画面外切れ、ページ横はみ出し、描画例外なし |
| 同ブラウザの保存経路 | 旧2形式＋新5形式、HTMLを含むラベルの非実行、保存/再読込/import、旧不正図の本文保持、編集プレビューのエラー時入力保持に成功 |
| 生成結合テスト | AI/Native境界の応答だけ模擬。比較表の生成→本物のworkerで検証→Chrome保存→再読込→描画に成功。実AI利用枠は消費していない |
| upgrade-browser.cjs | 公開教材18章を注釈付け、13箇所の*--sp、リンク・履歴・別章同期、Chromeプロセス再起動での個人データ維持、狭幅を確認。ページ例外なし |
| dictionary-browser.cjs | 194件の一覧、検索・ソート、教材との双方向編集同期、追加・削除・個人編集解除、再読込、モバイル表示に成功 |
| diagram-browser.cjs | 旧形式の図と保存済み不正図が辞書/教材ポップアップで表示可能、任意スクリプト非実行を確認 |
| quality-browser.cjs --interactions-only | 最後の図ジャンプ位置修正後に再実行し、図先頭が固定ヘッダーに隠れないことも確認 |
| 教材・既存メタデータ | 元原稿、章情報、ID、前提関係は未変更。return/switch以外のaliasも保持 |
| git diff --check | エラーなし |

初回のサンドボックス内では模擬HTTPサーバーへの接続がEACCES、公開教材のDNSがERR_NAME_NOT_RESOLVEDとなった。限定したテストを制限外で再実行して成功した。製品の認証・ネットワーク設定を変更して解決したものではない。

数値例は保存済み教材のコマンド・構造体と静的に照合し、アドレス分割、52Bフレーム、124Bと16B整列、Virtioの4096境界をテストした。主な根拠は前監査で確認済みの [LLVM objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html#set-section-flags-section-flag-flag)、[RISC-V psABI](https://github.com/riscv-non-isa/riscv-elf-psabi-doc/blob/master/riscv-cc.adoc#integer-calling-convention)、[Supervisor ISA](https://docs.riscv.org/reference/isa/v20260120/priv/supervisor.html)、[Virtio 1.2](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html)、[Virtio 1.3公開文書](https://docs.oasis-open.org/virtio/virtio/v1.3/virtio-v1.3.html)、[WG14 N2310](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n2310.pdf)。仕様の再監査はしていない。

## 実画像で確認したこと

スクリーンショットを実際に開いて、allocation/first-switchの領域比率と境界、contextの二つのスタック、Sv32の探索、PTEの全ビット、descriptorの二種類の参照、I/Oの公開順、buddyの分岐、rawの工程、狭幅の表・暗色・ポップアップを確認した。

検査中に見つけた問題を反映：3列対応図の通常幅での右切れ、狭幅の辞書全体のはみ出し、長いラベルの固定高、ASCII語の不自然な途中分割、Sv32の矢印の重なり、PTEの下位ビットが通常幅で隠れる問題、図リンク後に説明文が画面を占める移動位置。図の定義が正しいだけで完了扱いにしていない。

[スクリーンショット一覧](DIAGRAM-PREVIEW.md) から明暗・狭幅を比較できる。生の検証記録は `tests/evidence/quality/browser-report.json`、`interactions-report.json`、`content-review-report.json`、`upgrade-report.json`、`dictionary-report.json`、`diagram-report.json`。これらと画像はローカル成果物として保存され、従来の.gitignore設定によりGit管理外。

## 見送ったもの・検証の限界

- 図解Bの104件には個別図を追加していない。文章の例で理解できる項目へ図を増やすこと、既存の数値例を重複管理することより、Aの難所と具体的な誤りを優先した。各項目の図対応欄で追跡できる。
- 広いmap/sequence/tableは狭幅で図内部の横スクロールを使う。文字を極端に縮小しない方針。文章版も利用できる。
- RISC-V実行環境でのOS起動やLLVM生成バイナリの実測は行っていない。教材原稿の問題自体を修正する作業は対象外で、解説側で一般則との相違を明示した。
- 実AIの出力品質は今回の模擬応答テストでは保証しない。スキーマ・採否理由・検証・保存経路を確認し、今後の生成結果にも内容確認が必要。
- 初学者を被験者にした学習効果の実測は行っていない。教育的確認は説明の対応・視点・数値例・視認性に基づく。
- 実ユーザーのChromeプロファイル、個人編集、インストール済み補助プログラムの認証は操作していない。利用中の環境へ反映するには拡張の再読込とsetup-helper.cmdによる補助プログラム更新が必要。保存済み個人編集は新しい初期説明より優先される。

P1/P2で実装待ちとして残した指摘はない。任意図の見送りと上記の検証範囲は、未評価・未記録とは区別している。

## 変更ファイル

- 解説：`data/glossary.json`、`data/code-explanations.json`
- 表示・生成・保存：`extension/diagram.js`、`ai.js`、`content.js`、`dictionary.js`、`dictionary.css`、`service-worker.js`、`core.js`
- ビルド・配布・照合：`scripts/build.cjs`、`install-helper.ps1`、`check-explanation-review.cjs`、`.gitignore`
- 旧一括スクリプトの再適用防止：`scripts/review-explanations-batch.cjs`、`expand-explanations.cjs`、`apply-review-corrections.cjs`、`add-review-diagrams.cjs`
- テスト：`tests/quality.test.cjs`、`quality-browser.cjs`、`worker.test.cjs`、`core.test.cjs`、`diagram-browser.cjs`、`dictionary-browser.cjs`、`upgrade-browser.cjs`。既存ブラウザテストの変更は新保存検査と現行アカウント確認に合わせた模擬データの補正
- 文書：`README.md`、`research/DIAGRAMS.md`、`IMPLEMENTATION-PROGRESS.md`、`AUDIT-IMPLEMENTATION.md`、`AUDIT-RESOLUTION.md`、`audit-resolution.json`、`DIAGRAM-PREVIEW.md`
- 再生成した管理外成果物：`extension/data.js`、`extension/chapter-text.js`、`native/ai.js`、`native/diagram.js`、`tests/evidence/`の画像・検証記録
