@echo off
setlocal enabledelayedexpansion

echo ===================================
echo [1/5] Inspecting Build Environment
echo ===================================
echo [Node Version]
call node -v
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH!
    pause
    exit /b %ERRORLEVEL%
)

echo [Java Version]
call java -version

echo [Project Files]
if not exist "package.json" (
    echo ERROR: package.json not found in current directory!
    pause
    exit /b 1
)
echo package.json detected.

echo.
echo ===================================
echo [2/5] Building Web App...
echo ===================================
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Web build failed! Check your TypeScript or Vite errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [Inspecting Compiled Web Output]
if exist "dist" (
    echo Web build folder 'dist' verified:
    dir /b "dist"
) else if exist "build" (
    echo Web build folder 'build' verified:
    dir /b "build"
) else (
    echo WARNING: No 'dist' or 'build' folder found after npm run build!
)

echo.
echo ===================================
echo [3/5] Syncing Assets and Native Plugins...
echo ===================================
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Capacitor sync failed! Check capacitor.config.json or missing webDir.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================
echo [4/5] Cleaning and Compiling APK...
echo ===================================
if not exist "android\gradlew" (
    echo ERROR: android\gradlew not found! Run 'npx cap add android' first.
    pause
    exit /b 1
)

cd android
call .\gradlew clean
call .\gradlew assembleDebug
set GRADLE_EXIT=%ERRORLEVEL%
cd ..

if %GRADLE_EXIT% NEQ 0 (
    echo ERROR: Android APK build failed! Check Gradle log errors above.
    pause
    exit /b %GRADLE_EXIT%
)

echo.
echo ===================================
echo [5/5] Inspecting Final Output APK
echo ===================================
set "APK_FILE=android\app\build\outputs\apk\debug\app-debug.apk"

if exist "%APK_FILE%" (
    echo SUCCESS! APK successfully generated.
    echo.
    echo --- File Information ---
    dir "%APK_FILE%" | findstr /i "app-debug.apk"
    echo.
    echo Full Path:
    echo %CD%\%APK_FILE%
    echo.
    choice /C YN /M "Would you like to open the output folder in File Explorer?"
    if errorlevel 2 goto END
    if errorlevel 1 explorer "android\app\build\outputs\apk\debug"
) else (
    echo ERROR: APK was not found at expected path: %APK_FILE%
)

:END
pause