param(
 [ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
 [string]$NodePath,
 [switch]$Interactive,
 [switch]$DiagnoseOnly
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$installRoot=Join-Path $env:LOCALAPPDATA 'OSReadingGuide/host'
$extensionPath=Join-Path $projectRoot 'extension'
$manifestPath=Join-Path $installRoot 'native-host.json'
$registrySubkey='Software\Google\Chrome\NativeMessagingHosts\jp.osreadingguide.chatgpt'
$v2ManifestPath=Join-Path $installRoot 'native-host-v2.json'
$v2RegistrySubkey=$registrySubkey+'.v2'
$utf8=New-Object Text.UTF8Encoding($false)
if (!$NodePath) {
 $nodeCommand=Get-Command node -ErrorAction SilentlyContinue
 if ($nodeCommand) { $NodePath=$nodeCommand.Source }
 elseif (Test-Path -LiteralPath (Join-Path $installRoot 'node.exe')) { $NodePath=Join-Path $installRoot 'node.exe' }
 else { $NodePath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
}
if (!(Test-Path -LiteralPath $NodePath)) { throw 'Node.js 22以上が必要です。-NodePath でnode.exeを指定できます。' }
$major=[int]((& $NodePath --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Node.js 22以上が必要です。' }
$detectedIds=@(& $NodePath (Join-Path $PSScriptRoot 'detect-extension.cjs') $extensionPath (Join-Path $env:LOCALAPPDATA 'Google/Chrome/User Data') | ConvertFrom-Json | ForEach-Object { foreach ($candidateId in $_) { [string]$candidateId } })
if (!$ExtensionId) {
 if ($detectedIds.Count -eq 1) { $ExtensionId=$detectedIds[0] }
 elseif ($Interactive) { $ExtensionId=Read-Host 'Chromeの拡張一覧にあるOS読書ガイドの32文字のIDを貼り付けてEnter' }
 else { throw 'このフォルダーの拡張IDを自動検出できません。Chromeでextensionを読み込んでから再実行するか、-ExtensionId で32文字のIDを指定してください。' }
}
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw '拡張IDはaからpまでの英字32文字です。' }
$origin='chrome-extension://'+$ExtensionId+'/'
$views=@([Microsoft.Win32.RegistryView]::Registry32)
if ([Environment]::Is64BitOperatingSystem) { $views+= [Microsoft.Win32.RegistryView]::Registry64 }
function Read-Registration([string]$Subkey=$registrySubkey) {
 foreach ($view in $views) {
  $baseKey=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,$view)
  try {
   $key=$baseKey.OpenSubKey($Subkey)
   try { [pscustomobject]@{View=[string]$view;Manifest=if($key){[string]$key.GetValue('')}else{$null}} }
   finally { if($key){$key.Dispose()} }
  } finally { $baseKey.Dispose() }
 }
}
function Get-Diagnostics {
 $manifest=$null;$config=$null
 if(Test-Path -LiteralPath $manifestPath){$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json}
 $configPath=Join-Path $installRoot 'host-config.json'
 if(Test-Path -LiteralPath $configPath){$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json}
 $registrations=@(Read-Registration)
 $v2=$null
 if(Test-Path -LiteralPath $v2ManifestPath){$v2=Get-Content -LiteralPath $v2ManifestPath -Raw|ConvertFrom-Json}
 $v2Registrations=@(Read-Registration $v2RegistrySubkey)
 $origins=@($config.origins)+@($config.origin)
 [pscustomobject]@{
  ExtensionId=$ExtensionId;DetectedIds=$detectedIds;ExtensionPath=$extensionPath
  ManifestPath=$manifestPath;Registrations=$registrations
  RegistrationsMatch=(@($registrations|Where-Object {$_.Manifest -ne $manifestPath}).Count -eq 0)
  V2RegistrationsMatch=(@($v2Registrations|Where-Object {$_.Manifest -ne $v2ManifestPath}).Count -eq 0)
  V2ManifestMatches=($v2.name -eq 'jp.osreadingguide.chatgpt.v2' -and $v2.path -eq (Join-Path $installRoot 'launch.cmd') -and @($v2.allowed_origins) -contains $origin)
  HostNameMatches=($manifest.name -eq 'jp.osreadingguide.chatgpt')
  AllowedOriginMatches=(@($manifest.allowed_origins) -contains $origin)
  HostOriginMatches=($origins -contains $origin)
  LauncherMatches=($manifest.path -eq (Join-Path $installRoot 'launch.cmd'))
  FilesExist=(@('node.exe','host.cjs','accounts.cjs','protect.ps1','ai.js','diagram.js','launch.cmd')|Where-Object {!(Test-Path -LiteralPath (Join-Path $installRoot $_) -PathType Leaf)}).Count -eq 0
 }
}
if ($DiagnoseOnly) { Get-Diagnostics|ConvertTo-Json -Depth 5; exit 0 }
# Only program and registration files are updated. credentials.dpapi and Chrome storage are never read or replaced.
New-Item -ItemType Directory -Path $installRoot -Force|Out-Null
$origins=@($origin)
if(Test-Path -LiteralPath $manifestPath){
 try { $old=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json; $origins+=@($old.allowed_origins|Where-Object {$_ -match '^chrome-extension://[a-p]{32}/$'}) }catch{}
}
$origins=@($origins|Sort-Object -Unique)
$copies=@(@($NodePath,'node.exe'),@((Join-Path $projectRoot 'native/host.cjs'),'host.cjs'),@((Join-Path $projectRoot 'native/accounts.cjs'),'accounts.cjs'),@((Join-Path $projectRoot 'native/protect.ps1'),'protect.ps1'),@((Join-Path $projectRoot 'extension/ai.js'),'ai.js'),@((Join-Path $projectRoot 'extension/diagram.js'),'diagram.js'))
foreach($copy in $copies){
 $destination=Join-Path $installRoot $copy[1]
 if((Test-Path -LiteralPath $destination) -and ((Get-FileHash -LiteralPath $copy[0]).Hash -eq (Get-FileHash -LiteralPath $destination).Hash)){continue}
 Copy-Item -LiteralPath $copy[0] -Destination $destination -Force
}
[IO.File]::WriteAllText((Join-Path $installRoot 'host-config.json'),(@{origin=$origin;origins=$origins}|ConvertTo-Json),$utf8)
$launcher=Join-Path $installRoot 'launch.cmd'
[IO.File]::WriteAllText($launcher,"@echo off`r`n`"%~dp0node.exe`" `"%~dp0host.cjs`" %*`r`n",[Text.Encoding]::ASCII)
[IO.File]::WriteAllText($manifestPath,(@{name='jp.osreadingguide.chatgpt';description='OS Reading Guide ChatGPT helper';path=$launcher;type='stdio';allowed_origins=$origins}|ConvertTo-Json),$utf8)
[IO.File]::WriteAllText($v2ManifestPath,(@{name='jp.osreadingguide.chatgpt.v2';description='OS Reading Guide account-aware helper';path=$launcher;type='stdio';allowed_origins=$origins}|ConvertTo-Json),$utf8)
foreach($view in $views){
 $baseKey=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,$view)
 try { $v2Key=$baseKey.CreateSubKey($v2RegistrySubkey);try{$v2Key.SetValue('',$v2ManifestPath,[Microsoft.Win32.RegistryValueKind]::String)}finally{$v2Key.Dispose()};$key=$baseKey.CreateSubKey($registrySubkey); try{$key.SetValue('',$manifestPath,[Microsoft.Win32.RegistryValueKind]::String)}finally{$key.Dispose()} }finally{$baseKey.Dispose()}
}
$report=Get-Diagnostics
$report|ConvertTo-Json -Depth 5
if(!$report.V2RegistrationsMatch -or !$report.V2ManifestMatches -or !$report.RegistrationsMatch -or !$report.HostNameMatches -or !$report.AllowedOriginMatches -or !$report.HostOriginMatches -or !$report.LauncherMatches -or !$report.FilesExist){throw '登録後の整合性検査に失敗しました。上の診断結果を確認してください。'}
Write-Output '補助プログラムを登録・検証しました。AI設定で「接続を再確認」を押してください。辞書・認証・ログイン状態は維持しています。'




