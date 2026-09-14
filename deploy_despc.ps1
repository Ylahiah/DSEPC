# ==============================================================================
# SCRIPT DE DESPLIEGUE AUTOMATIZADO - DESPC (PENSIV) A VPS (PowerShell 5.1+)
# ==============================================================================
$ErrorActionPreference = "Stop"

$SSH_HOST = "root@2.24.215.240"
$SSH_KEY  = "C:\Users\MSI\.ssh\vps_companero"
$REMOTE_DIR = "/var/www/despc"
$BACKEND_PORT = "3006"
$NGINX_PORT = "8082"

$useKey = Test-Path $SSH_KEY
if (-not $useKey) {
    Write-Host "No se encontro la llave SSH en $SSH_KEY. Usando configuracion estandar..." -ForegroundColor Yellow
}

function Exec-SSH([string]$remoteCommand) {
    if ($useKey) {
        & ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes $SSH_HOST "$remoteCommand"
    } else {
        & ssh -o StrictHostKeyChecking=no -o BatchMode=yes $SSH_HOST "$remoteCommand"
    }
}

function Exec-SCP([string]$localSrc, [string]$remoteDst) {
    if ($useKey) {
        & scp -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes -r $localSrc $remoteDst
    } else {
        & scp -o StrictHostKeyChecking=no -o BatchMode=yes -r $localSrc $remoteDst
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO DESPLIEGUE DE DESPC EN VPS ($SSH_HOST)" -ForegroundColor Cyan
Write-Host " Backend: $BACKEND_PORT | Web Nginx: $NGINX_PORT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Compilacion del Frontend
Write-Host "`n[1/5] Compilando Frontend (React + Vite)..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot\frontend"
try {
    npm run build
}
finally {
    Pop-Location
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al compilar el frontend. Despliegue cancelado." -ForegroundColor Red
    exit 1
}
Write-Host "Frontend compilado exitosamente en frontend/dist/" -ForegroundColor Green

# 2. Creacion de paquete de despliegue
Write-Host "`n[2/5] Empaquetando archivos del proyecto..." -ForegroundColor Yellow
$tempTar = "$PSScriptRoot\release_despc.tar.gz"
if (Test-Path $tempTar) { Remove-Item $tempTar -Force }

# Crear tar con backend, frontend/dist, base de datos, storage y nginx_despc.conf (excluyendo pycache)
tar -czf $tempTar --exclude="*.pyc" --exclude="*__pycache__*" -C "$PSScriptRoot" backend/app backend/requirements.txt backend/ecosystem.config.js backend/dsepc.db backend/storage frontend/dist nginx_despc.conf

Write-Host "Paquete de lanzamiento creado exitosamente." -ForegroundColor Green

# 3. Transferencia y Extraccion en VPS
Write-Host "`n[3/5] Transfiriendo y extrayendo paquete en el VPS..." -ForegroundColor Yellow
Exec-SSH "mkdir -p /var/www/despc"
Exec-SCP $tempTar "${SSH_HOST}:/var/www/despc/release_despc.tar.gz"
Exec-SSH "cd /var/www/despc && tar -xzf release_despc.tar.gz && rm release_despc.tar.gz"

Write-Host "   -> Configurando Nginx para DESPC (Puerto $NGINX_PORT)..."
Exec-SSH "cp /var/www/despc/nginx_despc.conf /etc/nginx/sites-available/despc && ln -sf /etc/nginx/sites-available/despc /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"

if (Test-Path $tempTar) { Remove-Item $tempTar -Force }

# 4. Instalacion de dependencias y PM2
Write-Host "`n[4/5] Configurando Python y servicio PM2 (Puerto $BACKEND_PORT)..." -ForegroundColor Yellow
Exec-SSH "cd /var/www/despc/backend ; [ -d .venv ] || python3 -m venv .venv ; .venv/bin/pip install --upgrade pip -q ; .venv/bin/pip install -r requirements.txt -q ; chmod -R 755 /var/www/despc"
Exec-SSH "cd /var/www/despc/backend ; pm2 delete despc > /dev/null 2>&1 ; pm2 start ecosystem.config.js ; pm2 save"

# 5. Smoke test
Write-Host "`n[5/5] Ejecutando Smoke Test en VPS..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Exec-SSH "curl -s --max-time 5 -o /dev/null -w 'HTTP Backend Status: %{http_code}\n' http://127.0.0.1:$BACKEND_PORT/docs"
Exec-SSH "curl -s --max-time 5 -o /dev/null -w 'HTTP Nginx Status: %{http_code}\n' http://127.0.0.1:$NGINX_PORT/"

Write-Host "`nDESPLIEGUE FINALIZADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "DESPC esta accesible en: http://2.24.215.240:$NGINX_PORT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
