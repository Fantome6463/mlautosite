# Обновить сайт на сервере до последней версии из GitHub.
# Запуск: правой кнопкой -> «Выполнить с помощью PowerShell»
$site = 'C:\sites\marshrutnik'
Set-Location $site
git pull
Write-Host 'Готово: сайт обновлён.' -ForegroundColor Green
Start-Sleep 3
