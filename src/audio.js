// Web Audio API Synthesizer & Procedural Dark-Synthwave Soundtrack Engine

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.musicTimer = null;
    this.stepIndex = 0;
    this.corruptionIntensity = 0;

    // Cooldown map to prevent audio overload during 500+ entity combat
    this.lastPlayed = new Map();
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
    compressor.knee.setValueAtTime(18, this.ctx.currentTime);
    compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.24;

    this.sfxGain.connect(compressor);
    this.musicGain.connect(compressor);
    compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._createNoiseBuffer();
    this.startMusic();
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  toggleMute() {
    this.init();
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.7 : 0.0, this.ctx.currentTime, 0.04);
    }
    return this.enabled;
  }

  setCorruption(pct) {
    this.corruptionIntensity = Math.min(1, pct / 100);
  }

  _canPlay(key, minIntervalMs) {
    if (!this.enabled || !this.ctx) return false;
    const now = performance.now();
    const prev = this.lastPlayed.get(key) || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  playWeaponFire(type = 'vulcan') {
    if (!this._canPlay(`fire_${type}`, type === 'vulcan' ? 45 : 70)) return;
    const now = this.ctx.currentTime;

    if (type === 'vulcan') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const pitchJitter = 1 + (Math.random() - 0.5) * 0.08;
      osc.frequency.setValueAtTime(340 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.065);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.075);
    } else if (type === 'missile') {
      // Filtered noise whoosh + low punch
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(280, now + 0.14);
        filter.Q.value = 3.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        src.start(now);
        src.stop(now + 0.15);
      }
    } else if (type === 'railgun') {
      // High-energy cyber rail crack
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'cryo') {
      // Shimmering sub-zero pulse
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.27);
    } else if (type === 'tesla') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.setValueAtTime(1120, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.07);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  playHit(isCrit = false) {
    if (!this._canPlay('hit', isCrit ? 22 : 35)) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCrit ? 'square' : 'triangle';
    const baseFreq = isCrit ? 520 : 190;
    osc.frequency.setValueAtTime(baseFreq * (0.9 + Math.random() * 0.2), now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.05);

    gain.gain.setValueAtTime(isCrit ? 0.16 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playEnemyKill(isElite = false) {
    if (!this._canPlay(isElite ? 'kill_elite' : 'kill', isElite ? 50 : 40)) return;
    const now = this.ctx.currentTime;

    // Sub punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isElite ? 160 : 130, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + (isElite ? 0.4 : 0.13));

    gain.gain.setValueAtTime(isElite ? 0.42 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isElite ? 0.42 : 0.14));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isElite ? 0.45 : 0.15));

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isElite ? 1600 : 1100, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + (isElite ? 0.35 : 0.12));

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(isElite ? 0.28 : 0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (isElite ? 0.36 : 0.13));

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + (isElite ? 0.38 : 0.14));
    }
  }

  playDash() {
    if (!this._canPlay('dash', 80)) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playDashParry() {
    if (!this._canPlay('parry', 100)) return;
    const now = this.ctx.currentTime;

    // Signature EMP Dash-Parry: metallic power-chord + sub drop
    const freqs = [440, 659.25, 880, 1318.5];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.5, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 1.02, now + 0.32);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  playGemPickup(combo = 0) {
    if (!this._canPlay('gem', 28)) return;
    const now = this.ctx.currentTime;

    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const octaveBoost = Math.min(3, Math.floor(combo / 8)) * 0.25;
    const freq = Math.min(3200, scale[combo % scale.length] * (1 + octaveBoost));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.min(4000, freq * 1.25), now + 0.07);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playLevelUp() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [329.63, 440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.065;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playPlayerDamage() {
    if (!this._canPlay('player_dmg', 140)) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.linearRampToValueAtTime(48, now + 0.22);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playBossAlert() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.28;
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(440, t + 0.18);
      osc.frequency.linearRampToValueAtTime(180, t + 0.26);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.27);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.28);
    }
  }

  startMusic() {
    if (this.musicPlaying || !this.ctx) return;
    this.musicPlaying = true;

    // 125 BPM 16th-note dark-synthwave bassline sequencer
    const stepDurationMs = 120;
    const bassPattern = [
      55.0, 55.0, 110.0, 55.0,
      55.0, 55.0, 110.0, 55.0,
      65.41, 65.41, 130.81, 65.41,
      49.0, 49.0, 98.0, 73.42
    ];

    this.musicTimer = setInterval(() => {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex % 16;
      this.stepIndex++;

      const freq = bassPattern[step];
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      const cutoff = 320 + this.corruptionIntensity * 650 + (step % 4 === 2 ? 260 : 0);
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.1);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.115);
    }, stepDurationMs);
  }
}
