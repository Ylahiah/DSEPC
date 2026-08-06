@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "HOST_IP=172.7.1.86"
set "FRONTEND_URL=http://%HOST_IP%:5173"
set "BACKEND_URL=http://%HOST_IP%:8000"
set "HEALTH_URL=%BACKEND_URL%/api/v1/health"

REM Variables inyectadas a los sub-procesos para CORS y API
set "FRONTEND_ORIGIN=%FRONTEND_URL%"
set "VITE_API_BASE_URL=%BACKEND_URL%/api/v1"

title DSEPC - Lanzador de pruebas
color 0A

echo ==========================================
echo   DSEPC - Lanzador de entorno de prueba
echo ==========================================
echo.

if not exist "%BACKEND_PYTHON%" (
    echo [ERROR] No se encontro el entorno virtual del backend.
    echo Ruta esperada: "%BACKEND_PYTHON%"
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] No se encontro el frontend.
    echo Ruta esperada: "%FRONTEND_DIR%\package.json"
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [ERROR] No se encontraron las dependencias del frontend.
    echo Ejecuta primero: npm install
    echo.
    pause
    exit /b 1
)

echo [1/4] Iniciando backend FastAPI (Abierto en red local)...
start "DSEPC Backend" cmd /k "cd /d "%BACKEND_DIR%" && call ".venv\Scripts\activate.bat" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/4] Iniciando frontend Vite (Abierto en red local)...
start "DSEPC Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev -- --host 0.0.0.0 --port 5173"

echo [3/4] Esperando a que backend y frontend respondan...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok = $false; for ($i = 0; $i -lt 30; $i++) { try { Invoke-RestMethod '%HEALTH_URL%' -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
    echo [ADVERTENCIA] El backend no respondio a tiempo. Revisa la ventana "DSEPC Backend".
) else (
    echo [OK] Backend disponible en %BACKEND_URL%
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok = $false; for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest '%FRONTEND_URL%' -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
    echo [ADVERTENCIA] El frontend no respondio a tiempo. Revisa la ventana "DSEPC Frontend".
) else (
    echo [OK] Frontend disponible en %FRONTEND_URL%
)

echo.
echo [4/4] Abriendo navegador...
start "" "%FRONTEND_URL%"

echo.
echo ==========================================
echo  Accesos de prueba
echo ==========================================
echo  Admin:
echo    Usuario: admin
echo    Contrasena: Admin12345
echo.
echo  Candidato:
echo    Codigo: EVAL-2026-DEMO
echo.
echo  URLs utiles:
echo    App:  %FRONTEND_URL%
echo    API:  %BACKEND_URL%
echo    Docs: %BACKEND_URL%/docs
echo.
echo Para cerrar el entorno, cierra las ventanas:
echo - DSEPC Backend
echo - DSEPC Frontend
echo.
pause
