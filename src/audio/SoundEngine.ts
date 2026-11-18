export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Engine synth nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Nitro whoosh nodes
  private nitroSource: AudioBufferSourceNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroTurbine: OscillatorNode | null = null;
  private nitroTurbineGain: GainNode | null = null;

  // Police siren nodes
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;
  private engineActive = false;

  public init(): void {
    try {
      if (this.initialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => {});
        }
        return;
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.65;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Pre-generate 2 seconds of white/pinkish noise
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 0.5;
      }
      this.noiseBuffer = buffer;

      this.setupEngineSynth(ctx, master);
      this.setupNitroSynth(ctx, master);
      this.setupSirenSynth(ctx, master);

      this.initialized = true;
    } catch {
      // Gracefully ignore blocked/unsupported Web Audio on restricted mobile WebViews
    }
  }

  private setupEngineSynth(ctx: AudioContext, master: GainNode): void {
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 62;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 31;

    // Subtle waveshaper for sporty exhaust growl
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((3 + 12) * x * 20 * (Math.PI / 180)) / (Math.PI + 12 * Math.abs(x));
    }
    shaper.curve = curve;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc1.connect(shaper);
    osc2.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc1.start();
    osc2.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  private setupNitroSynth(ctx: AudioContext, master: GainNode): void {
    if (!this.noiseBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const turbine = ctx.createOscillator();
    turbine.type = 'sine';
    turbine.frequency.value = 420;

    const turbineGain = ctx.createGain();
    turbineGain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    turbine.connect(turbineGain);
    turbineGain.connect(master);

    source.start();
    turbine.start();

    this.nitroSource = source;
    this.nitroFilter = filter;
    this.nitroGain = gain;
    this.nitroTurbine = turbine;
    this.nitroTurbineGain = turbineGain;
  }

  private setupSirenSynth(ctx: AudioContext, master: GainNode): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 740;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 2.2; // alternating wail rate

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 175;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start();
    lfo.start();

    this.sirenOsc = osc;
    this.sirenLfo = lfo;
    this.sirenGain = gain;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setEngineActive(active: boolean): void {
    this.engineActive = active;
    if (!active && this.ctx) {
      const now = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0, now, 0.08);
      this.nitroGain?.gain.setTargetAtTime(0, now, 0.06);
      this.nitroTurbineGain?.gain.setTargetAtTime(0, now, 0.06);
      this.sirenGain?.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public updateContinuous(
    rpmRatio: number,
    speedKmh: number,
    isNitro: boolean,
    policeActive: boolean,
    policeDistanceM: number
  ): void {
    if (!this.initialized || !this.ctx || !this.engineActive) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(0, Math.min(1.2, rpmRatio));
    const baseFreq = 54 + clampedRpm * 148 + (isNitro ? 28 : 0);

    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.045);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.045);
      const cutoff = 240 + clampedRpm * 1300 + (speedKmh / 300) * 600;
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
      const vol = 0.09 + clampedRpm * 0.08;
      this.engineGain.gain.setTargetAtTime(vol, now, 0.06);
    }

    if (this.nitroGain && this.nitroFilter && this.nitroTurbine && this.nitroTurbineGain) {
      const targetNitroVol = isNitro ? 0.22 : 0;
      this.nitroGain.gain.setTargetAtTime(targetNitroVol, now, 0.05);
      this.nitroFilter.frequency.setTargetAtTime(isNitro ? 1450 : 750, now, 0.06);
      this.nitroTurbine.frequency.setTargetAtTime(isNitro ? 580 + clampedRpm * 240 : 380, now, 0.06);
      this.nitroTurbineGain.gain.setTargetAtTime(isNitro ? 0.045 : 0, now, 0.05);
    }

    if (this.sirenGain && this.sirenOsc && this.sirenLfo) {
      const proximity = Math.max(0.15, Math.min(1, 1 - policeDistanceM / 95));
      const targetSirenVol = policeActive ? 0.14 * proximity : 0;
      this.sirenGain.gain.setTargetAtTime(targetSirenVol, now, 0.08);
    }
  }

  public playBumperThud(speedKmh: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const intensity = Math.max(0.35, Math.min(1, speedKmh / 180));

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playCrashImpact(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Sub impact
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);

    // Metallic crunch noise
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.4, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.28);
    }
  }

  public playCountdownBeep(isGo: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 520, now);
    if (isGo) {
      osc.frequency.setValueAtTime(1046.5, now + 0.09);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.4 : 0.2));
  }

  public playFinishFanfare(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + idx * 0.085;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  }

  public playUiClick(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playNitroPickup(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.14);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    gain.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.24);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
