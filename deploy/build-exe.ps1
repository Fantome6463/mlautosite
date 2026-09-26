<#
.SYNOPSIS
  Собирает Marshrutnik.exe - запускатор окна управления. Использует компилятор C#, встроенный
  в Windows (ничего скачивать не нужно). Собирается один раз; окно обновляется вместе с кодом.
#>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot

$csc = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw "Не найден компилятор C# (.NET Framework 4). Он входит в Windows 10/11 и Windows Server." }

# Иконка: фиолетовая плитка с маршрутом (как логотип на сайте), PNG-кадры разных размеров.
function New-IconFrame([int]$Size) {
    $bitmap = New-Object Drawing.Bitmap($Size, $Size)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = "AntiAlias"
    $g.Clear([Drawing.Color]::Transparent)
    $k = $Size / 32.0
    $radius = [Math]::Max(2, [int](8 * $k))
    $path = New-Object Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2; $m = $Size - 1
    $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($m - $d, 0, $d, $d, 270, 90)
    $path.AddArc($m - $d, $m - $d, $d, $d, 0, 90); $path.AddArc(0, $m - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $fill = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Rectangle(0, 0, $Size, $Size)),
        [Drawing.Color]::FromArgb(124, 58, 237), [Drawing.Color]::FromArgb(79, 70, 229), 45.0)
    $g.FillPath($fill, $path)
    $pen = New-Object Drawing.Pen([Drawing.Color]::White, [Math]::Max(1.2, 2.6 * $k))
    $pen.StartCap = "Round"; $pen.EndCap = "Round"
    # M9 23 c0-6 14-4 14-10 (кривая логотипа)
    $g.DrawBezier($pen, (9 * $k), (23 * $k), (9 * $k), (17 * $k), (23 * $k), (19 * $k), (23 * $k), (13 * $k))
    $dot = [Math]::Max(2.5, 5.2 * $k)
    $white = New-Object Drawing.SolidBrush([Drawing.Color]::White)
    $g.FillEllipse($white, (9 * $k - $dot / 2), (23 * $k - $dot / 2), $dot, $dot)
    $g.FillEllipse($white, (23 * $k - $dot / 2), (13 * $k - $dot / 2), $dot, $dot)
    $g.Dispose()
    $stream = New-Object IO.MemoryStream
    $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    return , $stream.ToArray()
}

$sizes = @(16, 32, 48, 64, 256)
$frames = @()
foreach ($size in $sizes) { $frames += , (New-IconFrame $size) }
$icoPath = Join-Path $PSScriptRoot "app.ico"
$file = [IO.File]::Create($icoPath)
$writer = New-Object IO.BinaryWriter($file)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $dimension = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
    $offset += $frames[$i].Length
}
foreach ($frame in $frames) { $writer.Write($frame) }
$writer.Dispose()
$file.Dispose()

$exe = Join-Path $root "Marshrutnik.exe"
& $csc /nologo /target:winexe /codepage:65001 "/out:$exe" "/win32icon:$icoPath" "/win32manifest:$(Join-Path $PSScriptRoot 'app.manifest')" /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot "launcher.cs")
if ($LASTEXITCODE -ne 0) { throw "Не удалось собрать Marshrutnik.exe." }
Write-Host "Готово: $exe" -ForegroundColor Green
