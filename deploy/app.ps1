<#
.SYNOPSIS
  Окно управления Маршрутником (запускается через Marshrutnik.exe / marshrutnik.bat).
  Показывает, работает ли сайт, подключает его к Caddy CRM, обновляет из GitHub.

.NOTES
  Сайт статический: отдельного процесса у него нет, его раздаёт Caddy CRM «Лаборатория 3Д».
  Закрытие окна на работу сайта не влияет. Долгие проверки идут в фоне - окно не зависает.
#>
. (Join-Path $PSScriptRoot "lib.ps1")
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

# ---------------------------------------------------------------- палитра
function New-Color([int]$R, [int]$G, [int]$B) { return [Drawing.Color]::FromArgb($R, $G, $B) }
$ColBg = New-Color 16 15 24
$ColCard = New-Color 26 24 38
$ColLine = New-Color 45 41 64
$ColInk = New-Color 236 233 247
$ColMuted = New-Color 161 156 186
$ColAccent = New-Color 124 87 240
$ColAccentHi = New-Color 146 114 248
$ColGreen = New-Color 79 209 143
$ColYellow = New-Color 247 185 85
$ColRed = New-Color 240 110 110

$FontUi = New-Object Drawing.Font("Segoe UI", 10)
$FontBold = New-Object Drawing.Font("Segoe UI Semibold", 10)
$FontTitle = New-Object Drawing.Font("Segoe UI Semibold", 17)
$FontMono = New-Object Drawing.Font("Consolas", 9.5)

# ---------------------------------------------------------------- окно
$form = New-Object Windows.Forms.Form
$form.Text = "Маршрутник - управление сайтом"
$form.StartPosition = "CenterScreen"
$form.ClientSize = New-Object Drawing.Size(760, 600)
$form.MinimumSize = New-Object Drawing.Size(640, 520)
$form.BackColor = $ColBg
$form.ForeColor = $ColInk
$form.Font = $FontUi
$icon = Join-Path $PSScriptRoot "app.ico"
if (Test-Path $icon) { $form.Icon = New-Object Drawing.Icon($icon) }

# шапка
$header = New-Object Windows.Forms.Panel
$header.Dock = "Top"; $header.Height = 86; $header.BackColor = $ColAccent
$header.Add_Paint({
    param($s, $e)
    $rect = $s.ClientRectangle
    $brush = New-Object Drawing.Drawing2D.LinearGradientBrush($rect, (New-Color 124 58 237), (New-Color 59 91 219), 0.0)
    $e.Graphics.FillRectangle($brush, $rect); $brush.Dispose()
})
$title = New-Object Windows.Forms.Label
$title.Text = "Маршрутник"; $title.Font = $FontTitle; $title.ForeColor = [Drawing.Color]::White
$title.BackColor = [Drawing.Color]::Transparent; $title.AutoSize = $true; $title.Location = New-Object Drawing.Point(22, 14)
$subtitle = New-Object Windows.Forms.Label
$subtitle.Text = "управление сайтом"; $subtitle.ForeColor = (New-Color 225 215 255)
$subtitle.BackColor = [Drawing.Color]::Transparent; $subtitle.AutoSize = $true; $subtitle.Location = New-Object Drawing.Point(25, 52)
$header.Controls.AddRange(@($title, $subtitle))

# карточка статуса
$card = New-Object Windows.Forms.TableLayoutPanel
$card.Dock = "Top"; $card.AutoSize = $true; $card.AutoSizeMode = "GrowAndShrink"; $card.BackColor = $ColCard
$card.Padding = New-Object Windows.Forms.Padding(20, 14, 20, 10)
$card.ColumnCount = 2; $card.RowCount = 5
[void]$card.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle("Absolute", 150)))
[void]$card.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle("Percent", 100)))

