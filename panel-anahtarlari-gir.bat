@echo off
chcp 65001 >nul
title Islambol paneli - anahtar girisi
cd /d "%~dp0"
node worker\scripts\anahtarlari-gir.mjs
echo.
pause
