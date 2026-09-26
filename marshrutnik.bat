@echo off
chcp 65001 >nul
rem   marshrutnik.bat              - окно управления (Marshrutnik.exe; соберётся при первом запуске)
rem   marshrutnik.bat status|connect|update|disconnect  - то же из консоли
if "%~1"=="" goto gui
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\site.ps1" %*
goto :eof

:gui
if not exist "%~dp0Marshrutnik.exe" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\build-exe.ps1"
if not exist "%~dp0Marshrutnik.exe" pause
if not exist "%~dp0Marshrutnik.exe" goto :eof
start "" "%~dp0Marshrutnik.exe"
