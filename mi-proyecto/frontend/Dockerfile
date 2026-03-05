# Dockerfile para Nginx — ZonaChat.net
FROM nginx:alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos del frontend
COPY . /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Iniciar nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]