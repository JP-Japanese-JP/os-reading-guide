$ErrorActionPreference='Stop'
$subkey='Software\Google\Chrome\NativeMessagingHosts\jp.osreadingguide.chatgpt'
$views=@([Microsoft.Win32.RegistryView]::Registry32)
if([Environment]::Is64BitOperatingSystem){$views+=[Microsoft.Win32.RegistryView]::Registry64}
foreach($view in $views){
 $baseKey=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,$view)
 try{$baseKey.DeleteSubKey($subkey,$false);$baseKey.DeleteSubKey($subkey+'.v2',$false)}finally{$baseKey.Dispose()}
}
Write-Output 'Chromeから補助プログラムへの32/64ビットの接続登録を解除しました。辞書と認証ファイルは残っています。認証を取り消すにはChatGPT設定でOS Reading Guideを切断してください。'
