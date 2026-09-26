# Общие функции Маршрутника на Windows-сервере (подключаются в app.ps1 и site.ps1).
# Сайт статический: его раздаёт тот же Caddy, что и CRM «Лаборатория 3Д» (New_Lab_3D).
# Мы только кладём свой файл в New_Lab_3D\deploy\sites.d\ - основной Caddyfile не трогаем.
$ErrorActionPreference = "Stop"

try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false) } catch { }
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$script:Root = Split-Path -Parent $PSScriptRoot
$script:SettingsFile = Join-Path $PSScriptRoot "app-settings.json"
$script:SiteFileName = "marshrutnik.caddy"
$script:DefaultDomain = "маршрутник.рф"

# Куда писать сообщения: консоль по умолчанию, окно подменяет на свой вывод.
$script:LogSink = { param([string]$Text, [string]$Kind)
    $color = @{ ok = "Green"; warn = "Yellow"; err = "Red"; step = "Cyan" }[$Kind]
    if (-not $color) { $color = "Gray" }
    Write-Host "  $Text" -ForegroundColor $color
}
function Write-Log([string]$Text, [string]$Kind = "info") { & $script:LogSink $Text $Kind }

# ---------------------------------------------------------------- настройки
function Read-Settings {
    $s = [ordered]@{ domain = $script:DefaultDomain; crmRoot = ""; previewPort = 8088 }
    if (Test-Path $script:SettingsFile) {
        try {
            $json = Get-Content -Path $script:SettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($p in $json.PSObject.Properties) { $s[$p.Name] = $p.Value }
        } catch { }
    }
    return $s
}
function Save-Settings($Settings) {
    [IO.File]::WriteAllText($script:SettingsFile, ($Settings | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
}

# маршрутник.рф -> xn--80aqgfgraqi2c.xn--p1ai (так домен понимают DNS, Caddy и сертификаты)
function ConvertTo-AsciiDomain([string]$Domain) {
    return (New-Object Globalization.IdnMapping).GetAscii($Domain.Trim().ToLower())
}

# ---------------------------------------------------------------- вспомогательное
function Find-Executable([string]$Name, [string[]]$ExtraPaths = @()) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    foreach ($path in $ExtraPaths) { if ($path -and (Test-Path $path)) { return $path } }
    return $null
}

# Внешние программы пишут предупреждения в stderr; под "Stop" PowerShell 5.1 счёл бы это ошибкой.
function Invoke-Native([scriptblock]$Command) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& $Command 2>&1 | ForEach-Object { "$_" })
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    }
    finally { $ErrorActionPreference = $previous }
}

function Read-EnvFile([string]$Path) {
    $values = @{}
    if (-not (Test-Path $Path)) { return $values }
    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $value = $Matches[2]
            if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
            $values[$Matches[1]] = $value
        }
    }
    return $values
}

function Get-LocalIp {
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
        Sort-Object { $_.RouteMetric + $_.InterfaceMetric } | Select-Object -First 1
    if ($route) {
        $address = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
        if ($address) { return $address.IPAddress }
    }
    return $null
}

function Get-PublicIp {
    try { return (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5).ToString().Trim() } catch { return $null }
}

function Resolve-ARecord([string]$Name) {
    $r = Resolve-DnsName -Name $Name -Type A -DnsOnly -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "A" } | Select-Object -First 1
    if ($r) { return $r.IPAddress }
    return $null
}

# ---------------------------------------------------------------- CRM (New_Lab_3D) и её Caddy
function Test-CrmRoot([string]$Path) {
    if (-not $Path -or -not (Test-Path $Path)) { return $false }
    return (Test-Path (Join-Path $Path "deploy\lib.ps1")) -and
        ((Test-Path (Join-Path $Path "deploy\Caddyfile")) -or (Test-Path (Join-Path $Path ".env.production")))
}

