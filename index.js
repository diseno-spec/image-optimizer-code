const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const functions = require('@google-cloud/functions-framework');
const path = require('path'); // Añadimos path por si lo necesitas, aunque no es crítico aquí.

const storage = new Storage();

// CLAVE: Definimos la clave de metadato que usaremos como bandera
const OPTIMIZATION_FLAG = 'is-optimized'; 

functions.cloudEvent('optimizeImage', async (cloudevent) => {
  const file = cloudevent.data;

  const bucketName = file.bucket;
  const filePath = file.name;
  const contentType = file.contentType;

  // --- 1. FILTRO CLAVE: Revisar si la imagen ya tiene la bandera de optimización ---
  // Los metadatos personalizados se incluyen en el evento, bajo la clave 'metadata'.
  const customMetadata = file.metadata || {};
  
  if (customMetadata[OPTIMIZATION_FLAG] === 'true') {
    console.log(`El archivo ${filePath} ya está marcado como optimizado. Omitiendo la ejecución.`);
    return;
  }
  // ---------------------------------------------------------------------------------

  if (!contentType || !contentType.startsWith('image/jpeg')) {
    console.log(`El archivo ${filePath} no es un JPG/JPEG. Omitiendo la optimización.`);
    return;
  }

  const originalFile = storage.bucket(bucketName).file(filePath);
  const tempFileId = filePath.split('/').pop();
  const tempFilePath = `/tmp/${tempFileId}`;

  try {
      // Manejo de error 404 para archivos borrados
      await originalFile.download({ destination: tempFilePath });
  } catch (err) {
      if (err.code === 404) {
          console.log(`El archivo ${filePath} no se encuentra. Terminando el reintento.`);
          return;
      }
      // Reintentar si es otro error de descarga
      throw err;
  }

  // Proceso de optimización
  const outputBuffer = await sharp(tempFilePath)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // --- 2. CLAVE: Preparar las opciones de guardado con la bandera de metadato ---
  const uploadOptions = {
      contentType: 'image/jpeg',
      // La metadata personalizada debe ir anidada bajo la clave 'metadata'
      metadata: {
          ...customMetadata, // Preserva cualquier metadata existente
          [OPTIMIZATION_FLAG]: 'true' // Establece la bandera de procesado
      }
  };
  
  // Sobrescribe el archivo original con la imagen optimizada y la nueva metadata.
  await originalFile.save(outputBuffer, uploadOptions);

  console.log(`Imagen ${filePath} optimizada, sobrescrita y marcada con metadatos.`);

  require('fs').unlinkSync(tempFilePath);
});
