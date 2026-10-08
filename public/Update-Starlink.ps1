# Run this file from your existing Starlink Ghana extension folder using PowerShell.
$ErrorActionPreference = 'Stop'
$InstallDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $InstallDir 'manifest.json'))) { throw 'Run this helper inside your existing extension folder.' }
$WorkDir = Join-Path ([IO.Path]::GetTempPath()) ('starlink-update-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $WorkDir | Out-Null
try {
  $BaseUrl = 'https://github.com/hayalows/starlink/releases/latest/download/starlink-ghana-monitor-chrome.zip'
  $ZipPath = Join-Path $WorkDir 'update.zip'
  Write-Host 'Downloading Starlink Ghana Monitor. Close its dashboard before continuing.'
  Invoke-WebRequest -Uri $BaseUrl -OutFile $ZipPath -UseBasicParsing
  $ChecksumPath = Join-Path $WorkDir 'checksum.txt'
  Invoke-WebRequest -Uri "$BaseUrl.sha256" -OutFile $ChecksumPath -UseBasicParsing
  $Checksum = Get-Content -LiteralPath $ChecksumPath -Raw
  $ExpectedHash = ($Checksum.Trim() -split '\s+')[0]
  if ($ExpectedHash -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash $ZipPath -Algorithm SHA256).Hash -ne $ExpectedHash) { throw 'Checksum mismatch. Nothing was installed. Retry later.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    foreach ($Entry in $Archive.Entries) {
      if ($Entry.FullName -match '(^[/\\]|(^|[/\\])\.\.([/\\]|$)|:)' -or (($Entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Unsafe archive path. Update stopped.' }
    }
  } finally { $Archive.Dispose() }
  $PackageDir = Join-Path $WorkDir 'package'
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $PackageDir
  if (-not (Test-Path (Join-Path $PackageDir 'manifest.json'))) { throw 'Missing extension manifest.' }
  $BackupDir = "$InstallDir-files-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item -LiteralPath $InstallDir -Destination $BackupDir -Recurse
  try { Copy-Item -Path (Join-Path $PackageDir '*') -Destination $InstallDir -Recurse -Force }
  catch { Copy-Item -Path (Join-Path $BackupDir '*') -Destination $InstallDir -Recurse -Force; throw 'Copy failed. Previous files restored. Close Chrome and retry.' }
  Write-Host "Updated files. Old files are in: $BackupDir"
  Write-Host 'Click Reload on your existing extension at chrome://extensions. Do not remove it.'
} finally { Remove-Item -LiteralPath $WorkDir -Recurse -Force }