# Ищет папку CRM: сохранённый путь -> запущенный Caddy -> соседние папки -> корни дисков.
function Find-CrmRoot {
    $settings = Read-Settings
    if (Test-CrmRoot $settings.crmRoot) { return $settings.crmRoot }

    $caddyProcs = Get-CimInstance Win32_Process -Filter "Name='caddy.exe'" -ErrorAction SilentlyContinue
    foreach ($p in @($caddyProcs)) {
        if ($p.CommandLine -match '--config\s+"?([^"]+?Caddyfile)"?(\s|$)') {
            $candidate = Split-Path -Parent (Split-Path -Parent $Matches[1])
            if (Test-CrmRoot $candidate) { return $candidate }
        }
    }

    $places = @(Split-Path -Parent $script:Root)
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        if ($drive.Root -and (Test-Path $drive.Root)) {
            $places += $drive.Root
            $places += @(Get-ChildItem -Path $drive.Root -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch '^(Windows|Program Files.*|ProgramData|\$.*|System Volume Information)$' } |
                ForEach-Object { $_.FullName })
        }
    }
    foreach ($place in $places) {
        foreach ($dir in @(Get-ChildItem -Path $place -Directory -ErrorAction SilentlyContinue)) {
            if ($dir.FullName -ne $script:Root -and (Test-CrmRoot $dir.FullName)) { return $dir.FullName }
        }
    }
    return $null
}

function Set-CrmRoot([string]$Path) {
    if (-not (Test-CrmRoot $Path)) { throw "В папке '$Path' не найдена установленная CRM (нет deploy\lib.ps1 и deploy\Caddyfile)." }
    $s = Read-Settings; $s.crmRoot = $Path; Save-Settings $s
}

