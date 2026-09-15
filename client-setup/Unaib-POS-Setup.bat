@echo off
chcp 65001 >nul
title Unaib Computer Accessories POS - Setup
cls

echo =======================================================
echo     Unaib Computer Accessories POS - ڈیسک ٹاپ سیٹ اپ
echo =======================================================
echo.
echo براہ کرم چند سیکنڈ انتظار فرمائیں، ڈیسک ٹاپ پر شارٹ کٹ بنایا جا رہا ہے...
echo.

:: Define POS URL (کلاؤڈ سرور کا یو آر ایل)
set "POS_URL=https://gas-elliptic-mutate.ngrok-free.dev"
set "SHORTCUT_NAME=Unaib Computer Accessories POS"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if not exist "%EDGE_PATH%" (
    set "EDGE_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

:: PowerShell command to create native App Mode desktop shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$WshShell = New-Object -ComObject WScript.Shell; " ^
    "$Shortcut = $WshShell.CreateShortcut('%DESKTOP_DIR%\%SHORTCUT_NAME%.lnk'); " ^
    "$Shortcut.TargetPath = '%EDGE_PATH%'; " ^
    "$Shortcut.Arguments = '--app=\"%POS_URL%\" --start-maximized'; " ^
    "$Shortcut.Description = 'Unaib Computer Accessories Point of Sale System'; " ^
    "$Shortcut.WindowStyle = 3; " ^
    "$Shortcut.Save(); "

echo.
echo [کامیابی] ڈیسک ٹاپ پر سافٹ ویئر کا شارٹ کٹ بن چکا ہے!
echo.
echo اب آپ ڈیسک ٹاپ سے 'Unaib Computer Accessories POS' پر ڈبل کلک کر کے سافٹ ویئر چلا سکتے ہیں۔
echo.
echo کیا آپ ابھی سافٹ ویئر کھولنا چاہتے ہیں؟ (Y / N)
set /p userChoice="انتخاب درج کریں: "

if /i "%userChoice%"=="Y" (
    start "" "%EDGE_PATH%" --app="%POS_URL%" --start-maximized
)

exit /b 0
