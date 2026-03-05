FROM python:3.10-slim

WORKDIR /app

# Copiamos e instalamos dependencias primero (aprovecha la caché de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos el resto del código
COPY . .

# Exponemos el puerto por defecto de Flask
EXPOSE 5000

# Comando para levantar Flask permitiendo conexiones externas
CMD ["flask", "run", "--host=0.0.0.0"]