$script:StatusLabels = @{}
foreach ($row in @(@("site", "Сайт"), @("ip", "По IP"), @("crm", "CRM и Caddy"), @("dns", "Домен (DNS)"), @("ver", "Версия"), @("hint", ""))) {
    $name = New-Object Windows.Forms.Label
    $name.Text = $row[1]; $name.ForeColor = $ColMuted; $name.AutoSize = $true; $name.Margin = New-Object Windows.Forms.Padding(0, 5, 0, 5)
    $value = New-Object Windows.Forms.Label
    $value.Text = "проверяю..."; $value.ForeColor = $ColMuted; $value.AutoSize = $true; $value.Font = $FontBold
    $value.MaximumSize = New-Object Drawing.Size(560, 0); $value.Margin = New-Object Windows.Forms.Padding(0, 5, 0, 5)
    $card.Controls.Add($name); $card.Controls.Add($value)
    $script:StatusLabels[$row[0]] = $value
}
$script:StatusLabels["hint"].Font = $FontUi

# кнопки
$bar = New-Object Windows.Forms.FlowLayoutPanel
$bar.Dock = "Top"; $bar.Height = 64; $bar.BackColor = $ColBg
$bar.Padding = New-Object Windows.Forms.Padding(16, 14, 16, 8)

function New-Button([string]$Text, [bool]$Primary = $false) {
    $b = New-Object Windows.Forms.Button
    $b.Text = $Text; $b.AutoSize = $true; $b.Height = 38
    $b.Padding = New-Object Windows.Forms.Padding(12, 2, 12, 2)
    $b.Margin = New-Object Windows.Forms.Padding(0, 0, 10, 0)
    $b.FlatStyle = "Flat"; $b.Cursor = "Hand"; $b.Font = $FontBold
    $b.FlatAppearance.BorderSize = 1
    if ($Primary) {
        $b.BackColor = $ColAccent; $b.ForeColor = [Drawing.Color]::White
        $b.FlatAppearance.BorderColor = $ColAccent; $b.FlatAppearance.MouseOverBackColor = $ColAccentHi
    }
    else {
        $b.BackColor = $ColCard; $b.ForeColor = $ColInk
        $b.FlatAppearance.BorderColor = $ColLine; $b.FlatAppearance.MouseOverBackColor = $ColLine
    }
    return $b
}
$btnConnect = New-Button "Подключить сайт" $true
$btnUpdate = New-Button "Обновить сайт"
$btnOpen = New-Button "Открыть сайт"
$btnCheck = New-Button "Проверить"
$btnMore = New-Button "..."
$bar.Controls.AddRange(@($btnConnect, $btnUpdate, $btnOpen, $btnCheck, $btnMore))

$menu = New-Object Windows.Forms.ContextMenuStrip
$miCrm = $menu.Items.Add("Указать папку CRM...")
$miDisconnect = $menu.Items.Add("Отключить сайт")
$miFolder = $menu.Items.Add("Открыть папку сайта")
$miIp = $menu.Items.Add("Скопировать адрес по IP")

# журнал
$log = New-Object Windows.Forms.RichTextBox
$log.Dock = "Fill"; $log.ReadOnly = $true; $log.BorderStyle = "None"
$log.BackColor = (New-Color 12 11 18); $log.ForeColor = $ColMuted; $log.Font = $FontMono
$logWrap = New-Object Windows.Forms.Panel
$logWrap.Dock = "Fill"; $logWrap.Padding = New-Object Windows.Forms.Padding(16, 4, 16, 16); $logWrap.BackColor = $ColBg
$logWrap.Controls.Add($log)

# порядок Dock: сначала Fill, потом верхние снизу вверх
$form.Controls.Add($logWrap)
$form.Controls.Add($bar)
$form.Controls.Add($card)
$form.Controls.Add($header)

function Add-LogLine([string]$Text, [string]$Kind = "info") {
    $color = switch ($Kind) { "ok" { $ColGreen } "warn" { $ColYellow } "err" { $ColRed } "step" { $ColAccentHi } default { $ColMuted } }
    $log.SelectionStart = $log.TextLength
    $log.SelectionColor = $color
    $prefix = if ($Kind -eq "step") { "`n> " } else { "  " }
    $log.AppendText($prefix + $Text + "`n")
    $log.ScrollToCaret()
}
$script:LogSink = { param([string]$Text, [string]$Kind) Add-LogLine $Text $Kind }

