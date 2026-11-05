/**
 * Tetris Playfield / Board State Management
 */

import { COLS, TOTAL_ROWS, BUFFER_ROWS } from './constants.js';

export class Board {
  constructor() {
    this.cols = COLS;
    this.totalRows = TOTAL_ROWS;
    this.bufferRows = BUFFER_ROWS;
    this.visibleRows = TOTAL_ROWS - BUFFER_ROWS; // 20
    this.grid = this.createEmptyGrid();
  }

  createEmptyGrid() {
    return Array.from({ length: this.totalRows }, () =>
      Array(this.cols).fill(null)
    );
  }

  reset() {
    this.grid = this.createEmptyGrid();
  }

  /**
   * Validate whether a piece (or matrix) can occupy a position
   */
  isValidMove(piece, offsetX = 0, offsetY = 0, matrix = null) {
    const mat = matrix || piece.matrix;
    const n = mat.length;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mat[r][c] !== 0) {
          const targetX = piece.x + c + offsetX;
          const targetY = piece.y + r + offsetY;

          // Wall and floor bounds check
          if (targetX < 0 || targetX >= this.cols) {
            return false;
          }
          if (targetY >= this.totalRows) {
            return false;
          }

          // Ceiling bounds: pieces can temporarily be in negative Y or buffer
          if (targetY >= 0) {
            if (this.grid[targetY][targetX] !== null) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  /**
   * Bake piece into board grid
   */
  lockPiece(piece) {
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

  /**
   * Compute ghost piece position (lowest valid position)
   */
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

  /**
   * Find completed rows (all cells non-null)
   */
  findFullRows() {
    const fullRows = [];
    for (let r = 0; r < this.totalRows; r++) {
      if (this.grid[r].every(cell => cell !== null)) {
        fullRows.push(r);
      }
    }
    return fullRows;
  }

  /**
   * Clear specified rows and add empty rows at the top
   */
  clearRows(rowIndices) {
    if (!rowIndices.length) return;

    // Filter out full rows
    const indexSet = new Set(rowIndices);
    const remainingRows = this.grid.filter((_, idx) => !indexSet.has(idx));

    // Pad top with fresh empty rows
    const emptyCount = this.totalRows - remainingRows.length;
    const newEmptyRows = Array.from({ length: emptyCount }, () =>
      Array(this.cols).fill(null)
    );

    this.grid = [...newEmptyRows, ...remainingRows];
  }

  /**
   * Check if any block is locked in the hidden buffer rows (0 or 1)
   */
  hasBufferOverflow() {
    for (let r = 0; r < this.bufferRows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          return true;
        }
      }
    }
    return false;
  }
}
