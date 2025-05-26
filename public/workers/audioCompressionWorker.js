self.onmessage = async function(e) {
  const { audioData, settings } = e.data;
  try {
    const response = await fetch(audioData);
    if (!response.ok) throw new Error('Failed to fetch audio data');
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      settings.channels,
      audioBuffer.length,
      settings.sampleRate
    );
    
    // Create source node
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    // Render audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to MP3 using lamejs
    const mp3encoder = new lamejs.Mp3Encoder(
      settings.channels,
      settings.sampleRate,
      settings.bitrate
    );
    
    const mp3Data = [];
    const sampleBlockSize = 1152; // must be multiple of 576
    const numChannels = renderedBuffer.numberOfChannels;
    const numSamples = renderedBuffer.length;
    
    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const leftChunk = renderedBuffer.getChannelData(0).slice(i, i + sampleBlockSize);
      const rightChunk = numChannels > 1 ? 
        renderedBuffer.getChannelData(1).slice(i, i + sampleBlockSize) : 
        leftChunk;
      
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    
    const end = mp3encoder.flush();
    if (end.length > 0) {
      mp3Data.push(end);
    }
    
    const resultBlob = new Blob(mp3Data, { type: 'audio/mp3' });
    
    self.postMessage({
      blob: resultBlob,
      duration: renderedBuffer.duration,
      sampleRate: renderedBuffer.sampleRate,
      channels: renderedBuffer.numberOfChannels,
      originalSize: settings.originalSize,
      outputFormat: settings.format
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}; 