import { useState, useCallback } from 'react'
import FileUpload from '@/components/ui/FileUpload'

interface CompressorProps {
  type: string
  title: string
  description: string
  acceptedFileTypes: string
  maxFileSize?: number
  onCompress: (file: File) => Promise<{
    name: string
    size: number
    originalSize: number
    width?: number
    height?: number
    hasTransparency?: boolean
    outputFormat?: string
    compressionRatio?: string
    blob?: Blob
  }>
}

export default function UniversalCompressor({
  type,
  title,
  description,
  acceptedFileTypes,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  onCompress
}: CompressorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    name: string
    size: number
    originalSize: number
    width?: number
    height?: number
    hasTransparency?: boolean
    outputFormat?: string
    compressionRatio?: string
    blob?: Blob
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)
  }, [])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
  }, [])

  const handleCompress = useCallback(async () => {
    if (!file) return

    setIsCompressing(true)
    setProgress(0)
    setError(null)

    try {
      const result = await onCompress(file)
      setResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed')
    } finally {
      setIsCompressing(false)
    }
  }, [file, onCompress])

  const handleDownload = useCallback(() => {
    if (!result?.blob) return

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result])

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  return (
    <div className={`max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md compressor-${type}`}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="text-gray-600 mb-6">{description}</p>

      <div className="space-y-4">
        <FileUpload
          accept={acceptedFileTypes}
          maxSize={maxFileSize}
          onFileSelect={handleFileSelect}
          onError={handleError}
        />

        {file && (
          <div className="text-sm text-gray-600">
            Selected: {file.name} ({formatFileSize(file.size)})
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        {isCompressing && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {file && !isCompressing && !result && (
          <button
            onClick={handleCompress}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Compress
          </button>
        )}

        {result && (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Compression Results:</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-600">File Name:</div>
                  <div>{result.name}</div>
                  
                  <div className="text-gray-600">Original Size:</div>
                  <div>{formatFileSize(result.originalSize)}</div>
                  
                  <div className="text-gray-600">Compressed Size:</div>
                  <div>{formatFileSize(result.size)}</div>
                  
                  {result.width && result.height && (
                    <>
                      <div className="text-gray-600">Dimensions:</div>
                      <div>{result.width} x {result.height}</div>
                    </>
                  )}
                  
                  {result.hasTransparency !== undefined && (
                    <>
                      <div className="text-gray-600">Transparency:</div>
                      <div>{result.hasTransparency ? 'Yes' : 'No'}</div>
                    </>
                  )}
                  
                  {result.outputFormat && (
                    <>
                      <div className="text-gray-600">Output Format:</div>
                      <div>{result.outputFormat}</div>
                    </>
                  )}
                  
                  {result.compressionRatio && (
                    <>
                      <div className="text-gray-600">Compression Ratio:</div>
                      <div>{result.compressionRatio}</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {result.blob && (
              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  Download Compressed File
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 