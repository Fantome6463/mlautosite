@echo off
chcp 65001 >nul
rem Запуск БизСити 3D: при первом запуске соберёт BizCity.exe (встроенным в Windows компилятором), потом откроет игру.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\build.ps1" -IfNeeded
if not exist "%~dp0BizCity.exe" (
  echo Не удалось собрать BizCity.exe
  pause
  goto :eof
)
start "" "%~dp0BizCity.exe"