# ---------------------------------------------------------------- фоновые задачи
# Проверки (DNS, HTTPS, git fetch) и действия идут в отдельном потоке PowerShell,
# сообщения приходят через очередь, таймер переносит их в окно.
$script:Queue = [Collections.Concurrent.ConcurrentQueue[object]]::new()
$script:Job = $null
$script:OnDone = $null
$libPath = Join-Path $PSScriptRoot "lib.ps1"

function Start-Background([string]$Body, [scriptblock]$OnDone) {
    if ($script:Job) { return }
    foreach ($b in @($btnConnect, $btnUpdate, $btnCheck, $btnMore)) { $b.Enabled = $false }
    $form.Cursor = "AppStarting"
    $ps = [powershell]::Create()
    $script_ = @"
param(`$lib, `$queue)
. `$lib
`$script:LogSink = { param([string]`$t, [string]`$k) `$queue.Enqueue(@('log', `$t, `$k)) }
try { `$result = & { $Body }; `$queue.Enqueue(@('result', `$result)) }
catch { `$queue.Enqueue(@('log', `$_.Exception.Message, 'err')); `$queue.Enqueue(@('result', `$null)) }
"@
    [void]$ps.AddScript($script_).AddArgument($libPath).AddArgument($script:Queue)
    $script:Job = @{ Ps = $ps; Handle = $ps.BeginInvoke() }
    $script:OnDone = $OnDone
}

$timer = New-Object Windows.Forms.Timer
$timer.Interval = 150
$timer.Add_Tick({
    $item = $null
    while ($script:Queue.TryDequeue([ref]$item)) {
        if ($item[0] -eq "log") { Add-LogLine $item[1] $item[2] }
        elseif ($item[0] -eq "result") { $script:LastResult = $item[1] }
    }
    if ($script:Job -and $script:Job.Handle.IsCompleted) {
        try { [void]$script:Job.Ps.EndInvoke($script:Job.Handle) } catch { }
        $script:Job.Ps.Dispose()
        $script:Job = $null
        foreach ($b in @($btnConnect, $btnUpdate, $btnCheck, $btnMore)) { $b.Enabled = $true }
        $form.Cursor = "Default"
        $done = $script:OnDone; $script:OnDone = $null
        if ($done) { & $done $script:LastResult }
    }
})

# ---------------------------------------------------------------- статус
function Set-Status([string]$Key, [string]$Text, $Color) {
    $script:StatusLabels[$Key].Text = $Text
    $script:StatusLabels[$Key].ForeColor = $Color
}

function Show-Status($s) {
    if (-not $s) { return }
    $script:Status = $s
    if ($s.Online) { Set-Status "site" ("● https://$($s.Domain) - работает") $ColGreen }
    elseif ($s.Connected) { Set-Status "site" ("● подключён, но пока не отвечает") $ColYellow }
    else { Set-Status "site" "● не подключён" $ColRed }

    if (-not $s.PreviewUrl) { Set-Status "ip" "появится после «Подключить сайт»" $ColMuted }
    elseif ($s.PreviewOnline) { Set-Status "ip" "$($s.PreviewUrl) - открывается" $ColGreen }
    else { Set-Status "ip" "$($s.PreviewUrl) - не отвечает (Caddy запущен?)" $ColYellow }

    if (-not $s.Crm) { Set-Status "crm" "CRM не найдена - укажите папку через «...»" $ColRed }
    elseif (-not $s.CaddyRunning) { Set-Status "crm" "$($s.Crm.Root) - Caddy не запущен (запустите CRM)" $ColYellow }
    else { Set-Status "crm" "$($s.Crm.Root) - Caddy работает" $ColGreen }

    if (-not $s.DnsIp) { Set-Status "dns" "записи A для $($s.Domain) пока нет" $ColRed }
    elseif ($s.ExpectedIp -and $s.DnsIp -ne $s.ExpectedIp) { Set-Status "dns" "$($s.Domain) -> $($s.DnsIp), а у сервера $($s.ExpectedIp)" $ColYellow }
    else { Set-Status "dns" "$($s.Domain) -> $($s.DnsIp)" $ColGreen }

    $v = $s.Version
    if (-not $v.isRepo) { Set-Status "ver" "папка не из git - обновление недоступно" $ColYellow }
    elseif ($v.behind -gt 0) { Set-Status "ver" ("$($v.date) - доступно обновлений: $($v.behind)") $ColYellow }
    elseif ($v.error) { Set-Status "ver" ("$($v.date) - не удалось проверить обновления") $ColYellow }
    else { Set-Status "ver" ("$($v.date) - последняя версия") $ColGreen }

    # подсказка: что сделать дальше
    $hint = ""
    if (-not $s.Crm) { $hint = "Нажмите «...» -> «Указать папку CRM» и выберите папку New_Lab_3D." }
    elseif (-not $s.Connected) { $hint = "Нажмите «Подключить сайт» - сайт сразу откроется по IP, а по домену - как только заработает DNS." }
    elseif (-not $s.DnsIp) { $hint = "Пока домен не заработал, сайт открывается по IP. В REG.RU добавьте записи A для @ и www -> $($s.ExpectedIp), потом снова «Подключить сайт»." }
    elseif (-not $s.Online -and $s.DnsIp -eq $s.ExpectedIp) { $hint = "Сертификат может выпускаться 1-2 минуты. Если долго - проверьте, что порты 80 и 443 открыты. С самого сервера сайт иногда не открывается из-за роутера - проверьте с телефона." }
    elseif ($v.behind -gt 0) { $hint = "Нажмите «Обновить сайт»: " + (($v.commits | Select-Object -First 3) -join "; ") }
    Set-Status "hint" $hint $ColMuted
    $btnConnect.Text = if ($s.Connected) { "Переподключить" } else { "Подключить сайт" }
    $miDisconnect.Enabled = $s.Connected
}

