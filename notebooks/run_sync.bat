@echo off
REM Quick Start Script for OneDrive to Fabric Sync
REM This script helps you set up and run the sync tool

echo ====================================
echo OneDrive to Fabric Sync - Quick Start
echo ====================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from python.org
    pause
    exit /b 1
)

echo [OK] Python is installed
echo.

REM Check if dependencies are installed
echo Checking dependencies...
python -c "import msal" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing required dependencies...
    pip install -r requirements_sync.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully
) else (
    echo [OK] Dependencies are already installed
)
echo.

REM Prompt for action
echo What would you like to do?
echo.
echo 1. Test run (dry-run - no uploads)
echo 2. Full sync (actual upload)
echo 3. Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Running DRY RUN mode...
    echo This will show what would be synced without actually uploading.
    echo.
    python onedrive_to_fabric_sync.py --dry-run
) else if "%choice%"=="2" (
    echo.
    echo Running FULL SYNC mode...
    echo This will download from OneDrive and upload to Fabric.
    echo.
    echo Are you sure you want to continue? (Y/N)
    set /p confirm="Enter Y to confirm: "
    if /i "%confirm%"=="Y" (
        python onedrive_to_fabric_sync.py
    ) else (
        echo Sync cancelled.
    )
) else if "%choice%"=="3" (
    echo Goodbye!
    exit /b 0
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo ====================================
pause
