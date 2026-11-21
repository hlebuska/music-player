// Silero VAD: speech probability 0..1 for each 32 ms of 16 kHz audio.
// Ported from OnnxWrapper in https://github.com/snakers4/silero-vad
import * as ort from 'onnxruntime-web';
import { SAMPLE_RATE, loadModel } from '@/wakeword/detector';

const WINDOW = 512; // the only window size the model takes at 16 kHz
const CONTEXT = 64; // tail of the previous window, prepended to each one
const STATE_SHAPE = [2, 1, 128];

export class VoiceActivityDetector {
  private state: Float32Array = new Float32Array(2 * 128);
  private context = new Float32Array(CONTEXT);
  private pending = new Float32Array(0);
  private readonly sr = new ort.Tensor(
    'int64',
    BigInt64Array.from([BigInt(SAMPLE_RATE)]),
    [],
  );

  private constructor(private session: ort.InferenceSession) {}

  static async create() {
    return new VoiceActivityDetector(await loadModel('silero_vad.onnx'));
  }

  reset() {
    this.state.fill(0);
    this.context.fill(0);
    this.pending = new Float32Array(0);
  }

  /** Feed audio of any length (samples -1..1); returns the highest speech
   *  probability among the full windows it completed, or null if none. */
  async process(chunk: Float32Array): Promise<number | null> {
    const audio = new Float32Array(this.pending.length + chunk.length);
    audio.set(this.pending);
    audio.set(chunk, this.pending.length);

    let best: number | null = null;
    let offset = 0;
    for (; offset + WINDOW <= audio.length; offset += WINDOW) {
      const input = new Float32Array(CONTEXT + WINDOW);
      input.set(this.context);
      input.set(audio.subarray(offset, offset + WINDOW), CONTEXT);
      this.context = input.slice(-CONTEXT);

      const output = await this.session.run({
        input: new ort.Tensor('float32', input, [1, input.length]),
        state: new ort.Tensor('float32', this.state, STATE_SHAPE),
        sr: this.sr,
      });
      this.state = output.stateN.data as Float32Array;
      const probability = (output.output.data as Float32Array)[0];
      best = Math.max(best ?? 0, probability);
    }
    this.pending = audio.slice(offset);
    return best;
  }
}
