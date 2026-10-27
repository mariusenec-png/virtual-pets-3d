@echo off
setlocal
cd /d "%~dp0"
title Virtual Pets 3D

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist logs mkdir logs

if not exist node_modules\.package-lock.json (
  echo Installing dependencies - first run only, this can take a minute...
  call npm install > logs\install.log 2>&1
  if errorlevel 1 (
    echo npm install failed. See logs\install.log
    type logs\install.log
    pause
    exit /b 1
  )
)

echo Running type check - results in logs\typecheck.log
call npm run typecheck > logs\typecheck.log 2>&1
if errorlevel 1 (
  echo Type check reported problems - see logs\typecheck.log. Starting anyway...
) else (
  echo Type check passed.
)

echo Starting the game at http://localhost:5173
call npm run dev
pause
