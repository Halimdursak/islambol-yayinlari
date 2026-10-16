@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Islambol Yayinlari - Yonetim Paneli
echo.
echo  Islambol Yayinlari Yonetim Paneli aciliyor...
echo  Ilk acilista asagida bir SIFRE gorunur; bir kez gosterilir, not alin.
echo  Sifreyi panelde "Sifre degistir" bolumunden kendinize gore degistirebilirsiniz.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js bulunamadi. Lutfen Node.js kurulu oldugundan emin olun.
  pause
  exit /b 1
)
node scripts\cms\server.mjs --open
echo.
echo  Yonetim paneli kapandi.
pause
