@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-helper.ps1" -Interactive
if errorlevel 1 echo Setup failed. See the message above.
pause
