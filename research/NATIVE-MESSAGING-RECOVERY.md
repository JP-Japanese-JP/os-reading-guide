# Windows接続の復旧と調査知見

## 復旧の手順

拡張を同じフォルダーで更新・再読み込みし、通常使用するWindowsセッションから `setup-helper.cmd` を実行します。AI設定を再読み込みし、「接続を再確認」で画面・バックグラウンド・補助のバージョンと接続先を確認します。詳細は [操作手順](../INSTALL.html) にあります。

読み取り専用の登録診断は次のコマンドです。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-helper.ps1 -DiagnoseOnly
```

## 原因と設計への反映

- フォルダー移動で拡張IDが変わる可能性があるため、現在の読み込み元からIDを検出し、HKCUの32/64ビットの登録とallowed_originsを照合します。
- Native Messagingの切断時に `chrome.runtime.lastError` を取得し、未登録や許可ID不一致を利用者へ伝えます。正常終了に伴う切断は成功として扱います。
- Chromeに旧manifest登録が残るケースでは、画面の更新だけでは登録が切り替わらないことがありました。Chrome全体の再起動と再確認を手順に含めます。
- エージェントの実行環境と通常のWindowsセッションで登録・認証の参照先が異なるケースがありました。登録環境差の詳しい原因は未確定です。通常利用するChromeから実通信を確認する必要があります。
- 1.4.4ではホスト名 `jp.osreadingguide.chatgpt.v2` を追加し、セットアップは旧名も互換用に登録します。
- 1.4.5ではPowerShellの標準入出力をUTF-8に固定し、Node側でストリームをデコードして、日本語の接続名の文字化けを修正しました。

認証保存の扱いは [アカウント設計](CHATGPT-ACCOUNTS.md)、検証範囲は [検証結果](../TEST-REPORT.md) を参照してください。初回に報告されたhost not foundの発生原因そのものは調査時に再現できず、断定していません。
