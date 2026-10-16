@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Islambol Yayinlari - Yonetim Sifresini Sifirla
echo.
echo  Yonetici sifresi sifirlanacak ve yeni bir sifre uretilecek.
echo  Yeni sifre asagida BIR KEZ gosterilir; not alin.
echo.
pause
node scripts\cms\server.mjs --reset-password --open
echo.
echo  Yonetim paneli kapandi.
pause
