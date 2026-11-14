$ErrorActionPreference = 'Stop'
# Node sends and receives UTF-8 bytes over redirected pipes.
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Security
$inputText = [Console]::In.ReadToEnd()
if ($args[0] -eq 'protect') {
  $bytes = [Text.Encoding]::UTF8.GetBytes($inputText)
  $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Convert]::ToBase64String($protected))
} elseif ($args[0] -eq 'unprotect') {
  $bytes = [Convert]::FromBase64String($inputText)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))
} else { exit 1 }
