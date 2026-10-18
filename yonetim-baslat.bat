@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Islambol Yayinlari - Yonetim Paneli
echo.
echo  Islambol Yayinlari Yonetim Paneli aciliyor...
echo.
echo  - Tarayicida acilan sayfaya KULLANICI ADI ve SIFRE ile girin.
echo  - Bu pencereyi KAPATMAYIN (kucultebilirsiniz). Kapatirsaniz panel kapanir.
echo  - Kullanici adi ya da sifreyi unutursaniz "yonetim-sifre-sifirla" dosyasina cift tiklayin.
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
