const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const functions = require('@google-cloud/functions-framework');

const storage = new Storage();
const OPTIMIZATION_FLAG = 'is-optimized'; // Clave de metadato personalizado

functions.cloudEvent('optimizeImage', async (cloudevent) => {
    const file = cloudevent.data;
    const bucketName = file.bucket;
    const filePath = file.name;
    const contentType = file.contentType;

    // Instanciar el archivo
    const originalFile = storage.bucket(bucketName).file(filePath);

    // 1. FILTRO CLAVE: OBTENER METADATOS DIRECTAMENTE PARA ROMPER EL CICLO
    let customMetadata = {};
    
    try {
        // SOLUCIÓN: Usar getMetadata() garantiza que leemos la etiqueta MÁS RECIENTE.
        const [metadata] = await originalFile.getMetadata();
        
        // La metadata personalizada siempre está en metadata.metadata
        customMetadata = metadata.metadata || {}; 
        
        if (customMetadata[OPTIMIZATION_FLAG] === 'true') {
            console.log(`[EXITO] Archivo ${filePath} ya está marcado como optimizado. Omitiendo la ejecución.`);
            return; // ¡Rompe el ciclo!
        }
    } catch (error) {
        if (error.code === 404) {
            console.log(`[INFO] Archivo ${filePath} no encontrado, puede haber sido eliminado.`);
            return;
        }
        console.error(`Error al leer metadatos de ${filePath}:`, error.message);
        // Si no se puede leer la metadata (error 500), lanzamos el error para que GCS no asuma éxito.
        throw error;
    }
    // ----------------------------------------------------------------------

    // 2. Filtro de tipo de archivo (solo JPG/JPEG).
    if (!contentType || !contentType.startsWith('image/jpeg')) {
        console.log(`[INFO] El archivo ${filePath} no es un JPG/JPEG. Omitiendo.`);
        return;
    }

    // El resto del proceso (descarga, sharp)
    const tempFileId = filePath.split('/').pop();
    const tempFilePath = `/tmp/${tempFileId}`;

    // Descarga
    try {
        await originalFile.download({ destination: tempFilePath });
    } catch (err) {
        console.error(`[ERROR] Falló la descarga de ${filePath}: ${err.message}`);
        throw err;
    }

    // Optimización con Sharp.
    const outputBuffer = await sharp(tempFilePath)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

    // 3. Configuración de Metadatos para Guardar (Añadir la bandera)
    const uploadOptions = {
        contentType: 'image/jpeg',
        metadata: {
            metadata: {
                ...customMetadata, // Se usa la metadata que obtuvimos en el paso 1 (que no tenía la bandera)
                [OPTIMIZATION_FLAG]: 'true' // Marca el archivo como procesado
            }
        }
    };

    // 4. Sobreescritura del archivo
    await originalFile.save(outputBuffer, uploadOptions);

    console.log(`[COMPLETO] Imagen ${filePath} optimizada, sobrescrita y marcada con metadatos.`);

    // 5. Limpieza
    require('fs').unlinkSync(tempFilePath);
});