function Find-Caddy([hashtable]$CrmConfig) {
    if ($CrmConfig -and $CrmConfig["DEPLOY_CADDY"] -and (Test-Path $CrmConfig["DEPLOY_CADDY"])) { return $CrmConfig["DEPLOY_CADDY"] }
    return Find-Executable "caddy" @(
        (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\caddy.exe"),
        (Join-Path $env:ProgramFiles "Caddy\caddy.exe"),
        "C:\caddy\caddy.exe"
    )
}

function Test-CaddyRunning {
    return [bool](Get-Process -Name "caddy" -ErrorAction SilentlyContinue)
}

# Всё, что нужно знать о CRM, одним объектом.
function Get-Crm {
    $root = Find-CrmRoot
    if (-not $root) { return $null }
    $config = Read-EnvFile (Join-Path $root ".env.production")
    $ip = $config["DEPLOY_IP"]
    if (-not $ip) { $ip = Get-LocalIp }
    return [pscustomobject]@{
        Root      = $root
        Config    = $config
        Ip        = $ip
        Caddy     = Find-Caddy $config
        Caddyfile = Join-Path $root "deploy\Caddyfile"
        SitesDir  = Join-Path $root "deploy\sites.d"
        SiteFile  = Join-Path $root ("deploy\sites.d\" + $script:SiteFileName)
    }
}

# Блок для Caddy: статические файлы из папки сайта, HTTPS - автоматически (Let's Encrypt).
# PreviewPort > 0 добавляет просмотр по IP без домена: http://<IP>:<порт>.
function New-SiteText([string]$Domain, [string]$Ip, [bool]$WithWww, [int]$PreviewPort = 0) {
    $ascii = ConvertTo-AsciiDomain $Domain
    $rootPath = $script:Root.Replace('\', '/')
    $bind = if ($Ip) { "`tbind $Ip`n" } else { "" }
    $text = @"
# Маршрутник ($Domain) - создано программой Маршрутника (deploy\app.ps1). Правки вручную перезапишутся.
(marshrutnik_files) {
	root * "$rootPath"
	encode zstd gzip
	@private path /.git* /.git/* /deploy/* /*.bat /*.exe /*.md
	respond @private 404
	header {
		Cache-Control "no-cache"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
	file_server
}

$ascii {
$bind	import marshrutnik_files
	header Strict-Transport-Security "max-age=31536000"
}
"@
    if ($WithWww) {
        $text += @"

www.$ascii {
$bind	redir https://$ascii{uri} permanent
}
"@
    }
    if ($PreviewPort -gt 0) {
        $text += @"

# просмотр по IP, пока домен не заработал
http://:$PreviewPort {
$bind	import marshrutnik_files
}
"@
    }
    return $text + "`n"
}

# Кто слушает порт: $null - свободен, "caddy" - наш Caddy, иначе имя программы.
function Get-PortOwner([int]$Port) {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) { return $null }
    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
    if ($process) { return $process.ProcessName }
    return "PID $($connection.OwningProcess)"
}

# Порт для просмотра по IP: сохранённый, если свободен (или уже наш), иначе следующий свободный.
function Get-PreviewPort {
    $settings = Read-Settings
    $port = [int]$settings.previewPort
    if ($port -le 0) { return 0 }
    for ($p = $port; $p -lt $port + 20; $p++) {
        $owner = Get-PortOwner $p
        if (-not $owner -or $owner -eq "caddy") {
            if ($p -ne $port) { $settings.previewPort = $p; Save-Settings $settings }
            return $p
        }
    }
    return 0
}

$script:FirewallRule = "Маршрутник - просмотр по IP"
function Open-FirewallPort([int]$Port) {
    try {
        Remove-NetFirewallRule -DisplayName $script:FirewallRule -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName $script:FirewallRule -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
        Write-Log "Брандмауэр Windows: порт $Port открыт." "ok"
    }
    catch { Write-Log "Не удалось открыть порт $Port в брандмауэре (нужны права администратора): $($_.Exception.Message)" "warn" }
}

function Invoke-CaddyReload($Crm) {
    if (-not $Crm.Caddy) { return [pscustomobject]@{ ExitCode = 1; Output = @("caddy.exe не найден") } }
    return Invoke-Native { & $Crm.Caddy reload --config $Crm.Caddyfile --adapter caddyfile }
}

# Подключить (или переподключить) сайт к Caddy CRM. Кривой конфиг не оставляем: откатываем.
function Connect-Site {
    $settings = Read-Settings
    $domain = $settings.domain
    $ascii = ConvertTo-AsciiDomain $domain
    Write-Log "Подключение $domain" "step"

    $crm = Get-Crm
    if (-not $crm) { throw "Не нашёл установленную CRM (New_Lab_3D) на этом сервере. Укажите её папку." }
    Write-Log "CRM: $($crm.Root)"
    if (-not $crm.Caddy) { throw "Не найден caddy.exe (его ставит CRM: winget install CaddyServer.Caddy)." }

    $withWww = [bool](Resolve-ARecord "www.$ascii")
    if (-not $withWww) { Write-Log "www.$domain в DNS пока нет - подключаю без www (добавится при следующем подключении)." "warn" }

    New-Item -ItemType Directory -Force -Path $crm.SitesDir | Out-Null
    $previous = if (Test-Path $crm.SiteFile) { [IO.File]::ReadAllText($crm.SiteFile) } else { $null }
    $previewPort = Get-PreviewPort
    [IO.File]::WriteAllText($crm.SiteFile, (New-SiteText $domain $crm.Ip $withWww $previewPort), (New-Object Text.UTF8Encoding($false)))

    if (Test-Path $crm.Caddyfile) {
        $check = Invoke-Native { & $crm.Caddy validate --config $crm.Caddyfile --adapter caddyfile }
        if ($check.ExitCode -ne 0) {
            if ($null -ne $previous) { [IO.File]::WriteAllText($crm.SiteFile, $previous, (New-Object Text.UTF8Encoding($false))) }
            else { Remove-Item $crm.SiteFile -ErrorAction SilentlyContinue }
            throw ("Caddy не принял настройки, изменения отменены: " + (($check.Output | Select-Object -Last 3) -join " "))
        }
    }
    Write-Log "Файл сайта: $($crm.SiteFile)" "ok"

    if (Test-CaddyRunning) {
        $reload = Invoke-CaddyReload $crm
        if ($reload.ExitCode -eq 0) { Write-Log "Caddy подхватил сайт без перезапуска. Сертификат HTTPS он получит сам за 1-2 минуты." "ok" }
        else { Write-Log ("Не удалось перезагрузить Caddy: " + (($reload.Output | Select-Object -Last 2) -join " ")) "warn" }
    }
    else {
        Write-Log "Caddy сейчас не запущен - сайт заработает, когда запустится CRM." "warn"
    }
    if ($previewPort -gt 0) {
        Open-FirewallPort $previewPort
        Write-Log "Просмотр по IP (без домена): http://$($crm.Ip):$previewPort" "ok"
    }
}

function Disconnect-Site {
    $crm = Get-Crm
    if (-not $crm -or -not (Test-Path $crm.SiteFile)) { Write-Log "Сайт и так не подключён." "warn"; return }
    Remove-Item $crm.SiteFile -Force
    Remove-NetFirewallRule -DisplayName $script:FirewallRule -ErrorAction SilentlyContinue
    Write-Log "Сайт отключён от Caddy." "ok"
    if (Test-CaddyRunning) { [void](Invoke-CaddyReload $crm) }
}

# ---------------------------------------------------------------- git
function Invoke-Git {
    $git = Find-Executable "git" @((Join-Path $env:ProgramFiles "Git\cmd\git.exe"))
    if (-not $git) { throw "git не установлен (winget install Git.Git)." }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $lines = & $git -c core.quotepath=off -c safe.directory=* -C $script:Root @args 2>&1 | ForEach-Object { "$_" }
        $script:GitExit = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previous }
    return @($lines)
}

function Get-VersionInfo([switch]$NoFetch) {
    $info = [ordered]@{ isRepo = $false; head = ""; date = ""; message = ""; behind = 0; commits = @(); error = "" }
    if (-not (Test-Path (Join-Path $script:Root ".git"))) { return $info }
    if (-not (Find-Executable "git" @((Join-Path $env:ProgramFiles "Git\cmd\git.exe")))) { $info.error = "git не установлен"; return $info }
    $info.isRepo = $true
    $log = @(Invoke-Git log -1 "--format=%h|%cd|%s" "--date=format:%d.%m.%Y %H:%M")
    if ($script:GitExit -eq 0 -and $log.Count) {
        $parts = "$($log[0])".Split("|", 3)
        if ($parts.Count -eq 3) { $info.head = $parts[0]; $info.date = $parts[1]; $info.message = $parts[2] }
    }
    if (-not $NoFetch) {
        $fetch = Invoke-Git fetch --quiet
        if ($script:GitExit -ne 0) { $info.error = ("$($fetch -join ' ')").Trim() }
    }
    $behind = Invoke-Git rev-list --count "HEAD..@{u}"
    if ($script:GitExit -eq 0) {
        $info.behind = [int]"$($behind | Select-Object -First 1)"
        $info.commits = @(Invoke-Git log "HEAD..@{u}" "--format=%s" -n 20 | Where-Object { $_ })
    }
    return $info
}

function Update-Site {
    Write-Log "Обновление сайта" "step"
    if (-not (Test-Path (Join-Path $script:Root ".git"))) {
        throw "Папка сайта не из git. Скачайте её заново через git clone - тогда обновление будет в одну кнопку."
    }
    $out = Invoke-Git pull --ff-only
    $out | Where-Object { $_ } | ForEach-Object { Write-Log $_ }
    if ($script:GitExit -ne 0) {
        throw "git pull не удался. Если в папке сайта что-то правили вручную - верните как было (git checkout .) и повторите."
    }
    Write-Log "Готово. Новая версия уже на сайте - перезапускать ничего не нужно." "ok"
}

# ---------------------------------------------------------------- проверки для окна / status
function Get-SiteStatus([switch]$NoFetch) {
    $settings = Read-Settings
    $ascii = ConvertTo-AsciiDomain $settings.domain
    $crm = Get-Crm
    $publicIp = Get-PublicIp
    $dnsIp = Resolve-ARecord $ascii
    $expectedIp = if ($publicIp) { $publicIp } elseif ($crm) { $crm.Ip } else { $null }

    $previewUrl = $null; $previewOnline = $false
    $previewPort = [int]$settings.previewPort
    if ($crm -and $crm.Ip -and $previewPort -gt 0 -and (Test-Path $crm.SiteFile) -and
        (Select-String -Path $crm.SiteFile -Pattern "http://:$previewPort" -SimpleMatch -Quiet)) {
        $previewUrl = "http://$($crm.Ip):$previewPort"
        try { $previewOnline = ((Invoke-WebRequest -Uri "$previewUrl/" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) } catch { }
    }

    $online = $false
    try {
        $resp = Invoke-WebRequest -Uri "https://$ascii/" -UseBasicParsing -TimeoutSec 8
        $online = ($resp.StatusCode -eq 200)
    } catch { }

    return [pscustomobject]@{
        Domain       = $settings.domain
        Ascii        = $ascii
        Crm          = $crm
        Connected    = [bool]($crm -and (Test-Path $crm.SiteFile))
        CaddyRunning = Test-CaddyRunning
        DnsIp        = $dnsIp
        ExpectedIp   = $expectedIp
        Online       = $online
        PreviewUrl   = $previewUrl
        PreviewOnline = $previewOnline
        PublicIp     = $publicIp
        Version      = Get-VersionInfo -NoFetch:$NoFetch
    }
}
