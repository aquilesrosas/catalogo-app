# Dockerfile para compilar y servir la versión Web de la app Expo
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY patches/ ./patches/
RUN npm ci

COPY . .
# Generar versión estática web en carpeta dist/
RUN npx expo export -p web

# Servir con Nginx (Alpine) ligero
FROM public.ecr.aws/docker/library/nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Redirigir siempre a index.html (regla SPA para Expo Router)
RUN echo "server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
