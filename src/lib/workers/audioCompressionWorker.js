// 音频压缩 Worker
self.onmessage = async function(e) {
  const { audioData, settings } = e.data;
  try {
    // 发送初始化进度
    self.postMessage({
      type: 'progress',
      progress: 5,
      status: 'Initializing...'
    });

    const response = await fetch(audioData);
    if (!response.ok) throw new Error('Failed to fetch audio data');
    
    // 发送读取进度
    self.postMessage({
      type: 'progress',
      progress: 10,
      status: 'Reading file...'
    });
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    
    // 发送解码进度
    self.postMessage({
      type: 'progress',
      progress: 15,
      status: 'Decoding audio...'
    });
    
    // 解码音频数据
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // 发送处理进度
    self.postMessage({
      type: 'progress',
      progress: 25,
      status: 'Processing audio...'
    });
    
    // 创建离线上下文进行处理
    const offlineContext = new OfflineAudioContext(
      settings.channels,
      audioBuffer.length,
      settings.sampleRate
    );
    
    // 创建源节点
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    // 渲染音频
    const renderedBuffer = await offlineContext.startRendering();
    
    // 发送编码进度
    self.postMessage({
      type: 'progress',
      progress: 35,
      status: 'Preparing encoder...'
    });
    
    // 使用 lamejs 转换为 MP3
    const mp3encoder = new lamejs.Mp3Encoder(
      settings.channels,
      settings.sampleRate,
      settings.bitrate
    );
    
    const mp3Data = [];
    const sampleBlockSize = 1152; // 必须是 576 的倍数
    const numChannels = renderedBuffer.numberOfChannels;
    const numSamples = renderedBuffer.length;
    
    // 发送编码开始进度
    self.postMessage({
      type: 'progress',
      progress: 45,
      status: 'Encoding audio...'
    });
    
    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const leftChunk = renderedBuffer.getChannelData(0).slice(i, i + sampleBlockSize);
      const rightChunk = numChannels > 1 ? 
        renderedBuffer.getChannelData(1).slice(i, i + sampleBlockSize) : 
        leftChunk;
      
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // 发送进度更新
      const progress = Math.min(85, 45 + (i / numSamples) * 40);
      self.postMessage({
        type: 'progress',
        progress: progress,
        status: 'Encoding audio...'
      });
    }
    
    // 发送完成编码进度
    self.postMessage({
      type: 'progress',
      progress: 90,
      status: 'Finalizing...'
    });
    
    const end = mp3encoder.flush();
    if (end.length > 0) {
      mp3Data.push(end);
    }
    
    const resultBlob = new Blob(mp3Data, { type: 'audio/mp3' });
    
    // 发送完成消息
    self.postMessage({
      type: 'complete',
      blob: resultBlob,
      duration: renderedBuffer.duration,
      sampleRate: renderedBuffer.sampleRate,
      channels: renderedBuffer.numberOfChannels,
      originalSize: settings.originalSize,
      outputFormat: settings.format,
      compressionRatio: ((settings.originalSize - resultBlob.size) / settings.originalSize * 100).toFixed(1)
    });
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}; 