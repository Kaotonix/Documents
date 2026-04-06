@echo off
cd /d "%~dp0"
echo.
echo Magnit Slide Studio - starting dev server...
echo.

set "NODE_CMD="
where node >nul 2>nul
if not errorlevel 1 set "NODE_CMD=node"

if not defined NODE_CMD if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  set "NODE_CMD=node"
)
if not defined NODE_CMD if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  set "NODE_CMD=node"
)

if not defined NODE_CMD (
  echo ERROR: Node.js was not found.
  echo.
  echo Install it once, then run this batch file again:
  echo   1. Open https://nodejs.org/ and download the **LTS** Windows Installer ^(.msi^).
  echo   2. Run the installer. Leave "Add to PATH" checked.
  echo   3. Close ALL Command Prompt / PowerShell / Cursor terminals.
  echo   4. Double-click Start-Dev.bat again ^(or restart the PC if it still fails^).
  echo.
  echo Optional ^(admin PowerShell^): winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing dependencies ^(this may take a minute^)...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist "assets\magnit-template.pptx" (
  echo Packing PowerPoint template...
  call npm run pack-template
)

echo Keep this window OPEN while you use the app. Close it to stop the server.
echo A browser tab will open; if it says "connection refused", wait 3 seconds and refresh.
echo.
start "" "http://localhost:5173"
node server.mjs
pause
