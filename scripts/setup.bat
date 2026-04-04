@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Claude Code Clone - One-Command Setup (Windows)
::
:: Usage:
::   setup.bat
::
:: Or with API key:
::   set MOONSHOT_API_KEY=sk-xxx && setup.bat
:: ============================================================================

echo.
echo   Claude Code Clone - One-Command Setup
echo   ======================================
echo.

:: ── Check Node.js ────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   Node.js: %%v

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Reinstall Node.js.
    pause
    exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git not found. Download from https://git-scm.com/
    pause
    exit /b 1
)
echo   Git: OK
echo.

:: ── Set install directory ────────────────────────────────────────────────
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%USERPROFILE%\claude-code-clone"

:: ── Clone or update ─────────────────────────────────────���────────────────
echo [1/5] Setting up repository...

if exist "%INSTALL_DIR%\.git" (
    echo   Updating existing repo...
    cd /d "%INSTALL_DIR%"
    git pull --ff-only 2>nul || echo   [WARN] Pull failed, using existing version
) else if exist "%INSTALL_DIR%\package.json" (
    echo   Using existing project
    cd /d "%INSTALL_DIR%"
) else (
    echo   Cloning from GitHub...
    git clone https://github.com/520llw/claude-code-clone.git "%INSTALL_DIR%"
    if errorlevel 1 (
        echo [ERROR] Clone failed
        pause
        exit /b 1
    )
    cd /d "%INSTALL_DIR%"
)
echo   OK: %INSTALL_DIR%
echo.

:: ── Install dependencies ─────────────────────────────────────────────────
echo [2/5] Installing dependencies...
call npm install --no-audit --no-fund 2>&1 | findstr /R "added"
echo   OK
echo.

:: ── Build ────────────────────────────────────────────────────────────────
echo [3/5] Building...
node scripts\build.cjs --skip-typecheck --skip-validate 2>&1 | findstr /C:"successfully"
if not exist "dist\cli.mjs" (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo   OK: dist\cli.mjs
echo.

:: ── Detect API Key ───────────────────────────────────────────────────────
echo [4/5] Configuring API...

set "PROVIDER="
set "MODEL="
set "APIKEY="

if defined MOONSHOT_API_KEY (
    set "PROVIDER=kimi"
    set "MODEL=kimi-k2.5"
    set "APIKEY=%MOONSHOT_API_KEY%"
)
if defined KIMI_API_KEY (
    if not defined PROVIDER (
        set "PROVIDER=kimi"
        set "MODEL=kimi-k2.5"
        set "APIKEY=%KIMI_API_KEY%"
    )
)
if defined ANTHROPIC_API_KEY (
    if not defined PROVIDER (
        set "PROVIDER=anthropic"
        set "MODEL=claude-sonnet-4-20250514"
        set "APIKEY=%ANTHROPIC_API_KEY%"
    )
)
if defined OPENAI_API_KEY (
    if not defined PROVIDER (
        set "PROVIDER=openai"
        set "MODEL=gpt-4o"
        set "APIKEY=%OPENAI_API_KEY%"
    )
)

if defined PROVIDER (
    echo   Detected: %PROVIDER% / %MODEL%
) else (
    echo   No API key found in environment.
    echo.
    echo   Choose a provider:
    echo     1) Kimi (Moonshot AI)
    echo     2) Anthropic (Claude)
    echo     3) OpenAI (GPT)
    echo     4) Skip
    echo.
    set /p "CHOICE=Choice [1-4]: "

    if "!CHOICE!"=="1" (
        set "PROVIDER=kimi"
        set "MODEL=kimi-k2.5"
        set /p "APIKEY=Enter Moonshot API key: "
        set "MOONSHOT_API_KEY=!APIKEY!"
    )
    if "!CHOICE!"=="2" (
        set "PROVIDER=anthropic"
        set "MODEL=claude-sonnet-4-20250514"
        set /p "APIKEY=Enter Anthropic API key: "
        set "ANTHROPIC_API_KEY=!APIKEY!"
    )
    if "!CHOICE!"=="3" (
        set "PROVIDER=openai"
        set "MODEL=gpt-4o"
        set /p "APIKEY=Enter OpenAI API key: "
        set "OPENAI_API_KEY=!APIKEY!"
    )
)

:: Write config file
if defined APIKEY (
    set "CONFIG_DIR=%APPDATA%\claude-code"
    if not exist "!CONFIG_DIR!" mkdir "!CONFIG_DIR!"
    (
        echo model:
        echo   provider: %PROVIDER%
        echo   name: %MODEL%
        echo   apiKey: "%APIKEY%"
        echo   maxTokens: 16000
        echo   temperature: 0
        echo ui:
        echo   theme: default
        echo   showTokenCount: true
    ) > "!CONFIG_DIR!\config.yaml"
    echo   Config saved: !CONFIG_DIR!\config.yaml
)
echo.

:: ── Create shortcut ──────────────────────────────────────────────────────
echo [5/5] Creating shortcuts...

:: Create ccode.cmd
(
    echo @echo off
    echo node "%INSTALL_DIR%\dist\cli.mjs" %%*
) > "%INSTALL_DIR%\ccode.cmd"

:: Add to user PATH
set "CURRENT_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "CURRENT_PATH=%%b"
echo !CURRENT_PATH! | findstr /C:"%INSTALL_DIR%" >nul 2>&1
if errorlevel 1 (
    if defined CURRENT_PATH (
        setx PATH "!CURRENT_PATH!;%INSTALL_DIR%" >nul 2>&1
    ) else (
        setx PATH "%INSTALL_DIR%" >nul 2>&1
    )
    echo   Added to PATH (restart terminal to use 'ccode' command)
) else (
    echo   Already in PATH
)
echo.

:: ── Done ─────────────────────────────────────────────────────────────────
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo   Run now:
echo     node %INSTALL_DIR%\dist\cli.mjs
echo.
echo   Or after restarting terminal:
echo     ccode
echo.
echo   Quick commands:
echo     ccode "your question"
echo     ccode --help
echo     ccode config --list
echo.

:: ── Auto-launch ──────────────────────────────────────────────────────────
if defined APIKEY (
    set /p "LAUNCH=Launch now? [Y/n]: "
    if /i "!LAUNCH!"=="" set "LAUNCH=y"
    if /i "!LAUNCH!"=="y" (
        echo.
        node "%INSTALL_DIR%\dist\cli.mjs"
    )
)

endlocal
