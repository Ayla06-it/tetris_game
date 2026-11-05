/**
 * Tetromino Definitions, 7-Bag Randomizer, and SRS Rotation
 */

import {
  SHAPES,
  TETROMINO_COLORS,
  SRS_KICKS_JLSTZ,
  SRS_KICKS_I,
} from './constants.js';

// Matrix rotation utilities
export function rotateMatrixCW(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[c][n - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

export function rotateMatrixCCW(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[n - 1 - c][r] = matrix[r][c];
    }
  }
  return result;
}

export class Tetromino {
  constructor(type) {
    this.type = type;
    this.color = TETROMINO_COLORS[type];
    // Deep clone matrix to avoid mutation
    this.matrix = SHAPES[type].map(row => [...row]);
    this.rotation = 0; // 0: North, 1: East, 2: South, 3: West

    // Standard spawn positions (grid total height 22, visible is rows 2-21)
    if (type === 'O') {
      this.x = 4;
      this.y = 1;
    } else if (type === 'I') {
      this.x = 3;
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
    return direction === 'CW'
      ? rotateMatrixCW(this.matrix)
      : rotateMatrixCCW(this.matrix);
  }

  getNextRotationIndex(direction = 'CW') {
    if (direction === 'CW') {
      return (this.rotation + 1) % 4;
    } else {
      return (this.rotation + 3) % 4;
    }
  }

  /**
   * Returns standard SRS kick tests for current -> next rotation.
   * Offsets in array are [dx, dy] where +x is right and +y is up.
   */
  getKickOffsets(direction = 'CW') {
    if (this.type === 'O') {
      return [[0, 0]];
    }

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

/**
 * Standard 7-Bag Randomizer
 * Generates endless permutation of the 7 pieces to avoid droughts.
 */
export class Randomizer {
  constructor() {
    this.queue = [];
    this.fillBag();
    this.fillBag();
  }

  fillBag() {
    const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    // Fisher-Yates shuffle
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
