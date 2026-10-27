@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
echo Running type check, unit tests and production build...
(
  echo === node / npm ===
  node -v
  call npm -v
  echo === typecheck ===
  call npm run typecheck
  echo === tests ===
  call npm test
  echo === build ===
  call npm run build
) > logs\check.log 2>&1
type logs\check.log
echo.
echo Full log saved to logs\check.log
pause
