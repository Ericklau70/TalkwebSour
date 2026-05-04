# 拉取 msitarzewski/agency-agents 到 third_party/agency-agents（无 engineering 目录时）
# 由 SourWins.bat 调用；需网络。优先 git clone，失败则用 GitHub main.zip。
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Vendor = Join-Path $Root 'third_party\agency-agents'
$Engineering = Join-Path $Vendor 'engineering'

if (Test-Path $Engineering) {
  Write-Host 'Agency upstream already present (third_party\agency-agents), skip download.'
  exit 0
}

Write-Host 'Fetching agency-agents from GitHub...'
$Parent = Join-Path $Root 'third_party'
if (-not (Test-Path $Parent)) {
  New-Item -ItemType Directory -Path $Parent | Out-Null
}
if (Test-Path $Vendor) {
  Remove-Item -Recurse -Force $Vendor
}

$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  try {
    & git clone --depth 1 'https://github.com/msitarzewski/agency-agents.git' $Vendor 2>&1 | Out-Host
    if ($LASTEXITCODE -eq 0 -and (Test-Path $Engineering)) {
      Write-Host 'git clone OK.'
      exit 0
    }
  } catch {}
  if (Test-Path $Vendor) {
    Remove-Item -Recurse -Force $Vendor
  }
}

$zipUrl = 'https://github.com/msitarzewski/agency-agents/archive/refs/heads/main.zip'
$zip = Join-Path $env:TEMP 'agency-agents-main.zip'
Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing
$extract = Join-Path $env:TEMP ('agency-expand-' + [Guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $extract | Out-Null
try {
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $expanded = Join-Path $extract 'agency-agents-main'
  if (-not (Test-Path $expanded)) {
    throw 'ZIP did not contain agency-agents-main'
  }
  Move-Item $expanded $Vendor
  Write-Host 'ZIP extract OK.'
  exit 0
} finally {
  Remove-Item -Force $zip -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
}
