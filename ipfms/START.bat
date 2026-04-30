@echo off
title IPFMS — Startup
color 0A
echo.
echo  =====================================================
echo   IPFMS — Intelligent Personal Financial Management
echo  =====================================================
echo.
echo  [1/3] Seeding demo data for karlmax@gmail.com ...
echo.
cd /d "%~dp0server"
node scripts/seed.js
if %errorlevel% neq 0 (
  echo.
  echo  [ERROR] Seed script failed. Check MongoDB connection.
  pause
  exit /b 1
)

echo.
echo  [2/3] Starting backend server on http://localhost:5000 ...
start "IPFMS Backend" cmd /k "cd /d "%~dp0server" && node server.js"

echo.
echo  [3/3] Starting React frontend on http://localhost:3000 ...
start "IPFMS Frontend" cmd /k "cd /d "%~dp0client" && npm start"

echo.
echo  =====================================================
echo   Both servers are starting up.
echo   Backend :  http://localhost:5000/health
echo   Frontend:  http://localhost:3000
echo.
echo   Login:  karlmax@gmail.com  /  MyPass1!
echo  =====================================================
echo.
timeout /t 5
start http://localhost:3000
