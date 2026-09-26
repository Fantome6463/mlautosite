<#
.SYNOPSIS
  Маршрутник из консоли (то же, что кнопки в окне).

.EXAMPLE
  marshrutnik.bat status       # состояние: подключён ли, DNS, отвечает ли сайт, версия
  marshrutnik.bat connect      # подключить сайт к Caddy CRM (или переподключить)
  marshrutnik.bat update       # обновить сайт из GitHub
  marshrutnik.bat disconnect   # отключить сайт
  marshrutnik.bat crm D:\New_Lab_3D   # указать папку CRM вручную
#>
param(
    [Parameter(Position = 0)][string]$Command = "status",
    [Parameter(Position = 1)][string]$Value = ""
)

. (Join-Path $PSScriptRoot "lib.ps1")

try {
    switch ($Command.ToLower()) {
        "connect" { Connect-Site }
        "disconnect" { Disconnect-Site }
        "update" { Update-Site }
        "crm" { Set-CrmRoot $Value; Write-Log "Папка CRM: $Value" "ok" }
        "status" {
            $s = Get-SiteStatus
            Write-Log "Маршрутник - $($s.Domain)" "step"
            Write-Log ("Сайт       : " + $(if ($s.Online) { "https://$($s.Domain) отвечает" } else { "не отвечает" })) $(if ($s.Online) { "ok" } else { "warn" })
            Write-Log ("По IP      : " + $(if ($s.PreviewUrl) { "$($s.PreviewUrl)" + $(if ($s.PreviewOnline) { " открывается" } else { " не отвечает" }) } else { "после connect" })) $(if ($s.PreviewOnline) { "ok" } else { "warn" })
            Write-Log ("CRM        : " + $(if ($s.Crm) { $s.Crm.Root } else { "не найдена" })) $(if ($s.Crm) { "ok" } else { "err" })
            Write-Log ("Подключён  : " + $(if ($s.Connected) { "да" } else { "нет" })) $(if ($s.Connected) { "ok" } else { "warn" })
            Write-Log ("Caddy      : " + $(if ($s.CaddyRunning) { "запущен" } else { "не запущен" })) $(if ($s.CaddyRunning) { "ok" } else { "warn" })
            Write-Log ("DNS        : " + $(if ($s.DnsIp) { "$($s.DnsIp) (сервер: $($s.ExpectedIp))" } else { "записи A пока нет" })) $(if ($s.DnsIp -and $s.DnsIp -eq $s.ExpectedIp) { "ok" } else { "warn" })
            $v = $s.Version
            if ($v.isRepo) { Write-Log ("Версия     : $($v.head) от $($v.date), обновлений: $($v.behind)") }
        }
        default { throw "Неизвестная команда '$Command'. Есть: status, connect, update, disconnect, crm <папка>." }
    }
}
catch {
    Write-Log $_.Exception.Message "err"
    exit 1
}
