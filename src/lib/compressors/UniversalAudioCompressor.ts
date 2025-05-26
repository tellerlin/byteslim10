/// <reference lib="webworker" />

declare const Worker: {
  new(stringUrl: string): Worker;
};

// 添加 lamejs 的类型声明
declare global {
  interface Window {
    lamejs: {
      Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
        encodeBuffer: (left: Float32Array, right: Float32Array) => Uint8Array;
        flush: () => Uint8Array;
      };
    };
  }
  const lamejs: Window['lamejs'];
}

interface AudioCompressorConfig {
  quality: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  format: 'mp3' | 'ogg' | 'wav';
  mode?: 'normal' | 'aggressive' | 'maximum';
  bitDepth?: number;
}

interface CompressionResult {
  name: string;
  size: number;
  blob: Blob;
  originalSize: number;
  duration: number;
  sampleRate: number;
  channels: number;
  outputFormat: string;
  compressionRatio: string;
  error?: string;
}

interface CompressionProgress {
  progress: number;
  fileName: string;
  status: string;
}

interface CompressionStats {
  totalFiles: number;
  successCount: number;
  failedCount: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSaved: number;
  averageCompressionRatio: string;
}

const defaultConfig: AudioCompressorConfig = {
  quality: 0.8,
  bitrate: 128,
  sampleRate: 44100,
  channels: 2,
  format: 'mp3',
  mode: 'normal',
  bitDepth: 16
};

export class UniversalAudioCompressor {
  private options: AudioCompressorConfig;
  private lamejs: any;
  private compressionHistory: Array<{
    timestamp: string;
    originalFile: string;
    originalSize: number;
    compressedSize: number;
    settings: AudioCompressorConfig;
  }> = [];

  constructor(options: Partial<AudioCompressorConfig> = {}) {
    if (typeof window === 'undefined') {
      throw new Error('Audio compression is only available in browser environment');
    }
    
    this.options = {
      ...defaultConfig,
      ...options
    };

    this.lamejs = null;
  }

  async initLamejs(): Promise<void> {
    try {
      console.log('Initializing lamejs...');
      
      // 优先使用全局 lamejs
      if (typeof window !== 'undefined' && window.lamejs) {
        this.lamejs = window.lamejs;
        console.log('Using global lamejs');
        return;
      }

      console.log('Global lamejs not found, trying dynamic import...');

      // 如果全局没有，尝试动态导入
      try {
        const lamejsModule = await import('lamejs');
        this.lamejs = lamejsModule.default || lamejsModule;
        console.log('Using imported lamejs');
      } catch (error) {
        console.warn('Failed to import lamejs module:', error);
        
        console.log('Trying CDN lamejs...');
        // 最后尝试从 CDN 加载的全局变量
        if (typeof lamejs !== 'undefined') {
          this.lamejs = lamejs;
          console.log('Using CDN lamejs');
        } else {
          console.error('No lamejs found in any source');
          throw new Error('lamejs library not available');
        }
      }
      
      // 验证 lamejs 是否正确加载
      if (!this.lamejs || typeof this.lamejs.Mp3Encoder !== 'function') {
        console.error('lamejs Mp3Encoder not available');
        throw new Error('lamejs Mp3Encoder not available');
      }
      
      console.log('lamejs loaded successfully');
    } catch (error) {
      console.error('Failed to load lamejs:', error);
      throw new Error('Audio compression library failed to load. Please try refreshing the page.');
    }
  }

