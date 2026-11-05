/**
 * Tetris Core Game Engine and State Machine
 */

import {
  LEVEL_SPEEDS,
  POINTS,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  DAS_DELAY_MS,
  ARR_INTERVAL_MS,
} from './constants.js';
import { Board } from './board.js';
import { Tetromino, Randomizer } from './tetromino.js';
import { sound } from './audio.js';

export const GAME_STATES = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
};

export class Game {
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
    this.highScore = parseInt(localStorage.getItem('tetris_highscore') || '0', 10);

    // Timing & Gravity
    this.lastTime = 0;
    this.gravityAccumulator = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.isLocking = false;
    this.isLineClearing = false;

    // Soft drop state
    this.isSoftDropping = false;
    this.softDropAccumulator = 0;

    // Input state for DAS/ARR
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

    // Check if initial position collides (Immediate Top-out / Block-out)
    if (!this.board.isValidMove(this.currentPiece)) {
      this.triggerGameOver();
    }
  }

  triggerGameOver() {
    this.setState(GAME_STATES.GAMEOVER);
    sound.playGameOver();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_highscore', String(this.highScore));
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

  /**
   * Main game loop
   */
  runLoop() {
    if (this.state !== GAME_STATES.PLAYING) return;

    const loop = (currentTime) => {
      if (this.state !== GAME_STATES.PLAYING) return;

      const delta = Math.min(currentTime - this.lastTime, 100); // Prevent spiral on lag
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

    // Check grounded state
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

    // Gravity fall
    if (this.isSoftDropping) {
      this.softDropAccumulator += delta;
      const softSpeed = 35; // Fast soft drop
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

  /**
   * Handle smooth continuous movement (DAS & ARR)
   */
  handleContinuousInput(delta) {
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
      this.dasTimer.left += delta;
      if (this.dasTimer.left >= DAS_DELAY_MS) {
        this.arrTimer.left += delta;
        if (this.arrTimer.left >= ARR_INTERVAL_MS) {
          this.arrTimer.left = 0;
          this.moveLeft();
        }
      }
    }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) {
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

    // Try kick offsets: [dx, dy] where +dy is up in math, so screen offset is -dy
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

    // Check if buffer rows overflow
    if (this.board.hasBufferOverflow()) {
      this.triggerGameOver();
      return;
    }

    // Check for cleared lines
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
      this.combo = -1; // Reset combo when piece locks with 0 lines
      this.spawnPiece();
    }
  }

  processLineClearScore(linesCleared) {
    this.lines += linesCleared;
    this.combo++;

    let basePoints = 0;
    let isTetris = false;

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
      isTetris = true;
      if (this.backToBack) {
        basePoints = POINTS.BACK_TO_BACK_TETRIS;
      } else {
        basePoints = POINTS.TETRIS;
      }
      this.backToBack = true;
    }

    let gainedPoints = basePoints * this.level;

    // Combo multiplier
    if (this.combo > 0) {
      gainedPoints += 50 * this.combo * this.level;
    }

    this.score += gainedPoints;

    // Level up check (every 10 lines)
    const newLevel = Math.floor(this.lines / 10) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      sound.playLevelUp();
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_highscore', String(this.highScore));
    }

    this.emitScore();
  }

  // Keyboard events integration
  handleKeyDown(code) {
    if (this.keys[code]) return; // Avoid OS autorepeat jitter
    this.keys[code] = true;

    if (code === 'KeyP' || code === 'Escape') {
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
    }
  }

  handleKeyUp(code) {
    delete this.keys[code];

    if (code === 'ArrowDown' || code === 'KeyS') {
      this.isSoftDropping = false;
    }
    if (code === 'ArrowLeft' || code === 'KeyA') {
      this.dasTimer.left = 0;
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      this.dasTimer.right = 0;
    }
  }
}
