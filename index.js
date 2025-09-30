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

    // -----------------------------------------------------------
    // 1. FILTRO CLAVE: OBTENER METADATOS DIRECTAMENTE PARA ROMPER EL CICLO
    // -----------------------------------------------------------
    const originalFile = storage.bucket(bucketName).file(filePath);
    let customMetadata = {};
    
    try {
        // Usar getMetadata() garantiza que leemos la etiqueta MÁS RECIENTE del archivo.
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
        throw error;
    }
    // -----------------------------------------------------------

    // 2. Filtro de tipo de archivo (solo JPG/JPEG).
    if (!contentType || !contentType.startsWith('image/jpeg')) {
        console.log(`[INFO] El archivo ${filePath} no es un JPG/JPEG. Omitiendo.`);
        return;
    }

    // Preparación para la descarga
    const tempFileId = filePath.split('/').pop();
    const tempFilePath = `/tmp/${tempFileId}`;

    // Descarga
    try {
        await originalFile.download({ destination: tempFilePath });
    } catch (err) {
        console.error(`[ERROR] Falló la descarga de ${filePath}: ${err.message}`);
        throw err;
    }

    // -----------------------------------------------------------
    // 3. PROCESO DE OPTIMIZACIÓN CON SHARP (CON ROTACIÓN EXIF)
    // -----------------------------------------------------------
    const outputBuffer = await sharp(tempFilePath)
        .rotate() // <--- Gira la imagen según sus metadatos EXIF (SOLUCIÓN al problema de orientación).
        .resize({ 
            width: 1200, 
            height: 1200, 
            fit: sharp.fit.inside, // Ajusta el tamaño para que quepa dentro de 1200x1200, manteniendo la proporción.
            withoutEnlargement: true 
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    // -----------------------------------------------------------

    // 4. Configuración de Metadatos para Guardar (Añadir la bandera)
    const uploadOptions = {
        contentType: 'image/jpeg',
        metadata: {
            metadata: {
                ...customMetadata, // Preserva metadata existente
                [OPTIMIZATION_FLAG]: 'true' // Marca el archivo como procesado
            }
        }
    };

    // 5. Sobreescritura del archivo
    await originalFile.save(outputBuffer, uploadOptions);

    console.log(`[COMPLETO] Imagen ${filePath} optimizada, sobrescrita y marcada con metadatos.`);

    // 6. Limpieza
    try {
        require('fs').unlinkSync(tempFilePath);
    } catch (e) {
        console.warn(`No se pudo eliminar el archivo temporal ${tempFilePath}.`, e.message);
    }
});
