import JSZip, { JSZipObject } from 'jszip';
import { UniversalImageCompressor } from './UniversalImageCompressor'

interface PPTCompressorConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'pptx';
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
  quality: 0.9,
  maxWidth: 1600,
  maxHeight: 900,
  format: 'pptx',
  mode: 'aggressive',
  scale: 1
};

export class UniversalPPTCompressor {
  private options: PPTCompressorConfig;
  private imageCompressor: UniversalImageCompressor;

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

  // 提取PPTX中的媒体图片文件
  private async extractMediaFiles(pptxFile: File): Promise<{ path: string, file: File }[]> {
    const zip = await JSZip.loadAsync(pptxFile);
    const files: Record<string, JSZipObject> = zip.files;
    const mediaFiles: { path: string, file: File }[] = [];
    for (const [path, file] of Object.entries(files)) {
      if (path.startsWith('ppt/media/') && !file.dir) {
        const blob = await file.async('blob');
        mediaFiles.push({
          path,
          file: new File([blob], path.split('/').pop() || 'media', { type: blob.type })
        });
      }
    }
    return mediaFiles;
  }

  // 用压缩后的图片替换PPTX中的原图片并重新打包
  private async repackPPTX(originalPptx: File, compressedMedia: { path: string, compressedBlob: Blob }[]): Promise<Blob> {
    const zip = await JSZip.loadAsync(originalPptx);
    const files: Record<string, JSZipObject> = zip.files;
    for (const media of compressedMedia) {
      if (media.compressedBlob) {
        zip.file(media.path, media.compressedBlob);
      }
    }
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  }

  /**
   * 压缩单个 PPTX 文件
   * @param {File|Blob} file - PPTX 文件
   * @param {Object} settings - 压缩设置
   * @returns {Promise<Object>} 压缩结果
   */
  async compressPPT(file: File | Blob, settings: Partial<PPTCompressorConfig> = {}): Promise<CompressionResult> {
    if (!(file instanceof File)) {
      throw new Error('Only File type is supported for PPTX compression');
    }
    // 1. 提取媒体文件
    const mediaFiles = await this.extractMediaFiles(file);
    if (mediaFiles.length === 0) {
      return {
        name: file.name,
        size: file.size,
        blob: file,
        originalSize: file.size,
        pageCount: 0,
        outputFormat: '',
        compressionRatio: '0',
        error: 'No media files found in PPTX'
      };
    }
    // 2. 压缩图片
    const imageFiles = mediaFiles.map(m => m.file);
    const compressedResults = await this.imageCompressor.compressBatch(imageFiles, { ...this.options, ...settings });
    // 3. 重新打包
    const compressedMedia = mediaFiles.map((media, i) => ({
      path: media.path,
      compressedBlob: compressedResults[i].blob
    }));
    const compressedPPTX = await this.repackPPTX(file, compressedMedia);
    // 4. 返回结果
    return {
      name: file.name.replace('.pptx', '_compressed.pptx'),
      size: compressedPPTX.size,
      blob: compressedPPTX,
      originalSize: file.size,
      pageCount: 0,
      outputFormat: '',
      compressionRatio: ((file.size - compressedPPTX.size) / file.size * 100).toFixed(1) + '%'
    };
  }

  /**
   * 批量压缩 PPTX
   * @param {Array} files - PPTX 文件数组
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
            fileName: file instanceof File ? file.name : `pptx_${i + 1}`,
            status: 'Processing...'
          });
        }

        const result = await this.compressPPT(file, settings);
        results.push(result);

      } catch (error) {
        console.error(`Failed to compress ${file instanceof File ? file.name : `pptx_${i + 1}`}:`, error);
        results.push({
          name: file instanceof File ? file.name : `pptx_${i + 1}`,
          size: 0,
          blob: new Blob(),
          originalSize: file.size,
          pageCount: 0,
          outputFormat: '',
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
    this.imageCompressor.destroy();
  }
} 