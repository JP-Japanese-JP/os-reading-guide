# ChatGPTアカウント切り替え（1.4.0）

調査・検証日：2026-11-02（日本時間）。認証ファイルやトークンの値はログへ出力していません。

## 原因と公式仕様の照合

旧実装はDPAPI保護された1レコードに、最初のclient_id・subject・トークンを保存していました。同じclient_idを以後のログインにも使い、id_token_hintも送信していました。ログアウトしてもclient_idとsubjectを保持するため、ログアウトだけでは別アカウント用の登録へ変わりませんでした。subject一致検査は他人の資格情報への上書きを防ぐために必要ですが、新しいアカウントを別登録として追加する機能が不足していました。

公式仕様では、動的登録で発行されたclient_idは、そのユーザーと登録時に選んだワークスペースに紐づきます。別アカウント／別ワークスペースは新しいdynamic_agent_clientのフローか、対応する保存済み登録を使用します。id_token_hintは同じ登録の再認証用で、ワークスペース変更の手段ではありません。

したがって、旧登録を別アカウントへ再利用する実装は報告されたworkspace scope deniedと整合します。正確な元ワークスペースの名前・管理者設定までは調査していません。ブラウザーのCookieや既定ログインセッションを削除・変更して問題を回避する実装にはしていません。ブラウザーで選んだ本人は、新しく返された署名付きIDトークンを検証して判断します。

参照した公式資料：

- [Overview](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)

## 実装

- native/accounts.cjs：旧形式をデータを失わずversion 2の保護されたアカウント一覧へ移行。host IDは再生成せず、アカウント／登録ごとにclient_id、本人ID、トークン、期限を独立して管理します。同じメールでも別の登録を区別できる安定した接続番号を表示します。
- 新規追加はdynamic_agent_clientで開始し、以前のclient_id・IDトークンヒント・メールヒントを送りません。同じ端末のhost IDは維持します。
- state・nonce・PKCE・コールバックURIを検証し、登録時のclient_idを保存してからコード交換。署名、issuer、audience、期限、nonce、既存登録のsubject一致、プラン利用スコープを確認した後だけ新しい接続を有効にします。
- 途中失敗・拒否・本人不一致では以前の接続の認証情報を置き換えません。新しいclient_idだけを受け取った不完全な登録は、本人確認未完了として分離して保存します。
- ログアウトは選択中の接続だけのトークンを取り消し・消去し、他の接続・host ID・登録の対応を残します。辞書の初期化や全アカウント一括消去は行いません。
- AI設定に「ChatGPTアカウントを切り替える」、保存済み接続の選択、現在の接続表示を追加。同じアカウントの再認証はContinue with ChatGPT、別アカウント追加は切り替えボタンを使います。
- 切り替え時に生成の確認を解除。生成設定を接続IDへ紐づけ、補助プログラムでも現在の接続IDとの一致を検査します。別タブの古い設定で別アカウントの枠を使うことを防ぎます。
- Native Messaging登録・復旧、DPAPI、トークン更新の直列化、APIキーなし、有料APIへの切替なしを維持しています。認証状態は同じWindowsユーザーの補助プログラムで共有するため、他のChrome画面で切り替えた場合も接続を再確認します。

## 検証と運用

旧形式移行、本人・clientの不一致拒否、失敗時の旧接続保持、DPAPI往復は自動テストで検証します。切り替えUIは模擬応答によるChromeテストがあります。過去の実接続確認と未検証範囲は [検証結果](../TEST-REPORT.md) にまとめています。

認証後の状態表示は、保存済み認証の読み取りと認証待機のロックを分離し、画面に戻ると再取得します。接続別に生成同意を持ち、切り替え時に再確認します。

導入・切り替えは [操作手順](../INSTALL.html)、補助プログラムとの接続問題は [復旧資料](NATIVE-MESSAGING-RECOVERY.md) を参照してください。
