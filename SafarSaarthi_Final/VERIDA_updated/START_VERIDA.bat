@echo off
title VERIDA — Local Dev Server
color 0A

echo.
echo  ==========================================
echo    VERIDA  ^|  Tourism ^& Transit Trust App
echo  ==========================================
echo.
echo  Starting local server on http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"
node server.js

echo.
echo  [Server stopped]
pause
