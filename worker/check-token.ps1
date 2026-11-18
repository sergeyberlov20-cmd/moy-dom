# check-token.ps1 - checks the GitHub token from worker\.dev.vars
# Usage:  powershell -ExecutionPolicy Bypass -File .\check-token.ps1
# ASCII only on purpose: PowerShell 5.1 reads .ps1 as ANSI without BOM.

param([string]$Token, [string]$Repo)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$varsPath = Join-Path $here '.dev.vars'
$tomlPath = Join-Path $here 'wrangler.toml'

function Read-Vars($path) {
  $out = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $out }
  foreach ($line in [IO.File]::ReadAllLines($path)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $out[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  return $out
}

if (-not $Token) {
  $v = Read-Vars $varsPath
  $Token = $v['GITHUB_TOKEN']
}
if (-not $Repo) {
  if (Test-Path -LiteralPath $tomlPath) {
    $t = Get-Content -LiteralPath $tomlPath -Raw
    if ($t -match 'GITHUB_REPO\s*=\s*"([^"]+)"') { $Repo = $matches[1] }
  }
}

if (-not $Token) { Write-Host 'FAIL  no GITHUB_TOKEN in .dev.vars and no -Token given'; exit 1 }
if (-not $Repo)  { Write-Host 'FAIL  no GITHUB_REPO in wrangler.toml and no -Repo given'; exit 1 }

Write-Host ('Token: ' + $Token.Substring(0, [Math]::Min(4, $Token.Length)) + '... length ' + $Token.Length)
Write-Host ('Repo : ' + $Repo)
Write-Host ''

$H = @{
  Authorization = 'Bearer ' + $Token
  'User-Agent'  = 'moydom-token-check'
  Accept        = 'application/vnd.github+json'
}

function Get-Json($url) {
  try {
    $r = Invoke-RestMethod -Uri $url -Headers $H -Method Get -UseBasicParsing -TimeoutSec 30
    return @{ ok = $true; status = 200; data = $r }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $msg = ''
    try { $msg = $_.ErrorDetails.Message } catch { $msg = $_.Exception.Message }
    return @{ ok = $false; status = $code; data = $msg }
  }
}

# 1. token is valid at all
$me = Get-Json 'https://api.github.com/user'
if ($me.ok) { Write-Host ('PASS  token valid, account: ' + $me.data.login) }
else { Write-Host ('FAIL  token rejected (HTTP ' + $me.status + ') ' + $me.data); exit 1 }

# 2. repo visible + advertised permissions
$rp = Get-Json ('https://api.github.com/repos/' + $Repo)
if ($rp.ok) {
  Write-Host ('PASS  repo visible: ' + $rp.data.full_name + ', default branch: ' + $rp.data.default_branch)
} else {
  Write-Host ('FAIL  repo not visible (HTTP ' + $rp.status + ') ' + $rp.data)
  Write-Host '      For fine-grained token: Repository access must include this repo.'
  exit 1
}

# 3. read a real file
$rd = Get-Json ('https://api.github.com/repos/' + $Repo + '/contents/js/data.json')
if ($rd.ok) { Write-Host ('PASS  read contents (js/data.json, sha ' + $rd.data.sha.Substring(0, 8) + ')') }
else { Write-Host ('FAIL  cannot read file (HTTP ' + $rd.status + ') ' + $rd.data) }

# 4. real write test into _diag/write-test.txt
$path = '_diag/write-test.txt'
$url = 'https://api.github.com/repos/' + $Repo + '/contents/' + $path
$body = @{
  message = 'token check'
  content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(('ok ' + (Get-Date).ToString('s'))))
  branch  = $rp.data.default_branch
}
$existing = Get-Json $url
if ($existing.ok) { $body.sha = $existing.data.sha }

$writeOk = $false
try {
  $r = Invoke-RestMethod -Uri $url -Headers $H -Method Put -UseBasicParsing -TimeoutSec 30 `
        -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress)
  Write-Host ('PASS  write works (commit ' + $r.commit.sha.Substring(0, 8) + ') - token can publish')
  $writeOk = $true
} catch {
  $code = 0
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  $msg = ''
  try { $msg = $_.ErrorDetails.Message } catch { $msg = $_.Exception.Message }
  Write-Host ('FAIL  write blocked (HTTP ' + $code + ') ' + $msg)
  if ($code -eq 403) {
    Write-Host '      Fine-grained token: Repository permissions -> Contents = Read and write.'
    Write-Host '      Classic token: scope "repo" (or "public_repo" for public repositories) must be checked.'
  }
  if ($code -eq 404) {
    Write-Host '      For fine-grained token: Repository access must include ' + $Repo + '.'
  }
}

# 5. clean up our test file so the repo stays tidy
if ($writeOk) {
  try {
    $cur = Invoke-RestMethod -Uri $url -Headers $H -Method Get -UseBasicParsing -TimeoutSec 30
    $del = @{ message = 'token check cleanup'; sha = $cur.sha; branch = $rp.data.default_branch }
    Invoke-RestMethod -Uri $url -Headers $H -Method Delete -UseBasicParsing -TimeoutSec 30 `
      -ContentType 'application/json' -Body ($del | ConvertTo-Json -Compress) | Out-Null
    Write-Host 'PASS  test file removed'
  } catch {
    Write-Host 'NOTE  could not remove _diag/write-test.txt (harmless, delete manually)'
  }
}

Write-Host ''
if ($writeOk) { Write-Host 'RESULT: OK - token has read and write access'; exit 0 }
Write-Host 'RESULT: NO WRITE ACCESS - fix permissions and run this again'
exit 2
