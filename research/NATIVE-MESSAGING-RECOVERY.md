# Native Messaging接続の調査・復旧（1.3.1）

調査日：2026-11-01。作業フォルダー移行後のWindows環境で確認しました。

## 確認できたこと

通常のChromeのSecure Preferencesから、OS読書ガイドの読み込み元がこの作業フォルダーのextension、登録された拡張IDが一致することを確認しました。環境設定全体や認証内容は出力していません。

実ユーザー側のHKCUのRegistry32・Registry64は、調査開始時点からともに%LOCALAPPDATA%\OSReadingGuide\host\native-host.jsonを指していました。HKLMに同名ホストの登録はありません。ホスト名、実行用launch.cmd・node.exe・host.cjsの存在、allowed_originsとホスト側originsに含まれる現在の拡張IDも整合していました。実行関連ファイルはOneDriveのプロジェクトへ依存していません。

変更前の専用Chromeプロファイルで、同じ拡張IDからNative Messagingを直接呼んだstatus通信はok:true、signedIn:trueでした。したがって、報告された元の「Specified native messaging host not found」の未検出状態は調査時点では再現せず、その発生時の原因は特定できません。過去の未登録状態や移動によるID変更が原因だった可能性を、確認済みの事実としては扱っていません。before証跡のworker側エラーは、検証コードを辞書ページから呼んだための想定されたAI設定ページ制限で、Native Messagingのエラーではありません。

一方、background.jsのonDisconnectがchrome.runtime.lastErrorを読んでいなかったことは確認できました。これにより、接続失敗の具体的な理由がUIに届かず「Unchecked runtime.lastError」として残り得ます。このエラー処理を修正しました。

## 修正

- 切断コールバック内でlastErrorを読み取り、未検出・許可ID不一致・その他の切断を利用者向けの具体的な説明と復旧手順へ変換。成功後の切断、タイムアウト後の二重処理にも対応。
- AI設定に「接続の修復」、現在のIDを含むPowerShellコマンド、コピーボタンを追加。
- setup-helper.cmdをダブルクリックすると、install-helper.ps1が同じフォルダーの拡張IDをChromeのDefault/Profile各設定から自動検出。未検出・複数候補なら明示IDを使用。初回はChromeへextensionを読み込んだ後に実行。
- HKCUの32/64ビット両方を同じマニフェストへ登録し、登録後にファイル・ホスト名・IDの整合性を検査。既存の有効な許可IDを維持し、同一ファイルの不要なコピーを省略。既に配置したnode.exeも再利用可能。
- Windows PowerShell 5.1で日本語が誤解釈されないUTF-8 BOM付きでセットアップ／解除スクリプトを保存。解除は両レジストリビューへ対応（解除自体は実行していません）。
- -DiagnoseOnlyは読み取り専用の登録診断。認証ファイルやChrome保存データを読み書きせずに、診断・再登録できます。

実ユーザーのID自動検出→再登録→整合性検査を実行済みです。再実行も成功しました。credentials.dpapiとChromeの個人辞書は更新していません。Sign in with ChatGPT、DPAPI保護、APIキーなし、有料APIへの切替なしを維持しています。

## 検証

- 単体・契約・回帰テスト30件成功。lastErrorの消費、成功後切断、ID検出の一致・旧パス除外・複数プロファイル・壊れたJSON、PowerShell 5.1構文解析を含みます。
- 実ChromeのAI設定ページ→実サービスワーカー→実Native Messagingホストでstatus成功。ログイン状態を保持。
- 専用検証プロファイルのサービスワーカーだけを未登録の検証用ホスト名に向け、実際のChromeのnot found応答から復旧表示を確認。実ユーザーのレジストリを壊す方法は使っていません。
- 接続先を戻して「接続を再確認」に成功。モデル一覧取得も成功。新規生成・再ログイン・設定保存は行っていません。
- 専用プロファイルのstorage前後一致。実ユーザーの通常のChromeプロファイルのUI操作は行っていません。
- 390px幅と復旧コマンド表示をスクリーンショットでも確認。アカウント表示は画像でマスクしています。
- 194項目と3図の内容を維持し、全件検査・ビルドも成功。

証跡：tests/evidence/native-registration-report.json、native-recovery-before.json、native-recovery-report.json、native-repair-desktop.png、native-repair-mobile.png。

## 今後の復旧

このPCの再登録は実施済みです。現在開いているChromeでは、拡張を再読み込みしてAI設定の「接続を再確認」を押してください。再ログインは不要です。

以後の初回登録／復旧は、配布フォルダーのsetup-helper.cmdを実行します。自動検出できなければ、AI設定に表示される現在のID入りコマンドを、配布フォルダーで開いたPowerShellへ貼り付けます。管理者権限は不要です。認証・個人辞書は削除しません。

Chrome拡張だけではWindowsレジストリへ書き込めないため、Windows側ファイルの初回実行は必要です。ホスト登録形式、レジストリビュー検索順、onDisconnectでのlastError処理は[Chrome公式Native Messaging資料](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)を参照しています。
