'use client'

import { useState } from 'react'
import UniversalCompressor from '@/components/compressors/UniversalCompressor'
import { UniversalPPTCompressor } from '@/lib/compressors/UniversalPPTCompressor'

export default function PPTCompressPage() {
  const [compressor] = useState(() => new UniversalPPTCompressor({
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080,
    format: 'pptx'
  }))

  const handleCompress = async (file: File) => {
    const result = await compressor.compressPPT(file)
    return result
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <UniversalCompressor
        type="ppt"
        title="PPTX Compression"
        description="Compress your PowerPoint presentations while maintaining quality. Supports PPTX format only."
        acceptedFileTypes=".pptx"
        maxFileSize={100 * 1024 * 1024} // 100MB
        onCompress={handleCompress}
      />
    </div>
  )
} 