function Start-Check {
    foreach ($k in @("site", "ip", "crm", "dns", "ver")) { Set-Status $k "проверяю..." $ColMuted }
    Start-Background "Get-SiteStatus" { param($r) Show-Status $r }
}

# ---------------------------------------------------------------- действия
$btnCheck.Add_Click({ Start-Check })
$btnConnect.Add_Click({ Start-Background "Connect-Site" { Start-Check } })
$btnUpdate.Add_Click({ Start-Background "Update-Site" { Start-Check } })
$btnOpen.Add_Click({
    # пока домен не отвечает, открываем просмотр по IP
    if ($script:Status -and -not $script:Status.Online -and $script:Status.PreviewUrl) { Start-Process "$($script:Status.PreviewUrl)/"; return }
    $domain = if ($script:Status) { $script:Status.Ascii } else { ConvertTo-AsciiDomain (Read-Settings).domain }
    Start-Process "https://$domain/"
})
$btnMore.Add_Click({ $menu.Show($btnMore, (New-Object Drawing.Point(0, $btnMore.Height))) })
$miFolder.Add_Click({ Start-Process explorer.exe $script:Root })
$miIp.Add_Click({
    if ($script:Status -and $script:Status.PreviewUrl) { [Windows.Forms.Clipboard]::SetText($script:Status.PreviewUrl); Add-LogLine "Скопировано: $($script:Status.PreviewUrl)" "ok" }
    else { Add-LogLine "Адрес по IP появится после «Подключить сайт»." "warn" }
})
$miDisconnect.Add_Click({
    $answer = [Windows.Forms.MessageBox]::Show("Отключить сайт? Он перестанет открываться, пока не подключите снова.", "Маршрутник", "YesNo", "Question")
    if ($answer -eq "Yes") { Start-Background "Disconnect-Site" { Start-Check } }
})
$miCrm.Add_Click({
    $dialog = New-Object Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Выберите папку CRM (New_Lab_3D) - в ней есть deploy\Caddyfile"
    if ($dialog.ShowDialog($form) -eq "OK") {
        try { Set-CrmRoot $dialog.SelectedPath; Add-LogLine "Папка CRM: $($dialog.SelectedPath)" "ok"; Start-Check }
        catch { Add-LogLine $_.Exception.Message "err" }
    }
})

$form.Add_Shown({
    Add-LogLine "Маршрутник - $((Read-Settings).domain)" "step"
    Add-LogLine "Папка сайта: $script:Root"
    $timer.Start()
    Start-Check
})
$form.Add_FormClosing({ $timer.Stop() })

[void]$form.ShowDialog()