  async compressAudio(
    file: File | Blob, 
    settings: Partial<AudioCompressorConfig> = {},
    onProgress?: (progress: number) => void
  ): Promise<CompressionResult> {
    if (typeof window === 'undefined') {
      throw new Error('Audio compression is only available in browser environment');
    }

    console.log('Starting audio compression...');

    // 确保 lamejs 已加载
    if (!this.lamejs) {
      console.log('lamejs not initialized, initializing now...');
      await this.initLamejs();
    }

    const compressionSettings = { 
      ...this.options, 
      ...settings, 
      originalSize: file.size,
      originalName: file instanceof File ? file.name : ''
    };
    
    console.log('Compression settings:', compressionSettings);
    
    return new Promise(async (resolve, reject) => {
      try {
        // 初始化阶段 (0-10%)
        onProgress?.(0);
        console.log('Reading file data...');
        const arrayBuffer = await file.arrayBuffer();
        onProgress?.(0.05);
        
        // 音频上下文创建和解码 (10-30%)
        console.log('Creating audio context...');
        const audioContext = new AudioContext();
        onProgress?.(0.1);
        
        console.log('Decoding audio data...');
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        onProgress?.(0.2);
        
        // 离线上下文处理 (30-50%)
        console.log('Creating offline context...');
        const offlineContext = new OfflineAudioContext(
          compressionSettings.channels,
          audioBuffer.length,
          compressionSettings.sampleRate
        );
        onProgress?.(0.3);
        
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        onProgress?.(0.35);
        
        console.log('Rendering audio...');
        const renderedBuffer = await offlineContext.startRendering();
        onProgress?.(0.5);
        
        // MP3 编码准备 (50-60%)
        console.log('Creating MP3 encoder...');
        const mp3encoder = new this.lamejs.Mp3Encoder(
          compressionSettings.channels,
          compressionSettings.sampleRate,
          compressionSettings.bitrate
        );
        onProgress?.(0.55);
        
        // MP3 编码过程 (60-95%)
        const mp3Data = [];
        const sampleBlockSize = 1152; // 必须是 576 的倍数
        const numChannels = renderedBuffer.numberOfChannels;
        const numSamples = renderedBuffer.length;
        const totalBlocks = Math.ceil(numSamples / sampleBlockSize);
        
        console.log('Encoding audio data...');
        for (let i = 0; i < numSamples; i += sampleBlockSize) {
          const leftChunk = renderedBuffer.getChannelData(0).slice(i, i + sampleBlockSize);
          const rightChunk = numChannels > 1 ? 
            renderedBuffer.getChannelData(1).slice(i, i + sampleBlockSize) : 
            leftChunk;
          
          const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }

          // 更新进度 (60% - 95%)
          const blockProgress = i / numSamples;
          const progress = 0.6 + (blockProgress * 0.35);
          onProgress?.(progress);
        }
        
        // 完成编码 (95-100%)
        onProgress?.(0.95);
        console.log('Finalizing MP3 encoding...');
        const end = mp3encoder.flush();
        if (end.length > 0) {
          mp3Data.push(end);
        }
        
        const resultBlob = new Blob(mp3Data, { type: 'audio/mp3' });
        
        // 保存到历史记录
        this.compressionHistory.push({
          timestamp: new Date().toISOString(),
          originalFile: file instanceof File ? file.name : 'unknown',
          originalSize: file.size,
          compressedSize: resultBlob.size,
          settings: { ...compressionSettings }
        });
        
        onProgress?.(1);
        console.log('Compression completed successfully');
        resolve({
          name: file instanceof File ? file.name : 'compressed_audio',
          size: resultBlob.size,
          blob: resultBlob,
          originalSize: file.size,
          duration: renderedBuffer.duration,
          sampleRate: renderedBuffer.sampleRate,
          channels: renderedBuffer.numberOfChannels,
          outputFormat: compressionSettings.format,
          compressionRatio: ((file.size - resultBlob.size) / file.size * 100).toFixed(1)
        });
      } catch (error) {
        console.error('Audio compression failed:', error);
        reject(error);
      }
    });
  }

  /**
   * 批量压缩音频
   * @param {Array} files - 音频文件数组
   * @param {Object} settings - 压缩设置
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 压缩结果数组
   */
  async compressBatch(
    files: (File | Blob)[], 
    settings: Partial<AudioCompressorConfig> = {}, 
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
            fileName: file instanceof File ? file.name : `audio_${i + 1}`,
            status: 'Processing...'
          });
        }

        const result = await this.compressAudio(file, settings);
        results.push(result);

      } catch (error) {
        console.error(`Failed to compress ${file instanceof File ? file.name : `audio_${i + 1}`}:`, error);
        results.push({
          name: file instanceof File ? file.name : `audio_${i + 1}`,
          size: 0,
          blob: new Blob(),
          originalSize: file.size,
          duration: 0,
          sampleRate: 0,
          channels: 0,
          outputFormat: 'mp3',
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
  getCompressionStats(results: CompressionResult[]): CompressionStats {
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
        ((totalSaved / totalOriginalSize) * 100).toFixed(1) : '0'
    };
  }

  /**
   * 更新压缩设置
   * @param {Object} newOptions - 新的压缩设置
   */
  updateOptions(newOptions: Partial<AudioCompressorConfig>) {
    this.options = { ...this.options, ...newOptions };
  }
} 