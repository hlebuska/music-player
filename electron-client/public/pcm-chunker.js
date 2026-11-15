// AudioWorklet: runs on the audio thread and receives the mic in tiny blocks of
// 128 samples. It collects them into chunks of 1280 samples (80 ms at 16 kHz),
// the size openWakeWord works in, and posts each chunk to the page.
// Plain JS in public/ because worklets are loaded by URL, not bundled.
const CHUNK = 1280;

class PcmChunker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(CHUNK);
    this.filled = 0;
  }

  process(inputs) {
    const samples = inputs[0][0]; // first input, first (mono) channel
    if (!samples) return true;
    let offset = 0;
    while (offset < samples.length) {
      const n = Math.min(CHUNK - this.filled, samples.length - offset);
      this.buffer.set(samples.subarray(offset, offset + n), this.filled);
      this.filled += n;
      offset += n;
      if (this.filled === CHUNK) {
        this.port.postMessage(this.buffer);
        this.buffer = new Float32Array(CHUNK);
        this.filled = 0;
      }
    }
    return true; // keep running
  }
}

registerProcessor('pcm-chunker', PcmChunker);
