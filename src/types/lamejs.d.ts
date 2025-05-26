declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Float32Array, right?: Float32Array): Uint8Array;
    flush(): Uint8Array;
  }

  const lamejs = {
    Mp3Encoder: Mp3Encoder
  };

  export default lamejs;
} 