# Script de despliegue para Lexys
# Requiere que GH_TOKEN esté ya configurado en el entorno.
# Ejemplo previo a ejecutar:
#   $env:GH_TOKEN = "<token>"
# Luego:
#   npm run dist:release

if (-not $env:GH_TOKEN) {
    Write-Host "GH_TOKEN no está configurado. Exporta tu token antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando compilación y publicación a GitHub Releases..." -ForegroundColor Green

npm run dist:release

if ($LASTEXITCODE -eq 0) {
    Write-Host "Despliegue exitoso" -ForegroundColor Green
} else {
    Write-Host "Hubo un error en el despliegue." -ForegroundColor Red
}
