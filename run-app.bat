@echo off
echo Starting Unaib Computer Accessories Desktop Application...
if exist "release\win-unpacked\Unaib Computer Accessories POS.exe" (
    start "" "release\win-unpacked\Unaib Computer Accessories POS.exe"
) else (
    npm start
)
