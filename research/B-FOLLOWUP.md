# B判定の追加改善

main / 5a002242a003eba2f2a76e175d20a245f8f88326の未コミットA改善を引き継いだ追加作業。再監査・A/B/Cの再判定はしていない。コミット・pushなし。

## 今回の変更

Bの未対応104件のうち23件を改善。8件に新図、15件に目的を示した共有図への案内（16リンク）を追加した。全体は194件のまま、33項目34図。前回の26図を含む既存本文・図定義・参照は保持した。

| 新図の所有項目 | 教育的な目的・表現 |
|---|---|
| array | 4Bの要素3個を比例配置し、a+3は領域ではなく末尾直後の境界と示す |
| buffer | 容量8を内容3・終端1・未使用4に分け、文字列長と使用量と容量を区別する |
| struct | 同じバイト位置を左右に揃え、通常配置とpackedの隙間・intの開始位置・sizeofを比較する |
| qemu | Windows→WSL2 Ubuntu→QEMU→ゲストの実行基盤を縦に追い、ホストでのビルドとゲスト操作を分ける |
| serial | 入力と出力の経路を対照し、受信だけではエコー表示にならないことを示す |
| abi | add(2,3)の引数と結果の場所、呼出し元/先の保存責任を同じ段階で比較する |
| multitask | 同じt0/t1/t2で、1CPUの交互実行と2CPUの同時実行を比較する |
| interrupt | 機器の処理中にCPUが状態を調べ続ける場合と、別の仕事/待機をする場合を同じ時刻で比較する |

既存のlayout、map、tableだけを使い、新形式は作らなかった。左右を同時に見ることが重要な表は2列に限定し、2列表だけ幅制約を調整した。縦の階層図は狭い画面でも横スクロールなしで全主体を追える。表は単なる説明文の列挙ではなく、同じ位置・時刻・処理段階を対応させている。

参照追加：half-open、code-brackets → array／file-api、string → buffer／alignment、attribute、offset → struct／wsl、shell → qemu／function、code-asm-registers → abi／busy → interrupt／page、bitops、code-shift → sv32／code-shift → pte。

各案内には「末尾直後と要素」「offsetofとメンバサイズ合計」「VAの右12シフトとPTEへの左10シフト」など、何を比較するかを記載した。既存説明は削除せず、図の条件と読み方を追記した。数値例は仮定であることを明記し、packedの配置を全処理系へ一般化しない。通常ABI、SBI、トラップの保存規則を混同しない。教材のreadfileの不備・ポーリング方式・単一CPUの協調方式の注意も保持した。

## B112件の現在の状態

| 状態 | 件数 |
|---|---:|
| 図解を追加・改善した | 9（今回8＋前回1） |
| 既存図への参照で対応した | 22（今回15＋前回7） |
| 現状の文章・コード例で十分と判断した | 14 |
| 学習効果は期待できるが、今回の優先順位では保留した | 67 |

[全194件の対応一覧](AUDIT-RESOLUTION.md) のB欄に各項目の状態と理由を記録した。既存監査の提案と本文評価を引き継いだ実装判断であり、再採点ではない。前回の「104件を見送り」を「104件すべて図が不要」とする扱いは改めた。

文章で十分とした14件：binary、unsigned、macro、zero、nm、disassembly、printf、strings、octal、code-increment、code-or、code-logic、code-compare、flag。短い数値・コード・出力の具体例で対象の操作を追えるため維持した。

残る67件は図の価値を否定していない。CPU/レジスタの全体像、ロード/ストア、ブート、MMIO、プロセス、ファイルシステムなどの図案は保留として明示し、今回は指定の5テーマを優先した。全IDと図案は対応一覧から確認できる。

## 検証

- ビルドと対応照合：194件・34図・前提DAG・全参照先が正常。
- npm test：60/60成功。B開始時と比較し、194件のID/メタデータ/概要/既存本文、26図の定義、既存参照の保持を検証。配列・終端の数値例、比較時刻、B112件の状態も検証。
- 実Chromeの隔離プロファイルで全34図×明色1440px・暗色1440px・暗色390px＝102表示。ページ横はみ出し、SVGの文字切れ、描画例外なし。生成・保存・import・再読込と個人データ保持の既存結合検証も成功。
- 追加8図は360pxの明暗でも確認（16表示）。8図とも図内横スクロールなし。新設16リンクを実クリックし、正しい図を持つ解説へ到達。
- 追加8図の390px画像を実際に開いて読みやすさを確認。位置/時間が同じ行に揃い、2列を同時に読めること、終端が領域の外にあること、条件が図前後に残ることを確認。
- git diff --check成功。実アカウント・個人Chromeプロファイルは使わず、教材原稿は未変更。

[追加図の画像一覧](B-DIAGRAM-PREVIEW.md)。検証記録：tests/evidence/quality/browser-report.json、tests/evidence/b-followup/report.json。実AIの生成品質、QEMU上のOS起動、利用者実験は今回の検証対象外。

## Bだけを取り消す方法

復元パッケージ：[rollback/b-followup](../rollback/b-followup/README.md)。解説はB開始時に保存したスナップショットから復元する。表示処理・テストは今回の小さな変更の逆差分から、対応一覧は保存済みのA内容と前回監査記録から復元用ファイルを作成した。対応一覧の整形を含めた全ファイルのバイト単位の開始時バックアップではないが、Aの69件改善・26図・194件のID/本文/参照に戻ることを検証する。

リポジトリのルートで `python rollback/b-followup/restore.py --check` を実行して確認する。戻す場合だけ `python rollback/b-followup/restore.py --apply` を実行する。実行前に対象ファイルのハッシュをすべて照合し、後続の編集があれば何も変更せず停止する。A状態のファイルを戻し、Bで新設した追跡用ファイルとテストはパッケージ内の退避先へ移す。その後ビルドを再生成する。Gitのreset/clean/checkoutやコミットは使わない。テスト画像・復元パッケージは残る。

## 今回変更したファイル

- data/glossary.json、data/code-explanations.json：23件への追記
- extension/diagram.js：2列表の狭幅表示
- tests/quality.test.cjs、quality-browser.cjs：34図へ照合更新
- tests/b-followup.test.cjs、b-followup-browser.cjs：保護・意味・狭幅・参照テスト
- research/audit-resolution.json、AUDIT-RESOLUTION.md：4状態と今回の対応
- research/b-followup-baseline.json、b-followup-changes.json：開始状態の照合情報と追加文
- README.md、research/DIAGRAMS.md、IMPLEMENTATION-PROGRESS.md、AUDIT-IMPLEMENTATION.md、DIAGRAM-PREVIEW.md：最新情報・前回記録との区別
- research/B-FOLLOWUP.md、B-DIAGRAM-PREVIEW.md：本報告と画像一覧
- rollback/b-followup/：Bだけを戻す復元ファイル・差分・検証記録
- ビルド生成物とtests/evidence/配下の画像・検証結果（管理外）
