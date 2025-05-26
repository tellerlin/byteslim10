import { useCallback } from 'react'

interface FileUploadProps {
  accept: string
  maxSize?: number
  onFileSelect: (file: File) => void
  onError?: (error: string) => void
  className?: string
}

export default function FileUpload({
  accept,
  maxSize = 100 * 1024 * 1024, // 100MB default
  onFileSelect,
  onError,
  className = ''
}: FileUploadProps) {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > maxSize) {
      onError?.(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`)
      return
    }

    onFileSelect(file)
  }, [maxSize, onFileSelect, onError])

  return (
    <div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${className}`}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Choose File
      </label>
      <p className="mt-2 text-sm text-gray-500">
        Max file size: {maxSize / (1024 * 1024)}MB
      </p>
    </div>
  )
} 