<#
.SYNOPSIS
  Собирает BizCity.exe — запускатор игры. Использует компилятор C#, встроенный в Windows,
  ничего скачивать не нужно. С ключом -IfNeeded собирает, только если exe нет или исходник новее.
#>
param([switch]$IfNeeded)
$ErrorActionPreference = "Stop"
$game = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $game "BizCity.exe"
$src = Join-Path $PSScriptRoot "BizCity.cs"

if ($IfNeeded -and (Test-Path $exe) -and ((Get-Item $exe).LastWriteTime -ge (Get-Item $src).LastWriteTime)) { exit 0 }

$csc = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw "Не найден компилятор C# (.NET Framework 4). Он входит в Windows 10/11." }

Add-Type -AssemblyName System.Drawing

# Иконка: сине-фиолетовая плитка с силуэтом города, PNG-кадры разных размеров.
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
        [Drawing.Color]::FromArgb(59, 130, 246), [Drawing.Color]::FromArgb(168, 85, 247), 45.0)
    $g.FillPath($fill, $path)
    $white = New-Object Drawing.SolidBrush([Drawing.Color]::White)
    $gold = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(250, 204, 21))
    # три дома разной высоты (x, верх, ширина) на сетке 32×32
    foreach ($h in @(@(6, 15, 6), @(13, 7, 7), @(21, 12, 5))) {
        $g.FillRectangle($white, [float]($h[0] * $k), [float]($h[1] * $k), [float]($h[2] * $k), [float]((26 - $h[1]) * $k))
    }
    $g.FillRectangle($gold, [float](15 * $k), [float](10 * $k), [float](3 * $k), [float](3 * $k))
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

& $csc /nologo /target:winexe /codepage:65001 "/out:$exe" "/win32icon:$icoPath" "/win32manifest:$(Join-Path $PSScriptRoot 'app.manifest')" `
    /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $src
if ($LASTEXITCODE -ne 0) { throw "Не удалось собрать BizCity.exe." }
Write-Host "Готово: $exe" -ForegroundColor Green
