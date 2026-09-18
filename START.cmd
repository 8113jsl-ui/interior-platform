@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run START.cmd again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Node.js 24 or later is required.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Open the APP_ORIGIN configured in .env ^(default http://127.0.0.1:8766^).
echo For first-time account creation, stop this server and run: npm run setup
call npm start
if errorlevel 1 pause
