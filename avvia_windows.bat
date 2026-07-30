@echo off
title AperiPost(umi) v0.3.1 beta
echo.
echo Avvio locale AperiPost(umi) v0.3.1 beta
echo http://localhost:8086/?build=0.3.1-pages-beta
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8086/?build=0.3.1-pages-beta"
python -m http.server 8086 --directory www
pause
