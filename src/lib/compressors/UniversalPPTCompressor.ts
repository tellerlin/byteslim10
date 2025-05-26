import { UniversalImageCompressor } from './UniversalImageCompressor'

interface PPTCompressorConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'pptx' | 'pdf';
  mode?: 'normal' | 'aggressive' | 'maximum';
  scale?: number;
}

interface CompressionResult {
  name: string;
  size: number;
  blob: Blob;
  originalSize: number;
  pageCount: number;
  outputFormat: string;
  compressionRatio: string;
  error?: string;
}

interface CompressionProgress {
  progress: number;
  fileName: string;
  status: string;
}

const defaultConfig: PPTCompressorConfig = {
  quality: 0.7,
  maxWidth: 1600,
  maxHeight: 1200,
  format: 'pptx',
  mode: 'maximum',
  scale: 0.9
};

export class UniversalPPTCompressor {
  private options: PPTCompressorConfig;
  private imageCompressor: UniversalImageCompressor;
  private worker: Worker | null = null;

  constructor(options: Partial<PPTCompressorConfig> = {}) {
    this.options = {
      ...defaultConfig,
      ...options
    };
    
    this.imageCompressor = new UniversalImageCompressor({
      format: 'webp',
      quality: this.options.quality,
      maxWidth: this.options.maxWidth,
      maxHeight: this.options.maxHeight,
      scale: this.options.scale,
      mode: this.options.mode
    });
  }

  private createCompressionWorker(): Worker | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return new Worker(URL.createObjectURL(new Blob([`
      self.onmessage = async function(e) {
        const { pptData, settings } = e.data;
        try {
          const response = await fetch(pptData);
          if (!response.ok) throw new Error('Failed to fetch PPT data');
          
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          
          // 使用 PDF.js 处理 PPT
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdf.numPages;
          
          // 处理每一页
          const processedPages = [];
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            
            // 创建 canvas 进行渲染
            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');
            
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            // 压缩图像
            const compressedImage = await compressImage(canvas, settings);
            processedPages.push(compressedImage);
          }
          
          // 合并处理后的页面
          const resultBlob = await combinePages(processedPages, settings);
          
          self.postMessage({
            blob: resultBlob,
            pageCount: numPages,
            originalSize: settings.originalSize,
            outputFormat: settings.format
          });
        } catch (error) {
          self.postMessage({ error: error.message });
        }
      };

      // 压缩图像
      async function compressImage(canvas, settings) {
        const blob = await canvas.convertToBlob({
          type: 'image/webp',
          quality: settings.quality
        });
        return blob;
      }

      // 合并页面
      async function combinePages(pages, settings) {
        // 这里需要实现页面合并逻辑
        // 可以使用 PDFKit 或其他库
        // 暂时返回第一页作为示例
        return pages[0];
      }
    `], { type: 'text/javascript' })));
  }

  /**
   * 压缩单个 PPT 文件
   * @param {File|Blob} file - PPT 文件
   * @param {Object} settings - 压缩设置
   * @returns {Promise<Object>} 压缩结果
   */
  async compressPPT(file: File | Blob, settings: Partial<PPTCompressorConfig> = {}): Promise<CompressionResult> {
    if (!this.worker) {
      this.worker = this.createCompressionWorker();
    }

    if (!this.worker) {
      throw new Error('Worker not available');
    }
    
    const compressionSettings = { 
      ...this.options, 
      ...settings, 
      originalSize: file.size,
      originalName: file instanceof File ? file.name : ''
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 30000);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          this.worker?.postMessage({
            pptData: e.target?.result,
            settings: compressionSettings
          });

          const handleMessage = (event: MessageEvent) => {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', handleMessage);

            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              const { blob, pageCount, outputFormat } = event.data;
              if (!blob) {
                reject(new Error('No blob received from worker'));
                return;
              }

              resolve({
                name: file instanceof File ? file.name : 'compressed_ppt',
                size: blob.size,
                blob: blob,
                originalSize: file.size,
                pageCount: pageCount,
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
   * 批量压缩 PPT
   * @param {Array} files - PPT 文件数组
   * @param {Object} settings - 压缩设置
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 压缩结果数组
   */
  async compressBatch(
    files: (File | Blob)[], 
    settings: Partial<PPTCompressorConfig> = {}, 
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
            fileName: file instanceof File ? file.name : `ppt_${i + 1}`,
            status: 'Processing...'
          });
        }

        const result = await this.compressPPT(file, settings);
        results.push(result);

      } catch (error) {
        console.error(`Failed to compress ${file instanceof File ? file.name : `ppt_${i + 1}`}:`, error);
        results.push({
          name: file instanceof File ? file.name : `ppt_${i + 1}`,
          size: 0,
          blob: new Blob(),
          originalSize: file.size,
          pageCount: 0,
          outputFormat: 'pptx',
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
  updateOptions(newOptions: Partial<PPTCompressorConfig>) {
    this.options = { ...this.options, ...newOptions };
    this.imageCompressor.updateOptions({
      format: 'webp',
      quality: this.options.quality,
      maxWidth: this.options.maxWidth,
      maxHeight: this.options.maxHeight,
      scale: this.options.scale,
      mode: this.options.mode
    });
  }

  /**
   * 销毁压缩器
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.imageCompressor.destroy();
  }
} 