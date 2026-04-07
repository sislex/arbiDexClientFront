#!/bin/sh
set -e

# Подставляем API URL: заменяем захардкоженный localhost URL на относительный /api
# чтобы nginx проксировал запросы к бэкенду
API_URL="${API_BASE_URL:-/api}"
find /usr/share/nginx/html -name '*.js' -exec sed -i "s|http://localhost:3006/api|${API_URL}|g" {} +

echo "API URL replaced with: ${API_URL}"

