# Publish the worker: reads secrets from worker\.dev.vars, uploads them, deploys.
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
$ErrorActionPreference = 'Stop'

$file = Join-Path $PSScriptRoot '.dev.vars'
if (-not (Test-Path -LiteralPath $file)) { Write-Host "Missing file: $file"; exit 1 }

$vars = @{}
foreach ($line in (Get-Content -LiteralPath $file)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
    if ($k -and $v) { $vars[$k] = $v }
}

if (-not $vars.ContainsKey('BOT_TOKEN') -or -not $vars['BOT_TOKEN']) {
    Write-Host 'BOT_TOKEN is empty in worker\.dev.vars'; exit 1
}

$tmp = Join-Path $env:TEMP 'moydom-secrets.json'
$obj = @{}
foreach ($k in $vars.Keys) { $obj[$k] = $vars[$k] }
[IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))

Push-Location $PSScriptRoot
try {
    # Если wrangler установлен локально (node_modules) — используем его, иначе npx
    $localWr = Join-Path $PSScriptRoot 'node_modules\.bin\wrangler.cmd'
    function Invoke-Wrangler([string[]]$wrArgs) {
        if (Test-Path -LiteralPath $localWr) { & $localWr @wrArgs } else { & npx --yes wrangler @wrArgs }
    }

    Write-Host '[1/3] Uploading secrets...'
    Invoke-Wrangler @('secret', 'bulk', $tmp)
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[1/3] bulk failed, trying one by one...'
        foreach ($k in $vars.Keys) {
            $vars[$k] | Invoke-Wrangler @('secret', 'put', $k)
            if ($LASTEXITCODE -ne 0) { throw "secret put failed for $k" }
        }
    }
    Write-Host '[2/3] Deploying worker...'
    Invoke-Wrangler @('deploy')
    if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy failed' }
    Write-Host '[3/3] Done.'
    Write-Host ''
    Write-Host 'Open in browser:'
    Write-Host ('  https://moydom-leads.sergeyberlov20.workers.dev/api/tg/setup?key=' + $vars['WEBHOOK_SECRET'])
    Write-Host ('  https://moydom-leads.sergeyberlov20.workers.dev/api/tg/test?key=' + $vars['WEBHOOK_SECRET'])
    Write-Host ('  https://moydom-leads.sergeyberlov20.workers.dev/api/tg/diag?key=' + $vars['WEBHOOK_SECRET'])
}
finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Pop-Location
}
