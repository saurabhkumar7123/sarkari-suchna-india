@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo PORT STATUS
echo ==============================
echo --- :3000 ---
netstat -ano | findstr :3000
if errorlevel 1 echo (No listener on 3000)

echo --- :8080 ---
netstat -ano | findstr :8080
if errorlevel 1 echo (No listener on 8080)

echo.
echo ==============================
echo PM2 STATUS
echo ==============================
call pm2 status

echo.
echo ==============================
echo HTTP HEALTH CHECK
echo ==============================
curl.exe -s -o NUL -w "3000 /health => %%{http_code}\n" http://127.0.0.1:3000/health
curl.exe -s -o NUL -w "8080 /health => %%{http_code}\n" http://127.0.0.1:8080/health

endlocal
