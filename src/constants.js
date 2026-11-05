/**
 * Tetris Game Constants and Configuration
 * Standard Tetris Guidelines compliant (SRS kicks, 7-bag, standard scoring)
 */

export const COLS = 10;
export const ROWS = 20;
export const BUFFER_ROWS = 2; // Hidden rows above playfield
export const TOTAL_ROWS = ROWS + BUFFER_ROWS; // 22 total rows

export const BLOCK_SIZE = 30; // Logical pixels per block for 300x600 board

// Standard Tetris Colors (vibrant neon arcade palette)
export const TETROMINO_COLORS = {
  I: { main: '#00f0f0', shadow: '#00a3a3', glow: 'rgba(0, 240, 240, 0.5)' },
  J: { main: '#2060ff', shadow: '#1038b0', glow: 'rgba(32, 96, 255, 0.5)' },
  L: { main: '#ff8c00', shadow: '#b86000', glow: 'rgba(255, 140, 0, 0.5)' },
  O: { main: '#ffd700', shadow: '#b89900', glow: 'rgba(255, 215, 0, 0.5)' },
  S: { main: '#10d050', shadow: '#0a8833', glow: 'rgba(16, 208, 80, 0.5)' },
  T: { main: '#b030ff', shadow: '#7818b8', glow: 'rgba(176, 48, 255, 0.5)' },
  Z: { main: '#ff2050', shadow: '#b01030', glow: 'rgba(255, 32, 80, 0.5)' },
};

// Initial Tetromino Shape Matrices (North orientation / Rotation 0)
export const SHAPES = {
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

/**
 * Super Rotation System (SRS) Wall Kick Data
 * Offsets are [dx, dy] where +x is right and +y is up in math (converted in engine: engine Y = -dy)
 */
export const SRS_KICKS_JLSTZ = {
  '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

export const SRS_KICKS_I = {
  '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// Points Table by Line Count (multiplied by level)
export const POINTS = {
  SINGLE: 100,
  DOUBLE: 300,
  TRIPLE: 500,
  TETRIS: 800,
  BACK_TO_BACK_TETRIS: 1200,
  SOFT_DROP_PER_CELL: 1,
  HARD_DROP_PER_CELL: 2,
};

// Gravity fall interval (milliseconds per cell drop) per level (1 - 15+)
export const LEVEL_SPEEDS = [
  800, // Level 1
  715, // Level 2
  630, // Level 3
  550, // Level 4
  470, // Level 5
  390, // Level 6
  320, // Level 7
  250, // Level 8
  190, // Level 9
  140, // Level 10
  105, // Level 11
  80,  // Level 12
  60,  // Level 13
  45,  // Level 14
  35,  // Level 15+
];

export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;

// Handling DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate)
export const DAS_DELAY_MS = 160;
export const ARR_INTERVAL_MS = 35;
