@echo off
REM Double-click this file to view the Africa Insights site locally.
REM It serves the docs\ folder over http://localhost:8080/ (no Python or Node needed).
setlocal
set "PORT=8080"
echo.
echo  Starting Africa Insights local server...
echo    Folder : %~dp0docs
echo    Open   : http://localhost:8080/
echo    Stop   : press Ctrl+C in this window
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT% -Root "docs"
echo.
echo  Server stopped.
pause