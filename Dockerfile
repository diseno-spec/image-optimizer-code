# Usa una imagen base de Node.js que contenga dependencias de compilación
FROM node:20-slim

# Instala dependencias necesarias para Sharp (libvips)
# Esto asegura que Sharp se compile correctamente.
RUN apt-get update && apt-get install -y \
    libvips-dev \
    build-essential \
    pkg-config \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copia los archivos de definición del proyecto e instala las dependencias
# El comando npm install --omit=dev usa el package.json que tienes
COPY package*.json ./
RUN npm install --omit=dev

# Copia el resto del código fuente (index.js)
COPY . .

# Cloud Run llama a tu función "optimizeImage"
# Esto es esencial para que Cloud Run sepa cómo iniciar el servicio como una función.
CMD ["npx", "@google-cloud/functions-framework", "--target", "optimizeImage"]
