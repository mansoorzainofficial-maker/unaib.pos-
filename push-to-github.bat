@echo off
chcp 65001 >nul
title GitHub Code Upload - Unaib POS
cls

echo =======================================================
echo      Unaib POS - کوڈ گٹ ہب پر اپلوڈ کرنے کا اسکرپٹ
echo =======================================================
echo.
echo براہ کرم انتظار فرمائیں، کوڈ گٹ ہب پر بھیجا جا رہا ہے...
echo (اگر براؤزر کھلے تو صرف 'Sign in with your browser' پر کلک کریں)
echo.

set "PATH=C:\Users\Lenovo\.gemini\antigravity\scratch\mingit\cmd;%PATH%"
cd /d "C:\Users\Lenovo\.gemini\antigravity\scratch\unaib-pos-desktop"

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo   [کامیابی] سارا کوڈ کامیابی سے گٹ ہب پر اپلوڈ ہو گیا ہے!
    echo =======================================================
) else (
    echo.
    echo [نوٹ] اگر تصدیق کا مسئلہ ہو تو ٹوکن درج فرمائیں۔
)

echo.
echo اس ونڈو کو بند کرنے کے لیے کوئی بھی بٹن دبائیں...
pause >nul
