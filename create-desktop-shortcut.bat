@echo off
set "SCRIPT_DIR=%~dp0"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Unaib Computer Accessories POS.lnk"
set "TARGET=%SCRIPT_DIR%client-desktop-launcher.bat"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET%'; $s.WindowStyle = 1; $s.Description = 'Unaib Computer Accessories POS Terminal'; $s.Save()"

echo ====================================================
echo Desktop shortcut created successfully!
echo Location: %SHORTCUT_PATH%
echo ====================================================
pause
