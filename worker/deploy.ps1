# Публикация воркера: берёт секреты из worker\.dev.vars и деплоит.
# Запуск:  cd C:\Users\nice\Desktop\moy-dom-repo\worker
#          powershell -ExecutionPolicy Bypass -File .\deploy.ps1
$ErrorActionPreference = 'Stop'

$file = Join-Path $PSScriptRoot '.dev.vars'
if (-not (Test-Path $file)) {
    Write-Host "Нет файла $file — создайте его и впишите BOT_TOKEN." -ForegroundColor Red
    exit 1
}

$vars = [ordered]@{}
Get-Content -LiteralPath $file -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    if ($k) { $vars[$k] = $v }
}

if (-not $vars['BOT_TOKEN']) {
    Write-Host 'Впишите BOT_TOKEN в worker\.dev.vars (строка "BOT_TOKEN=...")' -ForegroundColor Red
    exit 1
}

$json = ($vars.GetEnumerator() | ForEach-Object { '"' + $_.Key + '":"' + ($_.Value -replace '\\', '\\' -replace '"', '\"') + '"' }) -join ','
$json = '{' + $json + '}'
$tmp = Join-Path $env:TEMP 'moydom-secrets.json'
[IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host '→ Загружаю секреты в Cloudflare...' -ForegroundColor Cyan
Push-Location $PSScriptRoot
try {
    & npx wrangler secret bulk $tmp
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  bulk не сработал — пробую по одному...' -ForegroundColor Yellow
        foreach ($k in $vars.Keys) {
            if ($vars[$k]) {
                $vars[$k] | & npx wrangler secret put $k
                if ($LASTEXITCODE -ne 0) { throw "Не удалось записать секрет $k" }
            }
        }
    }
    Write-Host '→ Публикую воркер...' -ForegroundColor Cyan
    & npx wrangler deploy
    if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy завершился с ошибкой' }
    Write-Host ''
    Write-Host 'Готово. Теперь откройте в браузере:' -ForegroundColor Green
    Write-Host ('  https://moydom-leads.sergeyberlov20.workers.dev/api/tg/setup?key=' + $vars['WEBHOOK_SECRET'])
    Write-Host ('  https://moydom-leads.sergeyberlov20.workers.dev/api/tg/test?key=' + $vars['WEBHOOK_SECRET'])
}
finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Pop-Location
}
