@echo off
setlocal
cd /d "%~dp0"

if "%NGINX_HOME%"=="" set "NGINX_HOME=C:\nginx"
set "NGINX_EXE=%NGINX_HOME%\nginx.exe"

echo [1/2] Stopping Node app + worker (PM2)...
call pm2 stop sarkari-suchna >nul 2>&1
call pm2 stop worker >nul 2>&1

echo [2/2] Stopping NGINX...
if exist "%NGINX_EXE%" (
  pushd "%NGINX_HOME%"
  nginx -s quit >nul 2>&1
  popd
) else (
  echo NGINX not found at "%NGINX_EXE%" (skip).
)

echo Stopped.
endlocal
