@echo off
setlocal
cd /d "%~dp0"

call "%~dp0stop-all.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start-all.bat"

endlocal
