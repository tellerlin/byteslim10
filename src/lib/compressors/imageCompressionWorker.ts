interface CompressionSettings {
    maxWidth: number;
    maxHeight: number;
    scale: number;
    quality: number;
    mode?: 'normal' | 'aggressive' | 'maximum';
    format: string;
    originalSize: number;
    originalName?: string;
}

interface CompressionResult {
    blob: Blob;
    width: number;
    height: number;
    originalSize: number;
    hasTransparency: boolean;
    outputFormat: string;
}

interface CompressionError {
    error: string;
}

self.onmessage = async function(e: MessageEvent<{ imageData: string; settings: CompressionSettings }>) {
    const { imageData, settings } = e.data;
    try {
        const response = await fetch(imageData);
        if (!response.ok) throw new Error('Failed to fetch image data');
        
        const blob = await response.blob();
        
        // Handle special file formats
        const fileType = blob.type.toLowerCase();
        const fileName = settings.originalName?.toLowerCase() || '';
        
        // List of formats that should be passed through without processing
        const passThroughFormats = [
            'image/svg+xml',
            'image/tiff',
            'image/x-tiff',
            'image/tif',
            'image/x-tif',
            'image/x-emf',
            'image/emf',
            'application/x-emf',
            'application/emf'
        ];
        
        // Check if file should be passed through
        if (passThroughFormats.includes(fileType) || 
            fileName.endsWith('.svg') || 
            fileName.endsWith('.tiff') || 
            fileName.endsWith('.tif') ||
            fileName.endsWith('.emf')) {
            
            // For special formats, return the original blob
            self.postMessage({
                blob: blob,
                width: 0,
                height: 0,
                originalSize: settings.originalSize,
                hasTransparency: true,
                outputFormat: fileType.split('/')[1] || 'unknown'
            } as CompressionResult);
            return;
        }
        
        // For supported formats, proceed with normal processing
        const bitmap = await createImageBitmap(blob);
        
        // Check if PNG format or has transparency
        const isPNG = blob.type === 'image/png' || settings.originalName?.toLowerCase().endsWith('.png');
        let hasTransparency = false;
        
        // Create temporary canvas to check transparency
        const testCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const testCtx = testCanvas.getContext('2d');
        if (!testCtx) throw new Error('Failed to get test canvas context');
        
        testCtx.drawImage(bitmap, 0, 0);
        
        // Check for transparent pixels
        if (isPNG) {
            const imageData = testCtx.getImageData(0, 0, bitmap.width, bitmap.height);
            const data = imageData.data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 255) {
                    hasTransparency = true;
                    break;
                }
            }
        }
        
        let width = bitmap.width;
        let height = bitmap.height;
        
        // Size limits
        if (width > settings.maxWidth) {
            height = (settings.maxWidth * height) / width;
            width = settings.maxWidth;
        }
        if (height > settings.maxHeight) {
            width = (settings.maxHeight * width) / height;
            height = settings.maxHeight;
        }
        
        // Scale processing
        width = Math.max(1, Math.round(width * settings.scale));
        height = Math.max(1, Math.round(height * settings.scale));
        
        const resizedCanvas = new OffscreenCanvas(width, height);
        const resizedCtx = resizedCanvas.getContext('2d');
        
        if (!resizedCtx) throw new Error('Failed to get resized canvas context');
        
        // Determine output format based on transparency
        let outputFormat = settings.format;
        // 如果目标是jpeg/jpg且有透明，自动切换为png
        if ((outputFormat === 'jpeg' || outputFormat === 'jpg') && hasTransparency) {
            outputFormat = 'png';
        }
        
        // 只有在输出jpeg/jpg且无透明时才填充白底
        if ((outputFormat === 'jpeg' || outputFormat === 'jpg') && !hasTransparency) {
            resizedCtx.fillStyle = '#FFFFFF';
            resizedCtx.fillRect(0, 0, width, height);
        }
        
        resizedCtx.drawImage(bitmap, 0, 0, width, height);
        
        // Quality adjustment
        let quality = Math.max(0.1, Math.min(1, settings.quality));
        if (settings.mode === 'aggressive') {
            quality *= 0.8;
        } else if (settings.mode === 'maximum') {
            quality *= 0.6;
        }
        
        const blobOptions: BlobPropertyBag & { quality?: number } = { type: 'image/' + outputFormat };
        if (outputFormat !== 'png') {
            blobOptions.quality = quality;
        }
        
        const resultBlob = await resizedCanvas.convertToBlob(blobOptions);
        
        bitmap.close();
        
        self.postMessage({
            blob: resultBlob,
            width: width,
            height: height,
            originalSize: settings.originalSize,
            hasTransparency: hasTransparency,
            outputFormat: outputFormat
        } as CompressionResult);
    } catch (error) {
        self.postMessage({ error: (error as Error).message } as CompressionError);
    }
}; 