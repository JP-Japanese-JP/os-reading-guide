$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundleRoot = Join-Path $projectRoot 'dist/os-reading-guide'
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null
foreach ($name in @('extension', 'data', 'scripts', 'research', 'native')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $bundleRoot -Recurse -Force
}
$testTarget = Join-Path $bundleRoot 'tests'
New-Item -ItemType Directory -Path $testTarget -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'tests') -File -Filter '*.cjs' | Copy-Item -Destination $testTarget -Force
foreach ($name in @('README.md', 'INSTALL.html', 'TEST-REPORT.md', 'NOTICE.md', 'LICENSE', 'package.json', 'setup-helper.cmd')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $bundleRoot -Force
}
$zipPath = Join-Path $projectRoot 'dist/os-reading-guide.zip'
Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $zipPath -Force
Get-Item -LiteralPath $zipPath | Select-Object FullName, Length

