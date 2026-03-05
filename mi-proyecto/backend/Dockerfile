FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación
COPY . .

# Crear directorio de datos si no existe
RUN mkdir -p /app/data

# Exponer el puerto de Flask
EXPOSE 5000

# Comando para ejecutar Flask
CMD ["flask", "run", "--host=0.0.0.0"]