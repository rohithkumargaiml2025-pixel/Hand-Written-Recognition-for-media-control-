import { Track } from '../types/media';

export type EqBand = 0 | 1 | 2 | 3 | 4;

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private feedbackGain: GainNode | null = null;

  // Synthesis state
  private isSynthesizing = false;
  private synthIntervalId: number | null = null;
  private synthStep = 0;
  private currentTrack: Track | null = null;
  private playbackRate = 1.0;
  private isMuted = false;
  private volume = 0.8;
  private isPlaying = false;
  private currentTime = 0;
  private timerIntervalId: number | null = null;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onTrackEndedCallback: (() => void) | null = null;

  // Custom audio element for user uploaded tracks
  private customAudio: HTMLAudioElement | null = null;
  private customSourceNode: MediaElementAudioSourceNode | null = null;

  private constructor() {
    // Lazily initialized on first user interaction
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    // Create Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    // Create 5-band EQ
    const frequencies = [60, 250, 1000, 4000, 12000];
    const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

    this.eqFilters = frequencies.map((freq, i) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = types[i];
      filter.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      filter.gain.setValueAtTime(0, this.ctx!.currentTime);
      if (filter.type === 'peaking') {
        filter.Q.setValueAtTime(1.0, this.ctx!.currentTime);
      }
      return filter;
    });

    // Analyser Node for visualizers
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    // Feedback gain for confirmation chimes
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.feedbackGain.connect(this.ctx.destination);

    // Connect EQ chain: [Input] -> EQ0 -> EQ1 -> EQ2 -> EQ3 -> EQ4 -> MasterGain -> Analyser -> Destination
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }
    this.eqFilters[this.eqFilters.length - 1].connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private getInputNode(): AudioNode {
    this.init();
    return this.eqFilters[0];
  }

  public getAnalyser(): AnalyserNode | null {
    this.init();
    return this.analyser;
  }

  public async resumeContext(): Promise<void> {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.customAudio) {
      this.customAudio.playbackRate = this.playbackRate;
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setEqGain(band: EqBand, gainDb: number) {
    this.init();
    if (this.eqFilters[band] && this.ctx) {
      this.eqFilters[band].gain.setTargetAtTime(gainDb, this.ctx.currentTime, 0.05);
    }
  }

  public applyBassBoost(enabled: boolean) {
    this.setEqGain(0, enabled ? 7.5 : 0);
  }

  public onTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onTrackEnded(cb: () => void) {
    this.onTrackEndedCallback = cb;
  }

  public async playTrack(track: Track, startTime = 0) {
    await this.resumeContext();
    this.stopPlayback();

    this.currentTrack = track;
    this.currentTime = startTime;
    this.isPlaying = true;

    if (track.isCustom && track.audioBuffer) {
      // Buffer playback or custom audio
      this.startBufferPlayback(track.audioBuffer, startTime);
    } else {
      // Synthesized generative audio track
      this.startGenerativeTrack(track);
    }

    this.startTimer();
  }

  public pause() {
    this.isPlaying = false;
    this.stopPlayback();
  }

  public resume() {
    if (this.currentTrack) {
      this.playTrack(this.currentTrack, this.currentTime);
    }
  }

  public seek(seconds: number) {
    if (!this.currentTrack) return;
    const clamped = Math.max(0, Math.min(this.currentTrack.duration, seconds));
    this.currentTime = clamped;
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.currentTime);
    }
    if (this.isPlaying) {
      this.playTrack(this.currentTrack, this.currentTime);
    }
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Sound effect confirmation chime when digit recognition executes an action
   */
  public playConfirmationChime(digit: number) {
    if (!this.ctx || !this.feedbackGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch mapped nicely to digit: higher digits have bright harmonic tones
      const baseFreq = 440;
      const semitoneOffsets = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
      const freq = baseFreq * Math.pow(2, (semitoneOffsets[digit] || 0) / 12);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.feedbackGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio feedback is non-blocking
    }
  }

  private startTimer() {
    if (this.timerIntervalId) {
      window.clearInterval(this.timerIntervalId);
    }
    this.timerIntervalId = window.setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;
      this.currentTime += 0.25 * this.playbackRate;

      if (this.currentTime >= this.currentTrack.duration) {
        this.currentTime = this.currentTrack.duration;
        if (this.onTimeUpdateCallback) this.onTimeUpdateCallback(this.currentTime);
        if (this.onTrackEndedCallback) this.onTrackEndedCallback();
      } else {
        if (this.onTimeUpdateCallback) this.onTimeUpdateCallback(this.currentTime);
      }
    }, 250);
  }

  private stopPlayback() {
    if (this.synthIntervalId) {
      window.clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
    if (this.timerIntervalId) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    this.isSynthesizing = false;
    if (this.customAudio) {
      this.customAudio.pause();
    }
  }

  /**
   * Generative Music Synthesizer
   * Creates real rich melodic and rhythmic sequences through the Web Audio graph
   */
  private startGenerativeTrack(track: Track) {
    if (!this.ctx) return;
    this.isSynthesizing = true;
    const inputNode = this.getInputNode();

    const bpm = track.bpm;
    const stepDuration = 60 / bpm / 4; // 16th note in seconds

    // Calculate current 16th step from current time
    this.synthStep = Math.floor((this.currentTime / stepDuration) % 64);

    const scheduleNextSteps = () => {
      if (!this.isSynthesizing || !this.ctx) return;
      const now = this.ctx.currentTime;

      // Schedule notes for next 16 steps
      for (let s = 0; s < 4; s++) {
        const step = (this.synthStep + s) % 64;
        const time = now + (s * stepDuration) / this.playbackRate;
        this.playSynthesizedStep(track.synthTheme, step, time, inputNode);
      }
      this.synthStep = (this.synthStep + 4) % 64;
    };

    scheduleNextSteps();
    const intervalMs = (stepDuration * 4 * 1000) / this.playbackRate;
    this.synthIntervalId = window.setInterval(scheduleNextSteps, Math.max(40, intervalMs - 20));
  }

  private playSynthesizedStep(
    theme: Track['synthTheme'],
    step: number,
    time: number,
    destination: AudioNode
  ) {
    if (!this.ctx) return;

    // Drum beats based on theme
    const isQuarterNote = step % 4 === 0;
    const isOffbeat = step % 4 === 2;
    const is16th = step % 2 === 0;

    // Kick drum (on 1 and 3 usually)
    if (step === 0 || step === 16 || step === 32 || step === 48 || (theme === 'synthwave' && isQuarterNote)) {
      this.synthesizeKick(time, destination);
    }

    // Snare / Rimshot on 2 and 4 (steps 8, 24, 40, 56)
    if (step === 8 || step === 24 || step === 40 || step === 56) {
      this.synthesizeSnare(time, destination, theme === 'lofi' ? 'soft' : 'bright');
    }

    // Hi-hats
    if (is16th) {
      this.synthesizeHihat(time, destination, isOffbeat ? 0.08 : 0.04);
    }

    // Melodic notes & Basslines based on theme
    switch (theme) {
      case 'lofi': {
        // Chill Jazz Chord on every 16 steps (bar start)
        if (step % 16 === 0) {
          const chordIndex = Math.floor(step / 16) % 4;
          // Dm9 -> G13 -> Cmaj9 -> Am7
          const chords = [
            [293.66, 349.23, 440.0, 523.25, 659.25], // Dm9
            [261.63, 329.63, 392.0, 493.88, 587.33], // G13
            [261.63, 329.63, 392.0, 493.88, 659.25], // Cmaj9
            [220.0, 261.63, 329.63, 392.0, 493.88],  // Am9
          ];
          this.synthesizeRhodesChord(chords[chordIndex], time, 2.2, destination);
        }
        // Warm walking bass note on beats
        if (isQuarterNote) {
          const bassNotes = [73.42, 82.41, 65.41, 110.0];
          const bIdx = Math.floor(step / 16) % 4;
          this.synthesizeBass(bassNotes[bIdx], time, 0.45, destination, 'sine');
        }
        break;
      }

      case 'synthwave': {
        // Fast 16th note synthwave rolling bassline (A minor / F / G / Em)
        const bassNotes = [55.0, 43.65, 48.99, 41.2]; // A1, F1, G1, E1
        const chordIdx = Math.floor(step / 16) % 4;
        const noteFreq = bassNotes[chordIdx];
        const octaved = step % 2 === 1 ? noteFreq * 2 : noteFreq;
        this.synthesizeBass(octaved, time, 0.14, destination, 'sawtooth');

        // Arpeggiated melody on every 2nd step
        if (step % 4 === 2) {
          const arps = [440, 523.25, 659.25, 783.99, 880];
          const aFreq = arps[(step / 2) % arps.length];
          this.synthesizeLead(aFreq, time, 0.18, destination);
        }
        break;
      }

      case 'acoustic': {
        // Fingerpicked guitar arpeggio simulation (G - Em - C - D)
        const guitarPitches = [
          [196.0, 246.94, 293.66, 392.0], // G major
          [164.81, 246.94, 329.63, 392.0], // E minor
          [130.81, 261.63, 329.63, 392.0], // C major
          [146.83, 220.0, 293.66, 440.0],  // D major
        ];
        const chordIdx = Math.floor(step / 16) % 4;
        const noteIdx = (step % 8) % 4;
        const pluckFreq = guitarPitches[chordIdx][noteIdx];
        this.synthesizePluck(pluckFreq, time, 0.7, destination);
        break;
      }

      case 'deeptech': {
        // Hypnotic sub bass and resonant modular plucks
        if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
          const techNotes = [46.25, 46.25, 51.91, 58.27];
          const bNote = techNotes[Math.floor(step / 16) % 4];
          this.synthesizeBass(bNote, time, 0.28, destination, 'triangle');
        }
        // Modular techno synth stab
        if (step % 16 === 4 || step % 16 === 10) {
          this.synthesizeAcidStab(369.99, time, 0.25, destination);
        }
        break;
      }
    }
  }

  // Synthesis helpers using native Web Audio primitives:
  private synthesizeKick(time: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + 0.28);
  }

  private synthesizeSnare(time: number, dest: AudioNode, flavor: 'soft' | 'bright') {
    if (!this.ctx) return;
    // Noise buffer for snap
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = flavor === 'bright' ? 'highpass' : 'bandpass';
    filter.frequency.setValueAtTime(flavor === 'bright' ? 1200 : 800, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(flavor === 'bright' ? 0.35 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    whiteNoise.start(time);
    whiteNoise.stop(time + 0.15);
  }

  private synthesizeHihat(time: number, dest: AudioNode, volume = 0.05) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(7500, time);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private synthesizeRhodesChord(pitches: number[], time: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    pitches.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const osc2 = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, time); // warm overtone

      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc.start(time);
      osc2.start(time);
      osc.stop(time + duration);
      osc2.stop(time + duration);
    });
  }

  private synthesizeBass(
    freq: number,
    time: number,
    duration: number,
    dest: AudioNode,
    wave: OscillatorType
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(wave === 'sawtooth' ? 850 : 280, time);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + duration);
  }

  private synthesizeLead(freq: number, time: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(800, time + duration);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + duration);
  }

  private synthesizePluck(freq: number, time: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + duration);
  }

  private synthesizeAcidStab(freq: number, time: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);
    filter.Q.setValueAtTime(4.0, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Custom local file audio loader
   */
  public async loadAudioFile(file: File): Promise<Track> {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);

    const customTrack: Track = {
      id: `custom-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local Import',
      album: 'User Library',
      genre: 'User Audio',
      duration: Math.round(audioBuffer.duration),
      coverArt: '/src/assets/images/album_deep_frequency_1792925302066.jpg',
      bpm: 120,
      synthTheme: 'deeptech',
      description: `Imported audio file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      audioBuffer,
      isCustom: true,
    };

    return customTrack;
  }

  private startBufferPlayback(buffer: AudioBuffer, startTime = 0) {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
    source.connect(this.getInputNode());
    source.start(0, startTime);

    source.onended = () => {
      if (this.isPlaying && this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    };
  }
}
