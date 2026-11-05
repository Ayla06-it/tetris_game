/**
 * Web Audio API Sound Synthesizer for Retro Tetris SFX
 * 100% self-contained, no external audio files required.
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('tetris_muted') === 'true';
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('tetris_muted', String(this.muted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  /**
   * Helper to play an envelope tone
   */
  playTone(freq, type, duration, delay = 0, startGain = 0.3, endFreq = null) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(startGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // Piece moved left/right
  playMove() {
    this.playTone(200, 'square', 0.04, 0, 0.12, 140);
  }

  // Piece rotated
  playRotate() {
    this.playTone(280, 'triangle', 0.06, 0, 0.2, 440);
  }

  // Piece soft dropped
  playSoftDrop() {
    this.playTone(130, 'sine', 0.03, 0, 0.1, 90);
  }

  // Piece hard dropped (impact)
  playHardDrop() {
    this.playTone(180, 'triangle', 0.12, 0, 0.35, 45);
  }

  // Piece locked into grid
  playLock() {
    this.playTone(260, 'sine', 0.05, 0, 0.2, 160);
  }

  // Piece held/swapped
  playHold() {
    this.playTone(330, 'square', 0.05, 0, 0.15, 520);
  }

  // Lines cleared
  playLineClear(count) {
    if (this.muted) return;
    this.ensureContext();

    if (count === 4) {
      // Tetris clear! Triumphant arpeggio
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'triangle', 0.25, idx * 0.07, 0.25);
        this.playTone(freq * 0.5, 'sine', 0.2, idx * 0.07, 0.15);
      });
    } else if (count === 3) {
      // Triple
      const notes = [330, 440, 554.37, 659.25];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'triangle', 0.18, idx * 0.06, 0.22);
      });
    } else if (count === 2) {
      // Double
      const notes = [330, 493.88, 659.25];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sine', 0.15, idx * 0.07, 0.2);
      });
    } else {
      // Single
      const notes = [440, 660];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sine', 0.12, idx * 0.06, 0.18);
      });
    }
  }

  // Level advancement
  playLevelUp() {
    if (this.muted) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.2, idx * 0.08, 0.3);
    });
  }

  // Game over sound
  playGameOver() {
    if (this.muted) return;
    const notes = [440, 415.3, 392.0, 369.99, 329.63, 246.94];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sawtooth', 0.35, idx * 0.15, 0.25, freq * 0.7);
    });
  }
}

export const sound = new SoundController();
