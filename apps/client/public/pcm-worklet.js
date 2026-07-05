// AudioWorklet processor: converts mic audio to the exact format Soniox
// expects (see apps/server/src/services/sonion.ts's getConfig): raw PCM,
// signed 16-bit little-endian, 16kHz, mono.
//
// Runs on the dedicated audio rendering thread, so the conversion never
// blocks the UI. Must be plain JS (no type annotations) served statically —
// audioWorklet.addModule() loads it by URL at runtime, unbundled.

const TARGET_RATE = 16000;

class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    // sampleRate is a global inside the worklet scope — the AudioContext's
    // actual rate (typically 48000 or 44100).
    this._inputRate = sampleRate;
    this._ratio = this._inputRate / TARGET_RATE;
    // Carries the fractional resample position across process() calls so
    // consecutive render quanta stitch together without clicks/gaps.
    this._pos = 0;
  }

  process(inputs) {
    const input = inputs[0];
    // No input connected yet, or a silent render quantum.
    if (!input || input.length === 0) return true;

    // Mono: take channel 0. getUserMedia is requested with channelCount: 1,
    // but if the browser hands us stereo anyway we still just use channel 0.
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // Downsample by linear interpolation from inputRate -> 16000.
    const outLength = Math.floor((channel.length - this._pos) / this._ratio);
    if (outLength <= 0) return true;

    const out = new Int16Array(outLength);

    let pos = this._pos;
    for (let i = 0; i < outLength; i++) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s0 = channel[idx] ?? 0;
      const s1 = channel[idx + 1] ?? s0;
      let sample = s0 + (s1 - s0) * frac;

      sample = Math.max(-1, Math.min(1, sample));
      out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      pos += this._ratio;
    }

    this._pos = pos - channel.length;
    if (this._pos < 0) this._pos = 0;

    // Transfer the buffer (zero-copy) to the main thread.
    this.port.postMessage(out.buffer, [out.buffer]);

    return true;
  }
}

registerProcessor("pcm-worklet", PCMWorklet);
