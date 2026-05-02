@echo off
setlocal

REM ---- Project root ----
cd /d "%~dp0"

REM ---- Configure your local NGINX folder once ----
if "%NGINX_HOME%"=="" set "NGINX_HOME=C:\nginx"
set "NGINX_EXE=%NGINX_HOME%\nginx.exe"

echo [1/3] Starting Node app + worker with PM2...
call pm2 start ecosystem.config.js --env production >nul 2>&1
if errorlevel 1 (
  echo PM2 start failed. Trying reload...
  call pm2 reload ecosystem.config.js --env production >nul 2>&1
)

echo [2/3] Starting NGINX...
if exist "%NGINX_EXE%" (
  pushd "%NGINX_HOME%"
  nginx -t
  if errorlevel 1 (
    echo NGINX config test failed. Please fix config before start.
    popd
    exit /b 1
  )
  nginx >nul 2>&1
  popd
) else (
  echo NGINX not found at "%NGINX_EXE%"
  echo Set NGINX_HOME and run again. Example:
  echo   set NGINX_HOME=C:\nginx
  exit /b 1
)

echo [3/3] Quick status:
call "%~dp0check-status.bat"
echo.
echo Started. Open: http://127.0.0.1:8080
endlocal
