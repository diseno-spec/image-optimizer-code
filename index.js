const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const functions = require('@google-cloud/functions-framework');

const storage = new Storage();

functions.cloudEvent('optimizeImage', async (cloudevent) => {
  const file = cloudevent.data;

  const bucketName = file.bucket;
  const filePath = file.name;
  const contentType = file.contentType;

  if (!contentType || !contentType.startsWith('image/jpeg')) {
    console.log(`El archivo ${filePath} no es un JPG/JPEG. Omitiendo la optimización.`);
    return;
  }

  const originalFile = storage.bucket(bucketName).file(filePath);
  const tempFilePath = `/tmp/${filePath.split('/').pop()}`;

  try {
      await originalFile.download({ destination: tempFilePath });
  } catch (err) {
      if (err.code === 404) {
          console.log(`El archivo ${filePath} no se encuentra. Terminando el reintento.`);
          return;
      }
      throw err;
  }

  const outputBuffer = await sharp(tempFilePath)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  await originalFile.save(outputBuffer, { contentType: 'image/jpeg' });

  console.log(`Imagen ${filePath} optimizada en formato JPG.`);

  require('fs').unlinkSync(tempFilePath);
});
En la misma carpeta, crea un archivo llamado package.json y pega este código (el mismo que ya habíamos modificado para postinstall):

JSON

{
  "name": "image-optimizer",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "postinstall": "npm install sharp --ignore-scripts --unsafe-perm=true"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "@google-cloud/storage": "^6.0.0",
    "sharp": "^0.32.0"
  }
}