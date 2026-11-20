// All sound is synthesized with WebAudio: no audio files ship with the
// game. Engine hum, sirens, gunshots and a low-key bass loop.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (the Start button click).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  startEngineLoop() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'sine';
    this.engineOsc2.frequency.value = 110;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    this.engineOsc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  // Called every frame: pitch follows speed, loud only while driving.
  setEngine(speedNorm, throttle) {
    if (!this.ctx || !this.engineOsc) return;
    const rpm = 50 + speedNorm * 160 + (throttle ? 12 : 0);
    this.engineOsc.frequency.setTargetAtTime(rpm, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 2, this.ctx.currentTime, 0.08);
    const target = throttle || speedNorm > 0.05 ? 0.05 + speedNorm * 0.06 : 0.015;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch {
        // Already stopped.
      }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  blip(freq, duration, type, volume) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration, volume, cutoff) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 3000;
    const gain = this.ctx.createGain();
    gain.gain.value = volume || 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  gunshot() {
    this.noiseBurst(0.14, 0.4, 1800);
    this.blip(90, 0.1, 'sine', 0.25);
  }

  hit() {
    this.blip(1200, 0.06, 'square', 0.08);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.14);
    setTimeout(() => this.blip(990, 0.12, 'sine', 0.14), 90);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.22, 'triangle', 0.16), i * 130);
    });
  }

  busted() {
    const notes = [392, 330, 262];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.3, 'sawtooth', 0.1), i * 180);
    });
  }

  // A slow minor-key bass loop, one step every 240 ms.
  startMusic() {
    const bass = [55, 0, 55, 65.4, 0, 55, 49, 58.3];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const freq = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      if (freq > 0) this.blip(freq, 0.22, 'triangle', 0.05);
      if (this.musicStep % 8 === 4) this.noiseBurst(0.03, 0.02, 6000);
    }, 240);
  }
}
