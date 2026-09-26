@echo off
rem Reload nginx config (after issuing/renewing the certificate).
rem Set the folder that contains nginx.exe:
cd /d C:\nginx
nginx.exe -t && nginx.exe -s reload
