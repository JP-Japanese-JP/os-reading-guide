# 開発ガイド

[作品の概要と導入](../README.md)

## ファイルと変更の入口

- `data/glossary.json`：既存の概念・暗黙の前提知識。
- `data/code-explanations.json`：C・アセンブリの構文／記号の補足。`matchMode: "code"` は本文の句読点等への過剰な注釈を防ぎます。
- `extension/core.js`：照合、参照検証、履歴。
- `extension/annotations.js`：色分けされたコードをまたぐ照合。
- `extension/service-worker.js`：重複防止、辞書変更の直列化、Native Messaging。
- `extension/ai.js`：生成指示、出力スキーマ、検証。`npm run build` が補助プログラム用にもコピーします。
- `native/host.cjs`：OAuth、署名検証、更新、SSE、暗号化保存。
- `scripts/install-helper.ps1`：現在のWindowsユーザー用に補助プログラムを登録。
- `research/COVERAGE.md`：18章の調査対応表。`inventory.json` に未対応の表記も記録。

明示的な参照は `[[id|表示名]]` または `prerequisites` で追加します。`prerequisites` の循環は検証で拒否します。本文の明示リンクは参照先の存在を検査し、往復を許可します。自動リンクはクリック時だけ開き、履歴を最大24段に制限し、既に通った項目へ戻る場合は履歴を巻き戻します。

## 編集とテスト

解説は `data/` のJSONを編集し、`npm run build` で再生成します。Chromeの拡張機能管理画面から同じ拡張機能を再読み込みして反映します。

`npm run build` に続けて `npm test` を実行します。ブラウザテストにはPlaywrightとWindows版Chromeが必要です。`PLAYWRIGHT_PATH` でPlaywrightのモジュールへのパスを指定し、ブラウザテストを実行する前に `tests/evidence/` を作成してください。検証用プロファイルと証跡はローカルに保存されます。

- `node tests/upgrade-browser.cjs`：実際の教材・拡張を使う全章操作テスト。AI応答だけ模擬。再起動を含む。
- `node tests/integrity.cjs`：注釈前後の本文・コード・リンクの同一性。
- `node tests/native-browser.cjs`：実際のChromeとWindows補助プログラムの接続。
- `node --test tests/*.test.cjs`：照合、保存競合、OAuth署名、SSE、Windows暗号化。

検証の範囲と未確認事項は [TEST-REPORT.md](../TEST-REPORT.md) に記載します。

## 解説のレビュー

初期搭載の194件は [概念・前提知識165件](../data/glossary.json) と [コード解説29件](../data/code-explanations.json) にあります。[章情報](../data/chapters.json) と [教材原稿](../research/original/ja/) を参照しながら、解説の正確さ、初学者へのわかりやすさ、図解の必要性を項目IDごとに評価できます。関連する出典は [sources.json](../data/sources.json) を参照してください。

Chromeで追加・編集した解説と質問メモは、使用中のChromeプロファイルに保存されます。個人辞書の書き出しファイルは、共有用のソースツリーの外に保管してください。

## 辞書と保存の仕様

拡張アイコンをクリック、または教材の「読書ガイド」→「解説辞書を開く」で独立したタブを開きます。見出し・登録表記・短い説明・詳しい説明から検索し、初期搭載／自分で追加／初期搭載を編集で絞り込めます。日本語の照合順、アルファベット順、更新順に対応します。漢字の読み仮名は未登録のため厳密な五十音の読み順ではありません。

辞書ページでもChatGPT生成・手動追加・編集・個人解説の削除ができます。初期搭載の項目は個人編集を解除して元に戻せます。教材と同じ chrome.storage.local の custom および同じサービスワーカーの保存処理を使用し、別の辞書データベースを作りません。開いた画面同士も変更通知で同期します。編集中のフォームは勝手に書き換えず、競合が起きた場合は保存時に知らせます。

章リンクは同梱原稿の一致から求めます。表記が一致しても意味が同じとは限らないため、文脈を確認してください。リンク先では最初の対応箇所に移動して解説を開きます。原稿と公開サイトの内容に差がある場合は該当箇所が見つからないことがあります。

