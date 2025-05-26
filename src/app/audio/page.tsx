'use client'

import { useState, useEffect } from 'react'
import UniversalCompressor from '@/components/compressors/UniversalCompressor'
import { UniversalAudioCompressor } from '@/lib/compressors/UniversalAudioCompressor'
import Head from 'next/head'

export default function AudioCompressPage() {
  const [compressor, setCompressor] = useState<UniversalAudioCompressor | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    try {
      const newCompressor = new UniversalAudioCompressor({
        quality: 0.8,
        bitrate: 128,
        sampleRate: 44100,
        channels: 2,
        format: 'mp3'
      })
      setCompressor(newCompressor)
    } catch (err) {
      console.error('Failed to initialize compressor:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize audio compressor')
    }
  }, [])

  const handleCompress = async (file: File) => {
    if (!compressor) {
      throw new Error('Compressor not initialized')
    }
    try {
      const result = await compressor.compressAudio(file)
      return result
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Compression failed')
    }
  }

  if (!isClient) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>
  }

  return (
    <>
      <Head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js" />
      </Head>
      <div className="container mx-auto px-4 py-8">
        <UniversalCompressor
          type="audio"
          title="Audio Compression"
          description="Compress your audio files while maintaining quality. Supports MP3, WAV, and other common audio formats."
          acceptedFileTypes="audio/*"
          maxFileSize={100 * 1024 * 1024} // 100MB
          onCompress={handleCompress}
        />
      </div>
    </>
  )
} 