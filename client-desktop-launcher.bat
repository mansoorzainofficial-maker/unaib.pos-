@echo off
title Unaib Computer Accessories POS
color 0A

:: Target URL: live cloud tunnel URL
set "TARGET_URL=https://gas-elliptic-mutate.ngrok-free.dev"
if not "%~1"=="" set "TARGET_URL=%~1"

echo ===================================================
echo   Unaib Computer Accessories - POS Terminal
echo ===================================================
echo   Starting POS in Dedicated Desktop Mode...
echo   URL: %TARGET_URL%
echo ===================================================

:: Check if Google Chrome exists
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --start-maximized
    exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --start-maximized
    exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --start-maximized
    exit /b
)

:: Check if Microsoft Edge exists (installed by default on all Windows 10 & 11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_URL%" --start-maximized
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_URL%" --start-maximized
    exit /b
)

:: Fallback: Open in default browser
start "" "%TARGET_URL%"
exit /b
