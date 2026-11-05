/**
 * Tetris Complete Standalone Bundle
 * Works seamlessly both via HTTP server and directly via file:/// double-click!
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const COLS = 10;
  const ROWS = 20;
  const BUFFER_ROWS = 2; // Hidden rows above playfield
  const TOTAL_ROWS = ROWS + BUFFER_ROWS; // 22 total rows
  const BLOCK_SIZE = 30; // Logical pixels per block for 300x600 board

  // Vibrant neon arcade palette
  const TETROMINO_COLORS = {
    I: { main: '#00f0f0', shadow: '#00a3a3', glow: 'rgba(0, 240, 240, 0.5)' },
    J: { main: '#2060ff', shadow: '#1038b0', glow: 'rgba(32, 96, 255, 0.5)' },
    L: { main: '#ff8c00', shadow: '#b86000', glow: 'rgba(255, 140, 0, 0.5)' },
    O: { main: '#ffd700', shadow: '#b89900', glow: 'rgba(255, 215, 0, 0.5)' },
    S: { main: '#10d050', shadow: '#0a8833', glow: 'rgba(16, 208, 80, 0.5)' },
    T: { main: '#b030ff', shadow: '#7818b8', glow: 'rgba(176, 48, 255, 0.5)' },
    Z: { main: '#ff2050', shadow: '#b01030', glow: 'rgba(255, 32, 80, 0.5)' },
  };

  // Tetromino Shape Matrices (North orientation / Rotation 0)
  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  };

  // SRS Kick Tables
  const SRS_KICKS_JLSTZ = {
    '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };

  const SRS_KICKS_I = {
    '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  const POINTS = {
    SINGLE: 100,
    DOUBLE: 300,
    TRIPLE: 500,
    TETRIS: 800,
    BACK_TO_BACK_TETRIS: 1200,
    SOFT_DROP_PER_CELL: 1,
    HARD_DROP_PER_CELL: 2,
  };

  const LEVEL_SPEEDS = [
    800, 715, 630, 550, 470, 390, 320, 250, 190, 140, 105, 80, 60, 45, 35,
  ];

  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const DAS_DELAY_MS = 160;
  const ARR_INTERVAL_MS = 35;

  const GAME_STATES = {
    READY: 'READY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
  };

  // ==========================================================================
  // 2. AUDIO SYNTHESIZER (Web Audio API)
  // ==========================================================================
  class SoundController {
    constructor() {
      this.ctx = null;
      let savedMute = false;
      try {
        savedMute = localStorage.getItem('tetris_muted') === 'true';
      } catch (e) {}
      this.muted = savedMute;
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
        console.warn('Web Audio not available:', e);
      }
    }

    ensureContext() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      try {
        localStorage.setItem('tetris_muted', String(this.muted));
      } catch (e) {}
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.05);
      }
      return this.muted;
    }

    isMuted() {
      return this.muted;
    }

    playTone(freq, type, duration, delay = 0, startGain = 0.3, endFreq = null) {
      if (this.muted) return;
      this.ensureContext();
      if (!this.ctx) return;

      try {
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
      } catch (e) {}
    }

    playMove() {
      this.playTone(200, 'square', 0.04, 0, 0.12, 140);
    }

    playRotate() {
      this.playTone(280, 'triangle', 0.06, 0, 0.2, 440);
    }

    playSoftDrop() {
      this.playTone(130, 'sine', 0.03, 0, 0.1, 90);
    }

    playHardDrop() {
      this.playTone(180, 'triangle', 0.12, 0, 0.35, 45);
    }

    playLock() {
      this.playTone(260, 'sine', 0.05, 0, 0.2, 160);
    }

    playHold() {
      this.playTone(330, 'square', 0.05, 0, 0.15, 520);
    }

    playLineClear(count) {
      if (this.muted) return;
      this.ensureContext();

      if (count === 4) {
        const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          this.playTone(freq, 'triangle', 0.25, idx * 0.07, 0.25);
          this.playTone(freq * 0.5, 'sine', 0.2, idx * 0.07, 0.15);
        });
      } else if (count === 3) {
        const notes = [330, 440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          this.playTone(freq, 'triangle', 0.18, idx * 0.06, 0.22);
        });
      } else if (count === 2) {
        const notes = [330, 493.88, 659.25];
        notes.forEach((freq, idx) => {
          this.playTone(freq, 'sine', 0.15, idx * 0.07, 0.2);
        });
      } else {
        const notes = [440, 660];
        notes.forEach((freq, idx) => {
          this.playTone(freq, 'sine', 0.12, idx * 0.06, 0.18);
        });
      }
    }

    playLevelUp() {
      if (this.muted) return;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'triangle', 0.2, idx * 0.08, 0.3);
      });
    }

    playGameOver() {
      if (this.muted) return;
      const notes = [440, 415.3, 392.0, 369.99, 329.63, 246.94];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sawtooth', 0.35, idx * 0.15, 0.25, freq * 0.7);
      });
    }
  }

  const sound = new SoundController();

  // ==========================================================================
  // 3. MATRIX & TETROMINO LOGIC
  // ==========================================================================
  function rotateMatrixCW(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  function rotateMatrixCCW(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[n - 1 - c][r] = matrix[r][c];
      }
    }
    return result;
  }

  class Tetromino {
    constructor(type) {
      this.type = type;
      this.color = TETROMINO_COLORS[type];
      this.matrix = SHAPES[type].map(row => [...row]);
      this.rotation = 0; // 0: North, 1: East, 2: South, 3: West

      if (type === 'O') {
        this.x = 4;
        this.y = 1;
      } else {
        this.x = 3;
        this.y = 1;
      }
    }

    clone() {
      const copy = new Tetromino(this.type);
      copy.matrix = this.matrix.map(row => [...row]);
      copy.rotation = this.rotation;
      copy.x = this.x;
      copy.y = this.y;
      return copy;
    }

    getRotatedMatrix(direction = 'CW') {
      if (this.type === 'O') {
        return this.matrix.map(row => [...row]);
      }
      return direction === 'CW' ? rotateMatrixCW(this.matrix) : rotateMatrixCCW(this.matrix);
    }

    getNextRotationIndex(direction = 'CW') {
      return direction === 'CW' ? (this.rotation + 1) % 4 : (this.rotation + 3) % 4;
    }

    getKickOffsets(direction = 'CW') {
      if (this.type === 'O') return [[0, 0]];
      const fromRot = this.rotation;
      const toRot = this.getNextRotationIndex(direction);
      const key = `${fromRot}->${toRot}`;

      if (this.type === 'I') {
        return SRS_KICKS_I[key] || [[0, 0]];
      } else {
        return SRS_KICKS_JLSTZ[key] || [[0, 0]];
      }
    }
  }

  class Randomizer {
    constructor() {
      this.queue = [];
      this.fillBag();
      this.fillBag();
    }

    fillBag() {
      const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      this.queue.push(...pieces);
    }

    next() {
      if (this.queue.length <= 7) {
        this.fillBag();
      }
      const type = this.queue.shift();
      return new Tetromino(type);
    }

    peek(count = 3) {
      while (this.queue.length < count + 7) {
        this.fillBag();
      }
      return this.queue.slice(0, count);
    }

    reset() {
      this.queue = [];
      this.fillBag();
      this.fillBag();
    }
  }

  // ==========================================================================
  // 4. PLAYFIELD / BOARD STATE
  // ==========================================================================
  class Board {
    constructor() {
      this.cols = COLS;
      this.totalRows = TOTAL_ROWS;
      this.bufferRows = BUFFER_ROWS;
      this.visibleRows = ROWS;
      this.grid = this.createEmptyGrid();
    }

    createEmptyGrid() {
      return Array.from({ length: this.totalRows }, () => Array(this.cols).fill(null));
    }

    reset() {
      this.grid = this.createEmptyGrid();
    }

    isValidMove(piece, offsetX = 0, offsetY = 0, matrix = null) {
      if (!piece) return false;
      const mat = matrix || piece.matrix;
      const n = mat.length;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (mat[r][c] !== 0) {
            const targetX = piece.x + c + offsetX;
            const targetY = piece.y + r + offsetY;

            if (targetX < 0 || targetX >= this.cols) return false;
            if (targetY >= this.totalRows) return false;
            if (targetY >= 0 && this.grid[targetY][targetX] !== null) return false;
          }
        }
      }
      return true;
    }

    lockPiece(piece) {
      if (!piece) return;
      const mat = piece.matrix;
      const n = mat.length;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (mat[r][c] !== 0) {
            const targetX = piece.x + c;
            const targetY = piece.y + r;
            if (targetY >= 0 && targetY < this.totalRows && targetX >= 0 && targetX < this.cols) {
              this.grid[targetY][targetX] = piece.color;
            }
          }
        }
      }
    }

    getGhostPosition(piece) {
      let dropY = 0;
      while (this.isValidMove(piece, 0, dropY + 1)) {
        dropY++;
      }
      return {
        x: piece.x,
        y: piece.y + dropY,
      };
    }

    findFullRows() {
      const fullRows = [];
      for (let r = 0; r < this.totalRows; r++) {
        if (this.grid[r].every(cell => cell !== null)) {
          fullRows.push(r);
        }
      }
      return fullRows;
    }

    clearRows(rowIndices) {
      if (!rowIndices.length) return;
      const indexSet = new Set(rowIndices);
      const remainingRows = this.grid.filter((_, idx) => !indexSet.has(idx));
      const emptyCount = this.totalRows - remainingRows.length;
      const newEmptyRows = Array.from({ length: emptyCount }, () => Array(this.cols).fill(null));
      this.grid = [...newEmptyRows, ...remainingRows];
    }

    hasBufferOverflow() {
      for (let r = 0; r < this.bufferRows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] !== null) return true;
        }
      }
      return false;
    }
  }

  // ==========================================================================
  // 5. GAME ENGINE
  // ==========================================================================
  class Game {
    constructor(callbacks = {}) {
      this.callbacks = {
        onStateChange: () => {},
        onScoreChange: () => {},
        onLineClearAnimation: (rows, onComplete) => onComplete(),
        onPieceLock: () => {},
        ...callbacks,
      };

      this.board = new Board();
      this.randomizer = new Randomizer();

      this.state = GAME_STATES.READY;
      this.currentPiece = null;
      this.holdType = null;
      this.canHold = true;

      this.score = 0;
      this.level = 1;
      this.lines = 0;
      this.combo = -1;
      this.backToBack = false;

      let savedHigh = 0;
      try {
        savedHigh = parseInt(localStorage.getItem('tetris_highscore') || '0', 10);
      } catch (e) {}
      this.highScore = isNaN(savedHigh) ? 0 : savedHigh;

      this.lastTime = 0;
      this.gravityAccumulator = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.isLocking = false;
      this.isLineClearing = false;

      this.isSoftDropping = false;
      this.softDropAccumulator = 0;

      this.keys = {};
      this.dasTimer = { left: 0, right: 0 };
      this.arrTimer = { left: 0, right: 0 };

      this.animationFrameId = null;
    }

    getSpeed() {
      const idx = Math.min(this.level - 1, LEVEL_SPEEDS.length - 1);
      return LEVEL_SPEEDS[idx];
    }

    start() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.board.reset();
      this.randomizer.reset();
      this.score = 0;
      this.level = 1;
      this.lines = 0;
      this.combo = -1;
      this.backToBack = false;
      this.holdType = null;
      this.canHold = true;
      this.isLineClearing = false;

      this.spawnPiece();
      this.setState(GAME_STATES.PLAYING);

      this.lastTime = performance.now();
      this.gravityAccumulator = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.isLocking = false;

      this.emitScore();
      this.runLoop();
    }

    pause() {
      if (this.state === GAME_STATES.PLAYING) {
        this.setState(GAME_STATES.PAUSED);
      }
    }

    resume() {
      if (this.state === GAME_STATES.PAUSED) {
        this.setState(GAME_STATES.PLAYING);
        this.lastTime = performance.now();
        this.runLoop();
      }
    }

    togglePause() {
      if (this.state === GAME_STATES.PLAYING) {
        this.pause();
      } else if (this.state === GAME_STATES.PAUSED) {
        this.resume();
      }
    }

    setState(newState) {
      this.state = newState;
      this.callbacks.onStateChange(this.state);
    }

    spawnPiece() {
      this.currentPiece = this.randomizer.next();
      this.canHold = true;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.isLocking = false;

      if (!this.board.isValidMove(this.currentPiece)) {
        this.triggerGameOver();
      }
    }

    triggerGameOver() {
      this.setState(GAME_STATES.GAMEOVER);
      sound.playGameOver();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem('tetris_highscore', String(this.highScore));
        } catch (e) {}
      }
      this.emitScore();
    }

    emitScore() {
      this.callbacks.onScoreChange({
        score: this.score,
        level: this.level,
        lines: this.lines,
        highScore: this.highScore,
      });
    }

    runLoop() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.state !== GAME_STATES.PLAYING) return;

      const loop = (currentTime) => {
        if (this.state !== GAME_STATES.PLAYING) return;

        const delta = Math.max(0, Math.min(currentTime - this.lastTime, 100));
        this.lastTime = currentTime;

        if (!this.isLineClearing) {
          this.update(delta);
        }

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    }

    update(delta) {
      if (!this.currentPiece) return;

      this.handleContinuousInput(delta);

      const isTouchingFloor = !this.board.isValidMove(this.currentPiece, 0, 1);

      if (isTouchingFloor) {
        this.isLocking = true;
        this.lockTimer += delta;

        if (this.lockTimer >= LOCK_DELAY_MS) {
          this.lockCurrentPiece();
          return;
        }
      } else {
        this.isLocking = false;
        this.lockTimer = 0;
      }

      if (this.isSoftDropping) {
        this.softDropAccumulator += delta;
        const softSpeed = 35;
        if (this.softDropAccumulator >= softSpeed) {
          this.softDropAccumulator = 0;
          if (this.board.isValidMove(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
            this.score += POINTS.SOFT_DROP_PER_CELL;
            this.emitScore();
            sound.playSoftDrop();
          }
        }
      } else {
        this.gravityAccumulator += delta;
        const currentSpeed = this.getSpeed();

        if (this.gravityAccumulator >= currentSpeed) {
          this.gravityAccumulator = 0;
          if (this.board.isValidMove(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
          }
        }
      }
    }

    handleContinuousInput(delta) {
      if (this.keys['ArrowLeft'] || this.keys['KeyA'] || this.keys['a']) {
        this.dasTimer.left += delta;
        if (this.dasTimer.left >= DAS_DELAY_MS) {
          this.arrTimer.left += delta;
          if (this.arrTimer.left >= ARR_INTERVAL_MS) {
            this.arrTimer.left = 0;
            this.moveLeft();
          }
        }
      }
      if (this.keys['ArrowRight'] || this.keys['KeyD'] || this.keys['d']) {
        this.dasTimer.right += delta;
        if (this.dasTimer.right >= DAS_DELAY_MS) {
          this.arrTimer.right += delta;
          if (this.arrTimer.right >= ARR_INTERVAL_MS) {
            this.arrTimer.right = 0;
            this.moveRight();
          }
        }
      }
    }

    onLockActionReset() {
      if (this.isLocking && this.lockResets < MAX_LOCK_RESETS) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }

    moveLeft() {
      if (this.state !== GAME_STATES.PLAYING || !this.currentPiece || this.isLineClearing) return false;
      if (this.board.isValidMove(this.currentPiece, -1, 0)) {
        this.currentPiece.x--;
        this.onLockActionReset();
        sound.playMove();
        return true;
      }
      return false;
    }

    moveRight() {
      if (this.state !== GAME_STATES.PLAYING || !this.currentPiece || this.isLineClearing) return false;
      if (this.board.isValidMove(this.currentPiece, 1, 0)) {
        this.currentPiece.x++;
        this.onLockActionReset();
        sound.playMove();
        return true;
      }
      return false;
    }

    rotate(direction = 'CW') {
      if (this.state !== GAME_STATES.PLAYING || !this.currentPiece || this.isLineClearing) return false;

      const rotatedMatrix = this.currentPiece.getRotatedMatrix(direction);
      const kickOffsets = this.currentPiece.getKickOffsets(direction);

      for (const [dx, dy] of kickOffsets) {
        const offsetX = dx;
        const offsetY = -dy;

        if (this.board.isValidMove(this.currentPiece, offsetX, offsetY, rotatedMatrix)) {
          this.currentPiece.matrix = rotatedMatrix;
          this.currentPiece.rotation = this.currentPiece.getNextRotationIndex(direction);
          this.currentPiece.x += offsetX;
          this.currentPiece.y += offsetY;

          this.onLockActionReset();
          sound.playRotate();
          return true;
        }
      }
      return false;
    }

    hardDrop() {
      if (this.state !== GAME_STATES.PLAYING || !this.currentPiece || this.isLineClearing) return;

      const ghost = this.board.getGhostPosition(this.currentPiece);
      const dropDistance = ghost.y - this.currentPiece.y;
      this.currentPiece.y = ghost.y;

      this.score += dropDistance * POINTS.HARD_DROP_PER_CELL;
      this.emitScore();

      sound.playHardDrop();
      this.lockCurrentPiece();
    }

    hold() {
      if (this.state !== GAME_STATES.PLAYING || !this.currentPiece || !this.canHold || this.isLineClearing) return;

      sound.playHold();
      const currentType = this.currentPiece.type;

      if (this.holdType === null) {
        this.holdType = currentType;
        this.spawnPiece();
      } else {
        const prevHold = this.holdType;
        this.holdType = currentType;
        this.currentPiece = new Tetromino(prevHold);
        this.lockTimer = 0;
        this.lockResets = 0;
        this.isLocking = false;

        if (!this.board.isValidMove(this.currentPiece)) {
          this.triggerGameOver();
          return;
        }
      }

      this.canHold = false;
    }

    lockCurrentPiece() {
      if (!this.currentPiece) return;

      this.board.lockPiece(this.currentPiece);
      sound.playLock();
      this.callbacks.onPieceLock(this.currentPiece);

      if (this.board.hasBufferOverflow()) {
        this.triggerGameOver();
        return;
      }

      const fullRows = this.board.findFullRows();
      if (fullRows.length > 0) {
        this.isLineClearing = true;
        sound.playLineClear(fullRows.length);

        this.callbacks.onLineClearAnimation(fullRows, () => {
          this.board.clearRows(fullRows);
          this.processLineClearScore(fullRows.length);
          this.isLineClearing = false;
          this.spawnPiece();
        });
      } else {
        this.combo = -1;
        this.spawnPiece();
      }
    }

    processLineClearScore(linesCleared) {
      this.lines += linesCleared;
      this.combo++;

      let basePoints = 0;
      if (linesCleared === 1) {
        basePoints = POINTS.SINGLE;
        this.backToBack = false;
      } else if (linesCleared === 2) {
        basePoints = POINTS.DOUBLE;
        this.backToBack = false;
      } else if (linesCleared === 3) {
        basePoints = POINTS.TRIPLE;
        this.backToBack = false;
      } else if (linesCleared === 4) {
        basePoints = this.backToBack ? POINTS.BACK_TO_BACK_TETRIS : POINTS.TETRIS;
        this.backToBack = true;
      }

      let gainedPoints = basePoints * this.level;
      if (this.combo > 0) {
        gainedPoints += 50 * this.combo * this.level;
      }

      this.score += gainedPoints;

      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        sound.playLevelUp();
      }

      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem('tetris_highscore', String(this.highScore));
        } catch (e) {}
      }

      this.emitScore();
    }

    handleKeyDown(code, key = '') {
      if (this.keys[code]) return;
      this.keys[code] = true;
      if (key) this.keys[key.toLowerCase()] = true;

      if (code === 'KeyP' || code === 'Escape' || key.toLowerCase() === 'p') {
        this.togglePause();
        return;
      }

      if (this.state !== GAME_STATES.PLAYING) return;

      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.dasTimer.left = 0;
          this.arrTimer.left = 0;
          this.moveLeft();
          break;

        case 'ArrowRight':
        case 'KeyD':
          this.dasTimer.right = 0;
          this.arrTimer.right = 0;
          this.moveRight();
          break;

        case 'ArrowUp':
        case 'KeyW':
        case 'KeyX':
          this.rotate('CW');
          break;

        case 'KeyZ':
        case 'ControlLeft':
        case 'ControlRight':
          this.rotate('CCW');
          break;

        case 'ArrowDown':
        case 'KeyS':
          this.isSoftDropping = true;
          this.softDropAccumulator = 0;
          break;

        case 'Space':
          this.hardDrop();
          break;

        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.hold();
          break;

        default:
          if (key === 'a' || key === 'A') {
            this.moveLeft();
          } else if (key === 'd' || key === 'D') {
            this.moveRight();
          } else if (key === 'w' || key === 'W' || key === 'x' || key === 'X') {
            this.rotate('CW');
          } else if (key === 'z' || key === 'Z') {
            this.rotate('CCW');
          } else if (key === 'c' || key === 'C') {
            this.hold();
          }
          break;
      }
    }

    handleKeyUp(code, key = '') {
      delete this.keys[code];
      if (key) delete this.keys[key.toLowerCase()];

      if (code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'S') {
        this.isSoftDropping = false;
      }
      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'A') {
        this.dasTimer.left = 0;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'd' || key === 'D') {
        this.dasTimer.right = 0;
      }
    }
  }

  // ==========================================================================
  // 6. PARTICLES & NOTIFICATIONS
  // ==========================================================================
  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    emit(x, y, color, count = 12, speed = 4) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 0.7 + 0.3) * speed;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity - 1,
          size: Math.random() * 3 + 2,
          color,
          alpha: 1,
          decay: Math.random() * 0.03 + 0.02,
        });
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      ctx.save();
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class NotificationManager {
    constructor() {
      this.notifications = [];
    }

    add(text, x, y, color = '#ffd700', isLarge = false) {
      this.notifications.push({
        text,
        x,
        y,
        color,
        alpha: 1,
        vy: -1.2,
        isLarge,
      });
    }

    update() {
      for (let i = this.notifications.length - 1; i >= 0; i--) {
        const n = this.notifications[i];
        n.y += n.vy;
        n.alpha -= 0.02;
        if (n.alpha <= 0) {
          this.notifications.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      ctx.save();
      for (const n of this.notifications) {
        ctx.globalAlpha = Math.max(0, n.alpha);
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 10;
        ctx.font = n.isLarge ? 'bold 20px "Segoe UI", sans-serif' : 'bold 15px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.text, n.x, n.y);
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // 7. PRESENTATION & CONTROLLER INITIALIZATION
  // ==========================================================================
  function initTetrisApp() {
    const boardCanvas = document.getElementById('boardCanvas');
    if (!boardCanvas) return;
    const boardCtx = boardCanvas.getContext('2d');

    const holdCanvas = document.getElementById('holdCanvas');
    const holdCtx = holdCanvas.getContext('2d');

    const nextCanvas = document.getElementById('nextCanvas');
    const nextCtx = nextCanvas.getContext('2d');

    const scoreVal = document.getElementById('scoreVal');
    const levelVal = document.getElementById('levelVal');
    const linesVal = document.getElementById('linesVal');
    const highScoreVal = document.getElementById('highScoreVal');

    const startOverlay = document.getElementById('startOverlay');
    const startBtn = document.getElementById('startBtn');
    const pauseDialog = document.getElementById('pauseDialog');
    const resumeBtn = document.getElementById('resumeBtn');
    const gameOverDialog = document.getElementById('gameOverDialog');
    const retryBtn = document.getElementById('retryBtn');
    const finalScoreVal = document.getElementById('finalScoreVal');
    const finalLinesVal = document.getElementById('finalLinesVal');
    const helpDialog = document.getElementById('helpDialog');
    const helpBtn = document.getElementById('helpBtn');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const muteBtn = document.getElementById('muteBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    function setupHiDPI(canvas, ctx, width, height) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    }

    const BOARD_WIDTH = COLS * BLOCK_SIZE; // 300
    const BOARD_HEIGHT = ROWS * BLOCK_SIZE; // 600
    setupHiDPI(boardCanvas, boardCtx, BOARD_WIDTH, BOARD_HEIGHT);
    setupHiDPI(holdCanvas, holdCtx, 120, 100);
    setupHiDPI(nextCanvas, nextCtx, 120, 260);

    const particles = new ParticleSystem();
    const notifications = new NotificationManager();

    let clearingRows = [];
    let clearingFlashAlpha = 0;

    const game = new Game({
      onStateChange: (state) => {
        if (state === GAME_STATES.PLAYING) {
          startOverlay.classList.add('hidden');
          if (pauseDialog && pauseDialog.open) pauseDialog.close();
          if (gameOverDialog && gameOverDialog.open) gameOverDialog.close();
        } else if (state === GAME_STATES.PAUSED) {
          if (pauseDialog && !pauseDialog.open) {
            if (typeof pauseDialog.showModal === 'function') {
              pauseDialog.showModal();
            } else {
              pauseDialog.setAttribute('open', '');
            }
          }
        } else if (state === GAME_STATES.GAMEOVER) {
          if (finalScoreVal) finalScoreVal.textContent = game.score.toLocaleString();
          if (finalLinesVal) finalLinesVal.textContent = game.lines;
          if (gameOverDialog && !gameOverDialog.open) {
            if (typeof gameOverDialog.showModal === 'function') {
              gameOverDialog.showModal();
            } else {
              gameOverDialog.setAttribute('open', '');
            }
          }
        }
      },
      onScoreChange: ({ score, level, lines, highScore }) => {
        if (scoreVal) scoreVal.textContent = score.toLocaleString();
        if (levelVal) levelVal.textContent = level;
        if (linesVal) linesVal.textContent = lines;
        if (highScoreVal) highScoreVal.textContent = highScore.toLocaleString();
      },
      onPieceLock: (piece) => {
        const ghost = game.board.getGhostPosition(piece);
        const centerX = (piece.x + piece.matrix[0].length / 2) * BLOCK_SIZE;
        const centerY = (ghost.y - BUFFER_ROWS + piece.matrix.length) * BLOCK_SIZE;
        particles.emit(centerX, Math.min(centerY, BOARD_HEIGHT), piece.color.main, 8, 2.5);
      },
      onLineClearAnimation: (rows, onComplete) => {
        clearingRows = [...rows];
        clearingFlashAlpha = 1.0;

        rows.forEach((r) => {
          const yPos = (r - BUFFER_ROWS) * BLOCK_SIZE + BLOCK_SIZE / 2;
          for (let col = 0; col < COLS; col += 2) {
            const xPos = col * BLOCK_SIZE + BLOCK_SIZE / 2;
            particles.emit(xPos, yPos, '#ffffff', 6, 4);
            particles.emit(xPos, yPos, '#00f0f0', 4, 3);
          }
        });

        const text = rows.length === 4 ? '★ TETRIS! ★' : rows.length === 3 ? 'TRIPLE!' : rows.length === 2 ? 'DOUBLE!' : '+100';
        const color = rows.length === 4 ? '#00ffff' : '#ffd700';
        notifications.add(text, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, color, rows.length >= 3);

        const start = performance.now();
        const flashDuration = 180;

        const animateFlash = (now) => {
          const elapsed = now - start;
          clearingFlashAlpha = Math.max(0, 1 - elapsed / flashDuration);

          if (elapsed < flashDuration) {
            requestAnimationFrame(animateFlash);
          } else {
            clearingRows = [];
            clearingFlashAlpha = 0;
            onComplete();
          }
        };
        requestAnimationFrame(animateFlash);
      },
    });

    function updateSoundIcon() {
      if (!muteBtn) return;
      const isMuted = sound.isMuted();
      muteBtn.setAttribute('aria-label', isMuted ? 'Unmute Sound' : 'Mute Sound');
      muteBtn.innerHTML = isMuted
        ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
        : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    }
    updateSoundIcon();

    function drawBlock(ctx, x, y, size, color, isGhost = false) {
      if (isGhost) {
        ctx.save();
        ctx.strokeStyle = color.main;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.fillStyle = color.main;
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size - 3, y + 3);
      ctx.lineTo(x + 3, y + 3);
      ctx.lineTo(x + 3, y + size - 3);
      ctx.lineTo(x, y + size);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = color.shadow || 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x + size, y);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x + 3, y + size - 3);
      ctx.lineTo(x + size - 3, y + size - 3);
      ctx.lineTo(x + size - 3, y + 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x + 5, y + 5, size - 10, size - 10);

      ctx.restore();
    }

    function drawGrid(ctx, width, height, blockSize) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;

      for (let x = 0; x <= width; x += blockSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += blockSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMiniPiece(ctx, type, canvasWidth, canvasHeight, offsetY = 0, scale = 22) {
      if (!type) return;

      const colors = TETROMINO_COLORS[type];
      const shapes = {
        I: [[1, 1, 1, 1]],
        J: [[1, 0, 0], [1, 1, 1]],
        L: [[0, 0, 1], [1, 1, 1]],
        O: [[1, 1], [1, 1]],
        S: [[0, 1, 1], [1, 1, 0]],
        T: [[0, 1, 0], [1, 1, 1]],
        Z: [[1, 1, 0], [0, 1, 1]],
      };

      const mat = shapes[type];
      const rows = mat.length;
      const cols = mat[0].length;
      const pieceWidth = cols * scale;
      const pieceHeight = rows * scale;

      const startX = (canvasWidth - pieceWidth) / 2;
      const startY = offsetY + (canvasHeight - pieceHeight) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (mat[r][c]) {
            drawBlock(ctx, startX + c * scale, startY + r * scale, scale, colors);
          }
        }
      }
    }

    function render() {
      // 1. Clear board
      boardCtx.fillStyle = '#080c14';
      boardCtx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      drawGrid(boardCtx, BOARD_WIDTH, BOARD_HEIGHT, BLOCK_SIZE);

      // 2. Render locked blocks on board
      for (let r = BUFFER_ROWS; r < game.board.totalRows; r++) {
        const isClearing = clearingRows.includes(r);
        for (let c = 0; c < COLS; c++) {
          const cell = game.board.grid[r][c];
          if (cell) {
            const screenY = (r - BUFFER_ROWS) * BLOCK_SIZE;
            const screenX = c * BLOCK_SIZE;

            if (isClearing) {
              boardCtx.save();
              boardCtx.fillStyle = `rgba(255, 255, 255, ${clearingFlashAlpha})`;
              boardCtx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
              boardCtx.restore();
            } else {
              drawBlock(boardCtx, screenX, screenY, BLOCK_SIZE, cell);
            }
          }
        }
      }

      // 3. Render Ghost and Active Piece
      if ((game.state === GAME_STATES.PLAYING || game.state === GAME_STATES.PAUSED) && game.currentPiece && !game.isLineClearing) {
        const ghost = game.board.getGhostPosition(game.currentPiece);
        const mat = game.currentPiece.matrix;
        const n = mat.length;

        // Draw Ghost
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (mat[r][c] !== 0) {
              const screenY = (ghost.y + r - BUFFER_ROWS) * BLOCK_SIZE;
              const screenX = (ghost.x + c) * BLOCK_SIZE;
              if (screenY >= 0) {
                drawBlock(boardCtx, screenX, screenY, BLOCK_SIZE, game.currentPiece.color, true);
              }
            }
          }
        }

        // Draw Active Piece
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (mat[r][c] !== 0) {
              const screenY = (game.currentPiece.y + r - BUFFER_ROWS) * BLOCK_SIZE;
              const screenX = (game.currentPiece.x + c) * BLOCK_SIZE;
              if (screenY >= 0) {
                drawBlock(boardCtx, screenX, screenY, BLOCK_SIZE, game.currentPiece.color);
              }
            }
          }
        }
      }

      // 4. Particles & Notifications
      particles.update();
      particles.draw(boardCtx);

      notifications.update();
      notifications.draw(boardCtx);

      // 5. Draw Hold Piece
      holdCtx.fillStyle = '#0f1422';
      holdCtx.fillRect(0, 0, 120, 100);
      if (game.holdType) {
        drawMiniPiece(holdCtx, game.holdType, 120, 100, 0, 20);
      }

      // 6. Draw Next Pieces
      nextCtx.fillStyle = '#0f1422';
      nextCtx.fillRect(0, 0, 120, 260);
      const nextPieces = game.randomizer.peek(3);
      const slotHeight = 260 / 3;
      nextPieces.forEach((type, idx) => {
        drawMiniPiece(nextCtx, type, 120, slotHeight, idx * slotHeight, 18);
      });

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // Initial score display
    game.emitScore();

    // Keyboard Event Listeners
    window.addEventListener('keydown', (e) => {
      if (game.state === GAME_STATES.READY && (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        sound.ensureContext();
        game.start();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      sound.ensureContext();
      game.handleKeyDown(e.code, e.key);
    });

    window.addEventListener('keyup', (e) => {
      game.handleKeyUp(e.code, e.key);
    });

    // UI Buttons
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        sound.ensureContext();
        game.start();
        window.focus();
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (gameOverDialog && gameOverDialog.close) gameOverDialog.close();
        game.start();
        window.focus();
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        game.resume();
        window.focus();
      });
    }

    if (pauseDialog) {
      pauseDialog.addEventListener('close', () => {
        if (game.state === GAME_STATES.PAUSED) {
          game.resume();
        }
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        game.togglePause();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        sound.toggleMute();
        updateSoundIcon();
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        if (game.state === GAME_STATES.PLAYING) {
          game.pause();
        }
        if (helpDialog) {
          if (typeof helpDialog.showModal === 'function') {
            helpDialog.showModal();
          } else {
            helpDialog.setAttribute('open', '');
          }
        }
      });
    }

    if (closeHelpBtn) {
      closeHelpBtn.addEventListener('click', () => {
        if (helpDialog && helpDialog.close) helpDialog.close();
      });
    }

    // Touch controls
    function bindTouchButton(elementId, onTrigger, isContinuous = false) {
      const btn = document.getElementById(elementId);
      if (!btn) return;

      let intervalId = null;

      const start = (e) => {
        e.preventDefault();
        sound.ensureContext();
        onTrigger();
        if (isContinuous) {
          intervalId = setInterval(onTrigger, 80);
        }
      };

      const stop = (e) => {
        e.preventDefault();
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    }

    bindTouchButton('btnLeft', () => game.moveLeft(), true);
    bindTouchButton('btnRight', () => game.moveRight(), true);
    bindTouchButton('btnDown', () => {
      if (game.state === GAME_STATES.PLAYING && game.currentPiece && !game.isLineClearing) {
        if (game.board.isValidMove(game.currentPiece, 0, 1)) {
          game.currentPiece.y++;
          game.score += 1;
          game.emitScore();
          sound.playSoftDrop();
        }
      }
    }, true);
    bindTouchButton('btnRotateCW', () => game.rotate('CW'));
    bindTouchButton('btnRotateCCW', () => game.rotate('CCW'));
    bindTouchButton('btnHardDrop', () => game.hardDrop());
    bindTouchButton('btnHold', () => game.hold());
  }

  // Safe DOM Ready execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTetrisApp);
  } else {
    initTetrisApp();
  }
})();
