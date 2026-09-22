import test from "node:test";
import assert from "node:assert/strict";
import {
  BLACK,
  RED,
  boardKey,
  createInitialBoard,
  findKing,
  generateLegalMoves,
  generateLegalMovesForPiece,
  generatePseudoMovesForPiece,
  getGameStatus,
  isInCheck,
  makeMove,
} from "../src/engine.js";

function emptyBoard() {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function piece(type, color) {
  return { type, color };
}

function hasTarget(moves, row, col) {
  return moves.some((move) => move.toRow === row && move.toCol === col);
}

test("thế cờ khởi đầu có đủ 32 quân và hai Tướng đúng vị trí", () => {
  const board = createInitialBoard();
  assert.equal(board.flat().filter(Boolean).length, 32);
  assert.deepEqual(findKing(board, RED), { row: 9, col: 4 });
  assert.deepEqual(findKing(board, BLACK), { row: 0, col: 4 });
  assert.ok(generateLegalMoves(board, RED).length > 30);
});

test("Mã không thể nhảy khi bị cản chân", () => {
  const board = emptyBoard();
  board[5][4] = piece("H", RED);
  board[4][4] = piece("P", RED);
  const moves = generatePseudoMovesForPiece(board, 5, 4);
  assert.equal(hasTarget(moves, 3, 3), false);
  assert.equal(hasTarget(moves, 3, 5), false);
  assert.equal(hasTarget(moves, 4, 2), true);
});

test("Tượng bị cản mắt và không được qua sông", () => {
  const board = emptyBoard();
  board[7][2] = piece("E", RED);
  board[6][3] = piece("P", RED);
  let moves = generatePseudoMovesForPiece(board, 7, 2);
  assert.equal(hasTarget(moves, 5, 4), false);
  board[6][3] = null;
  moves = generatePseudoMovesForPiece(board, 7, 2);
  assert.equal(hasTarget(moves, 5, 4), true);

  board[5][4] = piece("E", RED);
  moves = generatePseudoMovesForPiece(board, 5, 4);
  assert.equal(moves.some((move) => move.toRow < 5), false);
});

test("Pháo chỉ ăn quân sau đúng một ngòi", () => {
  const board = emptyBoard();
  board[7][1] = piece("C", RED);
  board[5][1] = piece("P", RED);
  board[2][1] = piece("R", BLACK);
  const moves = generatePseudoMovesForPiece(board, 7, 1);
  assert.equal(hasTarget(moves, 2, 1), true);
  assert.equal(hasTarget(moves, 4, 1), false);
  assert.equal(hasTarget(moves, 6, 1), true);
});

test("Tốt chỉ được đi ngang sau khi qua sông", () => {
  const board = emptyBoard();
  board[6][4] = piece("P", RED);
  let moves = generatePseudoMovesForPiece(board, 6, 4);
  assert.equal(moves.length, 1);
  assert.equal(hasTarget(moves, 5, 4), true);
  board[6][4] = null;
  board[4][4] = piece("P", RED);
  moves = generatePseudoMovesForPiece(board, 4, 4);
  assert.equal(hasTarget(moves, 4, 3), true);
  assert.equal(hasTarget(moves, 4, 5), true);
  assert.equal(hasTarget(moves, 5, 4), false);
});

test("hai Tướng đối mặt tạo chiếu và quân chắn không được rời cột", () => {
  const board = emptyBoard();
  board[0][4] = piece("K", BLACK);
  board[9][4] = piece("K", RED);
  assert.equal(isInCheck(board, RED), true);
  assert.equal(isInCheck(board, BLACK), true);

  board[5][4] = piece("R", RED);
  assert.equal(isInCheck(board, RED), false);
  const legal = generateLegalMovesForPiece(board, 5, 4);
  assert.equal(legal.some((move) => move.toCol !== 4), false);
});

test("nước đi không được để Tướng nhà trong vùng tấn công", () => {
  const board = emptyBoard();
  board[0][3] = piece("K", BLACK);
  board[9][4] = piece("K", RED);
  board[7][4] = piece("R", RED);
  board[5][4] = piece("R", BLACK);
  const legal = generateLegalMovesForPiece(board, 7, 4);
  assert.equal(hasTarget(legal, 5, 4), true, "được phép ăn quân tấn công trên cùng cột");
  assert.equal(hasTarget(legal, 7, 3), false, "không được rời cột làm lộ Tướng");
});

test("không còn nước đi là thua, kể cả khi không bị chiếu", () => {
  const board = emptyBoard();
  board[0][4] = piece("K", BLACK);
  board[9][4] = piece("K", RED);
  board[1][3] = piece("R", RED);
  board[2][5] = piece("R", RED);
  board[5][4] = piece("P", RED);
  const status = getGameStatus(board, BLACK);
  assert.equal(status.over, true);
  assert.equal(status.winner, RED);
});

test("khóa trạng thái phân biệt bên tới lượt", () => {
  const board = createInitialBoard();
  assert.notEqual(boardKey(board, RED), boardKey(board, BLACK));
  const before = boardKey(board, RED);
  const move = generateLegalMoves(board, RED)[0];
  makeMove(board, move);
  assert.notEqual(boardKey(board, BLACK), before);
});
