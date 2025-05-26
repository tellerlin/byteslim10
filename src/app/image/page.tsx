'use client'

import UniversalCompressor from '@/components/compressors/UniversalCompressor'
import { UniversalImageCompressor } from '@/lib/compressors/UniversalImageCompressor'

export default function ImageCompressPage() {
  const handleCompress = async (file: File) => {
    const compressor = new UniversalImageCompressor({
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      scale: 1,
      format: 'auto'
    })

    const result = await compressor.compressImage(file)
    return result
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <UniversalCompressor
        type="image"
        title="Image Compression"
        description="Compress your images while maintaining quality. Supports JPG, PNG, and other common image formats."
        acceptedFileTypes="image/*"
        maxFileSize={50 * 1024 * 1024} // 50MB
        onCompress={handleCompress}
      />
    </div>
  )
} 