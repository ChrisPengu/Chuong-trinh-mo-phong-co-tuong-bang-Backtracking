export const ROWS = 10;
export const COLS = 9;
export const RED = "red";
export const BLACK = "black";

export const PIECE_NAMES = {
  K: "Tướng",
  A: "Sĩ",
  E: "Tượng",
  H: "Mã",
  R: "Xe",
  C: "Pháo",
  P: "Tốt",
};

const INITIAL = [
  "rheakaehr",
  ".........",
  ".c.....c.",
  "p.p.p.p.p",
  ".........",
  ".........",
  "P.P.P.P.P",
  ".C.....C.",
  ".........",
  "RHEAKAEHR",
];

const CHAR_TO_TYPE = { k: "K", a: "A", e: "E", h: "H", r: "R", c: "C", p: "P" };

export function opposite(color) {
  return color === RED ? BLACK : RED;
}

export function createInitialBoard() {
  return INITIAL.map((row) =>
    [...row].map((char) => {
      if (char === ".") return null;
      return {
        type: CHAR_TO_TYPE[char.toLowerCase()],
        color: char === char.toUpperCase() ? RED : BLACK,
      };
    }),
  );
}

export function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function inPalace(row, col, color) {
  if (col < 3 || col > 5) return false;
  return color === RED ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
}

function pushIfAvailable(board, moves, fromRow, fromCol, toRow, toCol, color) {
  if (!inBounds(toRow, toCol)) return;
  const target = board[toRow][toCol];
  if (!target || target.color !== color) {
    moves.push({ fromRow, fromCol, toRow, toCol, captured: target?.type ?? null });
  }
}

function rayMoves(board, piece, row, col, directions, cannon = false) {
  const moves = [];
  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    let screenFound = false;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!cannon) {
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c, captured: null });
        } else {
          if (target.color !== piece.color) {
            moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c, captured: target.type });
          }
          break;
        }
      } else if (!screenFound) {
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c, captured: null });
        } else {
          screenFound = true;
        }
      } else if (target) {
        if (target.color !== piece.color) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c, captured: target.type });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

export function generatePseudoMovesForPiece(board, row, col) {
  const piece = board[row]?.[col];
  if (!piece) return [];
  const moves = [];
  const orthogonal = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  switch (piece.type) {
    case "R":
      return rayMoves(board, piece, row, col, orthogonal);
    case "C":
      return rayMoves(board, piece, row, col, orthogonal, true);
    case "H": {
      const jumps = [
        [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
      ];
      for (const [dr, dc, legR, legC] of jumps) {
        if (!board[row + legR]?.[col + legC]) {
          pushIfAvailable(board, moves, row, col, row + dr, col + dc, piece.color);
        }
      }
      break;
    }
    case "E": {
      for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
        const toRow = row + dr;
        const toCol = col + dc;
        const staysHome = piece.color === RED ? toRow >= 5 : toRow <= 4;
        if (staysHome && !board[row + dr / 2]?.[col + dc / 2]) {
          pushIfAvailable(board, moves, row, col, toRow, toCol, piece.color);
        }
      }
      break;
    }
    case "A":
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const toRow = row + dr;
        const toCol = col + dc;
        if (inPalace(toRow, toCol, piece.color)) {
          pushIfAvailable(board, moves, row, col, toRow, toCol, piece.color);
        }
      }
      break;
    case "K": {
      for (const [dr, dc] of orthogonal) {
        const toRow = row + dr;
        const toCol = col + dc;
        if (inPalace(toRow, toCol, piece.color)) {
          pushIfAvailable(board, moves, row, col, toRow, toCol, piece.color);
        }
      }
      const direction = piece.color === RED ? -1 : 1;
      for (let r = row + direction; inBounds(r, col); r += direction) {
        const target = board[r][col];
        if (!target) continue;
        if (target.type === "K" && target.color !== piece.color) {
          moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: col, captured: "K" });
        }
        break;
      }
      break;
    }
    case "P": {
      const forward = piece.color === RED ? -1 : 1;
      pushIfAvailable(board, moves, row, col, row + forward, col, piece.color);
      const crossedRiver = piece.color === RED ? row <= 4 : row >= 5;
      if (crossedRiver) {
        pushIfAvailable(board, moves, row, col, row, col - 1, piece.color);
        pushIfAvailable(board, moves, row, col, row, col + 1, piece.color);
      }
      break;
    }
  }
  return moves;
}

export function findKing(board, color) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const piece = board[row][col];
      if (piece?.type === "K" && piece.color === color) return { row, col };
    }
  }
  return null;
}

export function isSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.color !== byColor) continue;
      if (generatePseudoMovesForPiece(board, r, c).some((move) => move.toRow === row && move.toCol === col)) {
        return true;
      }
    }
  }
  return false;
}

export function isInCheck(board, color) {
  const king = findKing(board, color);
  return !king || isSquareAttacked(board, king.row, king.col, opposite(color));
}

export function makeMove(board, move) {
  const captured = board[move.toRow][move.toCol];
  board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol];
  board[move.fromRow][move.fromCol] = null;
  return captured;
}

export function undoMove(board, move, captured) {
  board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol];
  board[move.toRow][move.toCol] = captured;
}

export function generateLegalMovesForPiece(board, row, col) {
  const piece = board[row]?.[col];
  if (!piece) return [];
  return generatePseudoMovesForPiece(board, row, col).filter((move) => {
    const captured = makeMove(board, move);
    const legal = !isInCheck(board, piece.color);
    undoMove(board, move, captured);
    return legal;
  });
}

export function generateLegalMoves(board, color) {
  const moves = [];
  if (!findKing(board, color)) return moves;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col]?.color === color) {
        moves.push(...generateLegalMovesForPiece(board, row, col));
      }
    }
  }
  return moves;
}

export function boardKey(board, turn = "") {
  const cells = [];
  for (const row of board) {
    for (const piece of row) {
      if (!piece) cells.push(".");
      else cells.push(piece.color === RED ? piece.type : piece.type.toLowerCase());
    }
  }
  return `${turn[0] ?? "-"}:${cells.join("")}`;
}

export function getGameStatus(board, turn) {
  const redKing = findKing(board, RED);
  const blackKing = findKing(board, BLACK);
  if (!redKing) return { over: true, winner: BLACK, reason: "Tướng Đỏ đã bị bắt" };
  if (!blackKing) return { over: true, winner: RED, reason: "Tướng Đen đã bị bắt" };
  const moves = generateLegalMoves(board, turn);
  if (moves.length > 0) {
    return { over: false, winner: null, inCheck: isInCheck(board, turn), reason: "" };
  }
  return {
    over: true,
    winner: opposite(turn),
    inCheck: isInCheck(board, turn),
    reason: isInCheck(board, turn) ? "Chiếu bí" : "Không còn nước đi hợp lệ",
  };
}

const FILES = "abcdefghi";
export function formatMove(move, piece) {
  const from = `${FILES[move.fromCol]}${10 - move.fromRow}`;
  const to = `${FILES[move.toCol]}${10 - move.toRow}`;
  return `${PIECE_NAMES[piece.type]} ${from}–${to}`;
}
