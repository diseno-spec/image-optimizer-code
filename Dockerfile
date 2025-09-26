# Imagen base oficial de Node.js
FROM node:20-slim

# Instalar dependencias necesarias para Sharp
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar package.json y lock
COPY package*.json ./

# Instalar dependencias
RUN npm install --only=production

# Copiar el resto del código
COPY . .

# Exponer el puerto usado por Functions Framework
ENV PORT=8080
EXPOSE 8080

# Definir el comando de inicio
CMD ["npx", "functions-framework", "--target=optimizeImage", "--port=8080"]
