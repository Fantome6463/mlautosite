#!/bin/sh
# Запуск БизСити 3D на Linux и macOS: веб-сервер для папки игры + браузер.
# Порт постоянный — от него зависят сохранения в браузере.
cd "$(dirname "$0")" || exit 1
# настройки сервера: длина игрового дня (секунды). DAY=30 ./start.sh — задать при запуске
[ -f settings.json ] || cp settings.example.json settings.json
if [ -n "$DAY" ]; then printf '{\n  "dayLengthSeconds": %s\n}\n' "$DAY" > settings.json; fi
PORT=8777
URL="http://127.0.0.1:$PORT/"
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 &
elif command -v mono >/dev/null 2>&1 && [ -f BizCity.exe ]; then
  mono BizCity.exe --console &
else
  echo "Нужен python3 (или mono с BizCity.exe)"; exit 1
fi
PID=$!
trap 'kill $PID 2>/dev/null' EXIT INT TERM
sleep 1
echo "БизСити 3D: $URL  (Ctrl+C — выход)"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then open "$URL"; fi
wait $PID
