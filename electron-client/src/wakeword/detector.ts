// openWakeWord, ported from its Python streaming code to the browser.
// Three small ONNX models run in a row on every 80 ms chunk of 16 kHz audio:
//   1. melspectrogram: raw audio → frequency frames (32 mel bins, one per 10 ms)
//   2. embedding: the last 76 frames (~0.8 s) → one 96-number "what did that sound like"
//   3. wake word: the last 16 embeddings (~1.3 s) → score 0..1 for the wake word ("hey bro")
// https://github.com/dscripka/openWakeWord
import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = 1; // multi-threading needs cross-origin isolation; the models are tiny anyway

export const SAMPLE_RATE = 16000;
export const CHUNK = 1280; // 80 ms
const OVERLAP = 160 * 3; // extra samples so mel frames line up across chunks
const MEL_BINS = 32;
const MEL_WINDOW = 76; // mel frames per embedding
const EMBEDDING_SIZE = 96;
const FEATURE_WINDOW = 16; // embeddings per wake word score

const MODELS = 'models/'; // in public/, relative to index.html

async function load(file: string) {
  return ort.InferenceSession.create(MODELS + file, {
    executionProviders: ['wasm'],
  });
}

async function run(session: ort.InferenceSession, input: ort.Tensor) {
  const output = await session.run({ [session.inputNames[0]]: input });
  return output[session.outputNames[0]].data as Float32Array;
}

export class WakeWordDetector {
  // Rolling buffers, newest at the end
  private audio = new Float32Array(CHUNK + OVERLAP);
  private mels: Float32Array[] = Array.from({ length: MEL_WINDOW }, () =>
    new Float32Array(MEL_BINS).fill(1),
  );
  private features: Float32Array[] = [];

  private constructor(
    private melspec: ort.InferenceSession,
    private embedding: ort.InferenceSession,
    private wakeWord: ort.InferenceSession,
  ) {}

  static async create(wakeWordModel: string) {
    const [melspec, embedding, wakeWord] = await Promise.all([
      load('melspectrogram.onnx'),
      load('embedding_model.onnx'),
      load(wakeWordModel),
    ]);
    return new WakeWordDetector(melspec, embedding, wakeWord);
  }

  /** Feed one 80 ms chunk (samples -1..1); returns the wake word score 0..1,
   *  or null while there isn't enough audio yet (the first ~1.3 s). */
  async process(chunk: Float32Array): Promise<number | null> {
    // Keep the last 480 samples of the previous chunk, then append this one.
    // The models were trained on 16-bit audio values, not -1..1.
    this.audio.copyWithin(0, CHUNK);
    this.audio.set(
      chunk.map((s) => s * 32767),
      OVERLAP,
    );

    // 1. Mel frames for this chunk (8 of them)
    const mel = await run(
      this.melspec,
      new ort.Tensor('float32', this.audio, [1, this.audio.length]),
    );
    for (let i = 0; i + MEL_BINS <= mel.length; i += MEL_BINS) {
      // Same scaling openWakeWord applies after this model
      this.mels.push(mel.slice(i, i + MEL_BINS).map((v) => v / 10 + 2));
    }
    this.mels = this.mels.slice(-MEL_WINDOW);

    // 2. One embedding from the last 76 frames
    const window = new Float32Array(MEL_WINDOW * MEL_BINS);
    this.mels.forEach((frame, i) => window.set(frame, i * MEL_BINS));
    const embedding = await run(
      this.embedding,
      new ort.Tensor('float32', window, [1, MEL_WINDOW, MEL_BINS, 1]),
    );
    this.features.push(embedding.slice(0, EMBEDDING_SIZE));
    if (this.features.length > FEATURE_WINDOW) this.features.shift();
    if (this.features.length < FEATURE_WINDOW) return null;

    // 3. Wake word score from the last 16 embeddings
    const features = new Float32Array(FEATURE_WINDOW * EMBEDDING_SIZE);
    this.features.forEach((f, i) => features.set(f, i * EMBEDDING_SIZE));
    const [score] = await run(
      this.wakeWord,
      new ort.Tensor('float32', features, [1, FEATURE_WINDOW, EMBEDDING_SIZE]),
    );
    return score;
  }
}
