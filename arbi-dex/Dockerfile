# Сборка Angular-приложения
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Продакшен — nginx для раздачи статики и проксирования API
FROM nginx:alpine
# Удаляем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf
# Копируем собранное Angular-приложение
COPY --from=builder /app/dist/arbi-dex/browser /usr/share/nginx/html
# Копируем кастомный nginx-конфиг
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Копируем скрипт подстановки API URL (выполнится при старте контейнера)
COPY docker-entrypoint.sh /docker-entrypoint.d/40-replace-api-url.sh
RUN chmod +x /docker-entrypoint.d/40-replace-api-url.sh
EXPOSE 80

