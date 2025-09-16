#!/bin/bash

# Script para probar los endpoints de reportes con rango de fechas
# Autor: Script generado para verificar funcionalidad de reportes
# Fecha: $(date)

set -e

echo "🧪 Probando endpoints de reportes con rango de fechas..."
echo "====================================================="

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que el servidor esté corriendo
print_status "Verificando si el servidor está corriendo..."
if ! curl -s -f http://localhost:3000 > /dev/null 2>&1; then
    print_warning "El servidor no está corriendo. Iniciando servidor..."
    npm start &
    SERVER_PID=$!
    
    # Esperar a que el servidor inicie
    print_status "Esperando a que el servidor inicie..."
    sleep 15
    
    # Verificar si el servidor está corriendo
    if ! curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        print_error "No se pudo iniciar el servidor"
        exit 1
    fi
else
    print_status "Servidor ya está corriendo"
fi

# URLs de prueba
BASE_URL="http://localhost:3000"
START_DATE="2025-09-16"
END_DATE="2025-09-16"

print_status "Probando endpoints con fechas: $START_DATE a $END_DATE"

# Probar endpoint de reporte general
print_status "Probando /reports/reporte-general..."
if curl -s -f -I "$BASE_URL/reports/reporte-general?startDate=$START_DATE&endDate=$END_DATE" > /dev/null 2>&1; then
    print_status "✅ /reports/reporte-general funciona correctamente"
else
    print_error "❌ /reports/reporte-general no funciona"
fi

# Probar endpoint de reporte cleaner
print_status "Probando /reports/reporte-cleaner..."
if curl -s -f -I "$BASE_URL/reports/reporte-cleaner?startDate=$START_DATE&endDate=$END_DATE" > /dev/null 2>&1; then
    print_status "✅ /reports/reporte-cleaner funciona correctamente"
else
    print_error "❌ /reports/reporte-cleaner no funciona"
fi

# Probar endpoint de costos semana
print_status "Probando /reports/costos-semana..."
if curl -s -f -I "$BASE_URL/reports/costos-semana?startDate=$START_DATE&endDate=$END_DATE" > /dev/null 2>&1; then
    print_status "✅ /reports/costos-semana funciona correctamente"
else
    print_error "❌ /reports/costos-semana no funciona"
fi

# Probar con diferentes rangos de fechas
print_status "Probando con rango de una semana..."
WEEK_START="2025-09-16"
WEEK_END="2025-09-22"

if curl -s -f -I "$BASE_URL/reports/reporte-general?startDate=$WEEK_START&endDate=$WEEK_END" > /dev/null 2>&1; then
    print_status "✅ Rango de una semana funciona correctamente"
else
    print_error "❌ Rango de una semana no funciona"
fi

print_status "🎉 Pruebas completadas!"

# Limpiar proceso del servidor si lo iniciamos
if [ ! -z "$SERVER_PID" ]; then
    print_status "Deteniendo servidor de prueba..."
    kill $SERVER_PID 2>/dev/null || true
fi

echo ""
echo "📋 Resumen de endpoints disponibles:"
echo "- GET /reports/reporte-general?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"
echo "- GET /reports/reporte-cleaner?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"
echo "- GET /reports/costos-semana?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD"
echo ""
echo "🔗 Ejemplo de uso:"
echo "curl \"$BASE_URL/reports/reporte-general?startDate=2025-09-16&endDate=2025-09-16\""
