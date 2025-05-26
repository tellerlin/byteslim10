// 通用图片压缩模块
import { imageCompressorConfig } from '../config/imageCompressorConfig';

interface ImageCompressorConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  scale: number;
  format: string;
  mode?: 'normal' | 'aggressive' | 'maximum';
}

interface CompressionResult {
  name: string;
  size: number;
  blob: Blob;
  originalSize: number;
  width: number;
  height: number;
  hasTransparency: boolean;
  outputFormat: string;
  compressionRatio: string;
  error?: string;
}

interface CompressionProgress {
  progress: number;
  fileName: string;
  status: string;
}

export class UniversalImageCompressor {
  private options: ImageCompressorConfig;
  private worker: Worker | null;
  private compressionQueue: CompressionResult[];
  private isProcessing: boolean;

  constructor(options: Partial<ImageCompressorConfig> = {}) {
    this.options = {
      ...imageCompressorConfig,
      ...options
    };
    
    this.worker = null;
    this.compressionQueue = [];
    this.isProcessing = false;
  }

  private createCompressionWorker(): Worker | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return new Worker(new URL('./imageCompressionWorker.ts', import.meta.url));
  }

  /**
   * 压缩单个图片文件
   * @param {File|Blob} file - 图片文件
   * @param {Object} settings - 压缩设置
   * @returns {Promise<Object>} 压缩结果
   */
  async compressImage(file: File | Blob, settings: Partial<ImageCompressorConfig> = {}): Promise<CompressionResult> {
    if (!this.worker) {
      this.worker = this.createCompressionWorker();
    }
    
    const compressionSettings = { 
      ...this.options, 
      ...settings, 
      originalSize: file.size,
      originalName: file instanceof File ? file.name : ''
    };
    
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 30000);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          this.worker?.postMessage({
            imageData: e.target?.result,
            settings: compressionSettings
          });

          const handleMessage = (event: MessageEvent) => {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', handleMessage);

            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              const { blob, width, height, hasTransparency, outputFormat } = event.data;
              if (!blob) {
                reject(new Error('No blob received from worker'));
                return;
              }

              resolve({
                name: file instanceof File ? file.name : 'compressed_image',
                size: blob.size,
                blob: blob,
                originalSize: file.size,
                width: width,
                height: height,
                hasTransparency: hasTransparency,
                outputFormat: outputFormat,
                compressionRatio: ((file.size - blob.size) / file.size * 100).toFixed(1)
              });
            }
          };

          this.worker?.addEventListener('message', handleMessage);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 批量压缩图片
   * @param {Array} files - 图片文件数组
   * @param {Object} settings - 压缩设置
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 压缩结果数组
   */
  async compressBatch(
    files: (File | Blob)[], 
    settings: Partial<ImageCompressorConfig> = {}, 
    progressCallback?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        if (progressCallback) {
          progressCallback({
            progress: i / totalFiles,
            fileName: file instanceof File ? file.name : `image_${i + 1}`,
            status: 'Processing...'
          });
        }

        const result = await this.compressImage(file, settings);
        results.push(result);

      } catch (error) {
        console.error(`Failed to compress ${file instanceof File ? file.name : `image_${i + 1}`}:`, error);
        results.push({
          name: file instanceof File ? file.name : `image_${i + 1}`,
          size: 0,
          blob: new Blob(),
          originalSize: file.size,
          width: 0,
          height: 0,
          hasTransparency: false,
          outputFormat: 'webp',
          compressionRatio: '0',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (progressCallback) {
      progressCallback({
        progress: 1,
        fileName: 'Batch processing completed',
        status: 'Completed'
      });
    }

    return results;
  }

  /**
   * 获取压缩统计信息
   * @param {Array} results - 压缩结果数组
   * @returns {Object} 统计信息
   */
  getCompressionStats(results: CompressionResult[]) {
    const successResults = results.filter(r => !r.error);
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = successResults.reduce((sum, r) => sum + r.size, 0);
    const totalSaved = totalOriginalSize - totalCompressedSize;

    return {
      totalFiles: results.length,
      successCount: successResults.length,
      failedCount: results.length - successResults.length,
      totalOriginalSize,
      totalCompressedSize,
      totalSaved,
      averageCompressionRatio: totalOriginalSize > 0 ? 
        ((totalSaved / totalOriginalSize) * 100).toFixed(1) : 0
    };
  }

  /**
   * 更新压缩设置
   * @param {Object} newOptions - 新的压缩设置
   */
  updateOptions(newOptions: Partial<ImageCompressorConfig>) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 销毁压缩器
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
} 