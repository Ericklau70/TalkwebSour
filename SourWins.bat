@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
echo.
echo Setup starting...
echo.

REM 发行包已自带 agency 数据；本脚本不再从 GitHub 下载。可选 install.prefs 中 BUILD_AGENCY_AFTER_INSTALL=1 重建索引。

set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python312"
set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python311"
set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python310"
set "PATH=%PATH%;%LocalAppData%\Microsoft\WindowsApps"

where node >nul 2>nul
if errorlevel 1 (
  echo Installing Node.js via winget...
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo [提示] winget 安装失败时：请以管理员身份打开 CMD，或先安装「应用安装程序」后再试。
    echo 下载说明: https://aka.ms/getwinget
    pause
    exit /b 1
  )
  set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
)

where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo Installing Python 3 via winget...
    winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
      echo [提示] Python 未自动安装时，请到 https://www.python.org/downloads/ 手动安装并勾选 Add to PATH。
    )
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python312"
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: 未在 PATH 中找到 node。请关闭本窗口后重新双击本脚本，或重启电脑后再试。
  pause
  exit /b 1
)

echo Installing npm dependencies...
call npm install
if errorlevel 1 (
  echo npm install 失败。
  pause
  exit /b 1
)

echo Building extension bundles ^(quick-chat-history, mermaid-editor^)...
call npm run build:quick-chat-history
if errorlevel 1 echo Warning: build:quick-chat-history failed.
call npm run build:mermaid-editor
if errorlevel 1 echo Warning: build:mermaid-editor failed.

set "BUILD_AGENCY_AFTER_INSTALL=0"
set "TW_PREF=%~dp0install.prefs"
if not exist "%TW_PREF%" set "TW_PREF=%~dp0scripts\install.prefs"
if exist "%TW_PREF%" (
  for /f "usebackq tokens=1,2 delims==" %%A in ("%TW_PREF%") do (
    if /i "%%A"=="BUILD_AGENCY_AFTER_INSTALL" set "BUILD_AGENCY_AFTER_INSTALL=%%B"
  )
)
if "%BUILD_AGENCY_AFTER_INSTALL%"=="1" (
  echo install.prefs: running npm run build:agency...
  call npm run build:agency
  if errorlevel 1 echo Warning: build:agency failed.
)

echo.
echo Done! Optional: npm run generate:agency-l10n ^(needs network^)
echo.
pause
endlocal
