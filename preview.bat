@echo off
setlocal
cd /d "%~dp0"
title Virtual Pets 3D - production preview
if not exist logs mkdir logs
echo Building the production version - log in logs\build.log
call npm run build > logs\build.log 2>&1
if errorlevel 1 (
  echo Build failed. See logs\build.log
  type logs\build.log
  pause
  exit /b 1
)
echo Starting the production preview at http://localhost:4173
echo In Chrome or Edge you can install it as an app from the address bar.
call npm run preview
pause
