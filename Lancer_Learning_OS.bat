@echo off
title Learning OS
cd /d "%~dp0"

echo ========================================================
echo          Lancement de Learning OS (Application)
echo ========================================================
echo Verification du serveur local...

:: Verifier si le serveur local repond sur le port 8125
powershell -Command "try { $res = (Invoke-WebRequest -Uri 'http://127.0.0.1:8125/' -TimeoutSec 1 -UseBasicParsing).StatusCode; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo Demarrage du serveur local en arriere-plan...
    start /min "Learning OS Server" node server.js
    timeout /t 2 /nobreak >nul
)

:: Trouver Google Chrome ou Microsoft Edge pour lancer en mode application autonome (sans barre d'URL)
set BROWSER_CMD=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if not "%BROWSER_CMD%"=="" (
    echo Ouverture de Learning OS dans sa propre fenetre d'application...
    start "" %BROWSER_CMD% --app=http://127.0.0.1:8125/ --user-data-dir="%LOCALAPPDATA%\LearningOS_App"
) else (
    echo Ouverture de Learning OS dans votre navigateur...
    start http://127.0.0.1:8125/
)

exit