辞書ページ固有の検証：`node tests/dictionary-browser.cjs`。生成は検証済みの共通処理を使い、このテストでは応答だけ模擬にして追加の利用枠を消費しません。

## ブラウザテストの準備

PowerShellでリポジトリのルートから実行します。

```powershell
npm install --no-save --package-lock=false playwright
$env:PLAYWRIGHT_PATH = (Resolve-Path node_modules/playwright).Path
New-Item -ItemType Directory -Force tests/evidence | Out-Null
node tests/quality-browser.cjs
node tests/dictionary-browser.cjs
```

テストは `C:/Program Files/Google/Chrome/Application/chrome.exe` を参照します。Chromeの配置が違う環境ではテスト側の実行パス調整が必要です。公開教材を開くテストにはネット接続が必要です。単体テストの認証ケースはループバックの模擬サーバーとWindows DPAPIを使用します。

`tests/live-browser.cjs`、`diagnose-live.cjs`、`login-account-current.cjs` は実接続用の手動診断スクリプトです。実アカウントでの認証や生成を行うため、通常の回帰検証には模擬応答を使うテストを選びます。これらは `npm test` の対象外です。

## 設計資料と変更の記録

| 資料 | 継続開発での用途 |
|---|---|
| [図解仕様](../research/DIAGRAMS.md) | 形式、上限、旧データ互換、保存・生成時の検証 |
| [アカウント設計](../research/CHATGPT-ACCOUNTS.md) | 登録の分離、本人検証、失敗時の保護 |
| [接続復旧](../research/NATIVE-MESSAGING-RECOVERY.md) | Windows登録・文字コード・状態表示の調査知見 |
| [教材の対応表](../research/COVERAGE.md) | 章ごとの対象と不足の把握 |
| [解説品質](../research/EXPLANATION-QUALITY.md) | 内容照合の範囲と出典 |
| [監査反映](../research/AUDIT-IMPLEMENTATION.md)・[追加改善](../research/B-FOLLOWUP.md) | 改善理由と検証結果 |
| [全項目の対応表](../research/AUDIT-RESOLUTION.md) | 保留項目を含む次の改善候補 |

機能変更の経緯は [検証結果](../TEST-REPORT.md) に要約します。細かな編集はGit履歴で追えます。監査用JSONと基準データは検査スクリプト・テストの入力として維持します。一度限りの一括補正スクリプトには監査済みデータの巻き戻しを防ぐガードがあります。

`rollback/b-followup/` はB追加改善当時の復元用スナップショットです。後続の編集があるとハッシュ照合で停止します。今回の文書整理後もこの保護が働くため、現在のツリーに対する一括復元手順としては使用できません。過去の差分を理解する資料として参照してください。

## 公開するデータ

個人辞書・認証保存ファイル・Chromeプロファイル・診断ログはローカル管理です。`.gitignore` と、ステージするファイルの一覧を確認してください。公開画像は内容とメタデータを確認して `docs/images/` に置きます。`tests/evidence/` の生ログや画面には実アカウント情報が入り得ます。

研究資料中の過去の件数・検証結果は、その時点の記録です。画面一覧のローカル画像はGitHubに同梱していません。公開画像はREADMEに載せたものを参照してください。


## 詳細本文とAI生成の境界

詳細本文は項目に必要な背景・具体例を記述し、画面で一律に切り詰めません。必須テキストの10万文字上限は入力検証の上限です。図はdetail内に保存するため、個人編集・書き出し・読み込みに本文と一緒に含まれます。

生成要求では文字列・章・URL・周辺本文とコード・関連する短い解説を送ります。モデルにローカルツール実行権限は渡しません。補助プログラムはOAuth・トークン更新・SSEの完了確認を担い、認証情報をWindows DPAPIで保護します。ログアウト時には更新トークンの失効を試みます。失敗応答や中断された生成を正常な解説として保存しない設計です。

クレジット利用OFFは利用者が確認する設定で、拡張からサービス側の設定を取得する検査はありません。接続条件は変わり得るため、認証連携を改修する際はアカウント設計に記録した公式資料を確認してください。
