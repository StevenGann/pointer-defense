import type { VolumeLevel } from '../core/save.ts';

/**
 * WebAudio sound effects, synthesized from oscillators and a shared noise buffer so the build stays
 * asset-free (docs/design.md §14). One AudioContext is created lazily on the first user gesture,
 * because browsers only start audio from inside a gesture. There is no music at launch and hover is
 * deliberately silent.
 */

export type SoundName =
  | 'gun'
  | 'cannon'
  | 'taser'
  | 'laser'
  | 'frost'
  | 'kill'
  | 'leak'
  | 'ad'
  | 'adClose'
  | 'waveStart'
  | 'waveClear';

/** At most this many voices sound at once; the oldest is dropped (docs/design.md §14). */
const MAX_VOICES = 12;

const VOLUME_GAIN: Readonly<Record<VolumeLevel, number>> = { low: 0.25, med: 0.55, high: 1 };

const NOISE_BUFFER_SECONDS = 0.5;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private volume: VolumeLevel = 'med';
  private voices: AudioScheduledSourceNode[] = [];

  /** Create the AudioContext on the first real gesture (or resume it if it was suspended). */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? VOLUME_GAIN[this.volume] : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyGain();
  }

  setVolume(level: VolumeLevel): void {
    this.volume = level;
    this.applyGain();
  }

  /** Play a named sound. `pitch` scales the kill blip's frequency up with the combo. */
  play(name: SoundName, opts: { pitch?: number } = {}): void {
    if (!this.enabled) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const pitch = opts.pitch ?? 1;
    switch (name) {
      case 'gun':
        this.noiseBurst(0.06, 3200, 0.5);
        break;
      case 'cannon':
        this.tone('sine', 130, 55, 0.14, 0.65);
        break;
      case 'taser':
        this.tone('square', 200, 200, 0.09, 0.22);
        break;
      case 'laser':
        this.tone('sawtooth', 1500, 220, 0.12, 0.28);
        break;
      case 'frost':
        this.tone('sine', 880, 440, 0.1, 0.18);
        break;
      case 'kill':
        this.tone('sine', 440 * pitch, 440 * pitch, 0.05, 0.4);
        this.tone('sine', 660 * pitch, 660 * pitch, 0.07, 0.4, 0.05);
        break;
      case 'leak':
        this.tone('sine', 660, 660, 0.09, 0.4);
        this.tone('sine', 880, 880, 0.14, 0.4, 0.08);
        break;
      case 'ad':
        this.tone('sine', 700, 1200, 0.08, 0.32);
        break;
      case 'adClose':
        this.tone('sine', 988, 988, 0.06, 0.35);
        this.tone('sine', 1319, 1319, 0.12, 0.35, 0.05);
        break;
      case 'waveStart':
        this.tone('square', 523, 523, 0.14, 0.28);
        this.tone('square', 784, 784, 0.2, 0.28, 0.14);
        break;
      case 'waveClear':
        this.tone('square', 784, 784, 0.14, 0.28);
        this.tone('square', 1047, 1047, 0.2, 0.28, 0.14);
        break;
    }
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this.enabled ? VOLUME_GAIN[this.volume] : 0;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** One oscillator with a fast attack and an exponential release, optionally sweeping frequency. */
  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    peak: number,
    delay = 0,
  ): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, from), t0);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    this.track(o);
  }

  /** A short filtered burst of the shared white-noise buffer (the gun's click). */
  private noiseBurst(dur: number, centerFreq: number, peak: number, delay = 0): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    this.track(src);
  }

  /** Track a voice so the 12-voice ceiling can drop the oldest; untrack on end. */
  private track(src: AudioScheduledSourceNode): void {
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.shift();
      if (oldest) this.stop(oldest);
    }
    this.voices.push(src);
    src.addEventListener('ended', () => {
      const i = this.voices.indexOf(src);
      if (i >= 0) this.voices.splice(i, 1);
    });
  }

  private stop(src: AudioScheduledSourceNode): void {
    try {
      src.stop();
    } catch {
      // Already stopped.
    }
  }
}

export const sfx = new Sfx();
