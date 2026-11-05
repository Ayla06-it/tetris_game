/**
 * Main Presentation & UI Controller
 * Handles Canvas rendering, particle systems, DOM events, and touch controls.
 */

import {
  COLS,
  ROWS,
  BUFFER_ROWS,
  BLOCK_SIZE,
  TETROMINO_COLORS,
} from './constants.js';
import { Game, GAME_STATES } from './game.js';
import { sound } from './audio.js';

// Particle system for line clears and hard drops
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
        vy: Math.sin(angle) * velocity - 1, // slight upward bias
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
      p.vy += 0.15; // Gravity
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

// Floating score feedback notifications
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

// Main App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Canvases & Contexts
  const boardCanvas = document.getElementById('boardCanvas');
  const boardCtx = boardCanvas.getContext('2d');

  const holdCanvas = document.getElementById('holdCanvas');
  const holdCtx = holdCanvas.getContext('2d');

  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas.getContext('2d');

  // DOM Stats Elements
  const scoreVal = document.getElementById('scoreVal');
  const levelVal = document.getElementById('levelVal');
  const linesVal = document.getElementById('linesVal');
  const highScoreVal = document.getElementById('highScoreVal');

  // Modals & Buttons
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

  // Retina / HiDPI Canvas Scaling
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

  // Initialize Game Instance
  const game = new Game({
    onStateChange: (state) => {
      if (state === GAME_STATES.PLAYING) {
        startOverlay.classList.add('hidden');
        if (pauseDialog.open) pauseDialog.close();
        if (gameOverDialog.open) gameOverDialog.close();
      } else if (state === GAME_STATES.PAUSED) {
        if (!pauseDialog.open) pauseDialog.showModal();
      } else if (state === GAME_STATES.GAMEOVER) {
        finalScoreVal.textContent = game.score.toLocaleString();
        finalLinesVal.textContent = game.lines;
        if (!gameOverDialog.open) gameOverDialog.showModal();
      }
    },
    onScoreChange: ({ score, level, lines, highScore }) => {
      scoreVal.textContent = score.toLocaleString();
      levelVal.textContent = level;
      linesVal.textContent = lines;
      highScoreVal.textContent = highScore.toLocaleString();
    },
    onPieceLock: (piece) => {
      const ghost = game.board.getGhostPosition(piece);
      // Small impact particles
      const centerX = (piece.x + piece.matrix[0].length / 2) * BLOCK_SIZE;
      const centerY = (ghost.y - BUFFER_ROWS + piece.matrix.length) * BLOCK_SIZE;
      particles.emit(centerX, Math.min(centerY, BOARD_HEIGHT), piece.color.main, 8, 2.5);
    },
    onLineClearAnimation: (rows, onComplete) => {
      clearingRows = [...rows];
      clearingFlashAlpha = 1.0;

      // Particle explosion across cleared lines
      rows.forEach((r) => {
        const yPos = (r - BUFFER_ROWS) * BLOCK_SIZE + BLOCK_SIZE / 2;
        for (let col = 0; col < COLS; col += 2) {
          const xPos = col * BLOCK_SIZE + BLOCK_SIZE / 2;
          particles.emit(xPos, yPos, '#ffffff', 6, 4);
          particles.emit(xPos, yPos, '#00f0f0', 4, 3);
        }
      });

      // Show floating text banner
      const text = rows.length === 4 ? '★ TETRIS! ★' : rows.length === 3 ? 'TRIPLE!' : rows.length === 2 ? 'DOUBLE!' : '+100';
      const color = rows.length === 4 ? '#00ffff' : '#ffd700';
      notifications.add(text, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, color, rows.length >= 3);

      let start = performance.now();
      const flashDuration = 180; // ms

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

  // Sound Icon Renderer
  function updateSoundIcon() {
    const isMuted = sound.isMuted();
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute Sound' : 'Mute Sound');
    muteBtn.innerHTML = isMuted
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }
  updateSoundIcon();

  // Draw a single block with arcade bevel & highlights
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
    // Base block
    ctx.fillStyle = color.main;
    ctx.fillRect(x, y, size, size);

    // Subtle inner bevel (top/left bright, bottom/right shade)
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

    // Center subtle gloss
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x + 5, y + 5, size - 10, size - 10);

    ctx.restore();
  }

  // Draw background grid lines
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

  // Preview renderer for mini pieces (Hold & Next)
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

  // Render loop
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
            // Flash effect for cleared line
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

      // Draw Ghost Piece
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

    // 4. Update and Draw Particles & Notifications
    particles.update();
    particles.draw(boardCtx);

    notifications.update();
    notifications.draw(boardCtx);

    // 5. Draw Hold Piece Canvas
    holdCtx.fillStyle = '#0f1422';
    holdCtx.fillRect(0, 0, 120, 100);
    if (game.holdType) {
      drawMiniPiece(holdCtx, game.holdType, 120, 100, 0, 20);
    }

    // 6. Draw Next 3 Pieces Queue
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

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    if (game.state === GAME_STATES.READY && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      sound.ensureContext();
      game.start();
      return;
    }

    // Prevent scrolling when playing with arrow keys and space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    sound.ensureContext();
    game.handleKeyDown(e.code);
  });

  window.addEventListener('keyup', (e) => {
    game.handleKeyUp(e.code);
  });

  // UI Button Listeners
  startBtn.addEventListener('click', () => {
    sound.ensureContext();
    game.start();
  });

  retryBtn.addEventListener('click', () => {
    gameOverDialog.close();
    game.start();
  });

  resumeBtn.addEventListener('click', () => {
    game.resume();
  });

  pauseDialog.addEventListener('close', () => {
    if (game.state === GAME_STATES.PAUSED) {
      game.resume();
    }
  });

  pauseBtn.addEventListener('click', () => {
    game.togglePause();
  });

  muteBtn.addEventListener('click', () => {
    sound.toggleMute();
    updateSoundIcon();
  });

  helpBtn.addEventListener('click', () => {
    if (game.state === GAME_STATES.PLAYING) {
      game.pause();
    }
    helpDialog.showModal();
  });

  closeHelpBtn.addEventListener('click', () => {
    helpDialog.close();
  });

  // Mobile Touch Controls
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
});
