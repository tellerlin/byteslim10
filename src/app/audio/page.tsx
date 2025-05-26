'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import UniversalCompressor from '@/components/compressors/UniversalCompressor'
import { UniversalAudioCompressor } from '@/lib/compressors/UniversalAudioCompressor'

export default function AudioCompressPage() {
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLameLoaded, setIsLameLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const compressorRef = useRef<UniversalAudioCompressor | null>(null)
  const compressorInitPromise = useRef<Promise<UniversalAudioCompressor> | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const verifyLamejs = useCallback(() => {
    if (typeof window === 'undefined') return false
    if (window.lamejs && typeof window.lamejs.Mp3Encoder === 'function') {
      console.log('Using global lamejs')
      return true
    }
    console.log('window.lamejs is', window.lamejs)
    return false
  }, [])

  // 初始化压缩器，返回Promise，保证只初始化一次
  const initializeCompressor = useCallback((): Promise<UniversalAudioCompressor> => {
    if (compressorRef.current) {
      setIsInitialized(true)
      return Promise.resolve(compressorRef.current)
    }
    if (compressorInitPromise.current) {
      return compressorInitPromise.current
    }
    compressorInitPromise.current = new Promise<UniversalAudioCompressor>((resolve, reject) => {
      try {
        if (verifyLamejs()) {
          const newCompressor = new UniversalAudioCompressor({
            quality: 0.8,
            bitrate: 128,
            sampleRate: 44100,
            channels: 2,
            format: 'mp3',
          })
          compressorRef.current = newCompressor
          setIsInitialized(true)
          console.log('Compressor initialized successfully')
          resolve(newCompressor)
        } else {
          throw new Error('lamejs Mp3Encoder not available')
        }
      } catch (err) {
        console.error('Failed to initialize compressor:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize audio compressor')
        reject(err)
      }
    })
    return compressorInitPromise.current
  }, [verifyLamejs])

  // lamejs加载后立即初始化
  useEffect(() => {
    if (isLameLoaded && !isInitialized) {
      initializeCompressor()
    }
  }, [isLameLoaded, isInitialized, initializeCompressor])

  // 用原生<script>动态插入lamejs
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.lamejs) {
      setIsLameLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js'
    script.async = true
    script.onload = () => {
      console.log('Native script loaded, window.lamejs:', window.lamejs)
      setIsLameLoaded(true)
    }
    script.onerror = (e) => {
      console.error('Failed to load lamejs:', e)
      setError('Failed to load audio compression library')
    }
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // 压缩处理，确保compressor已初始化
  const handleCompress = async (file: File) => {
    let compressor = compressorRef.current
    if (!compressor) {
      try {
        compressor = await initializeCompressor()
      } catch (err) {
        throw new Error('Compressor not initialized')
      }
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