import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, RED, createInitialBoard, generateLegalMoves, makeMove, opposite } from "../src/engine.js";
import { evaluateBoard, findBestMove } from "../src/ai.js";

function emptyBoard() {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

test("lượng giá đối xứng theo góc nhìn hai bên", () => {
  const board = createInitialBoard();
  assert.equal(evaluateBoard(board, RED), -evaluateBoard(board, BLACK));
});

test("AI tìm thấy nước bắt Tướng ngay lập tức", () => {
  const board = emptyBoard();
  board[0][4] = { type: "K", color: BLACK };
  board[1][4] = { type: "R", color: RED };
  board[9][4] = { type: "K", color: RED };
  const result = findBestMove(board, RED, { level: "hard", maxDepth: 2, timeMs: 1000 });
  assert.deepEqual(
    { fromRow: result.move.fromRow, fromCol: result.move.fromCol, toRow: result.move.toRow, toCol: result.move.toCol },
    { fromRow: 1, fromCol: 4, toRow: 0, toCol: 4 },
  );
  makeMove(board, result.move);
  assert.equal(board[0][4].type, "R");
});

test("AI trả về thống kê và một nước hợp lệ ở thế khai cuộc", () => {
  const result = findBestMove(createInitialBoard(), RED, { level: "easy", maxDepth: 1, timeMs: 1000 });
  assert.ok(result.move);
  assert.ok(result.nodes > 0);
  assert.equal(result.depth, 1);
  assert.ok(result.timeMs >= 0);
});

test("đường đi dự kiến gồm các nước hợp lệ liên tiếp", () => {
  const board = createInitialBoard();
  const result = findBestMove(board, RED, { level: "hard", maxDepth: 3, timeMs: 4000 });
  assert.equal(result.depth, 3);
  assert.ok(result.pv.length >= 2);
  let color = RED;
  for (const step of result.pv) {
    assert.equal(step.color, color);
    assert.equal(board[step.move.fromRow][step.move.fromCol].type, step.piece.type);
    assert.ok(generateLegalMoves(board, color).some((move) =>
      move.fromRow === step.move.fromRow && move.fromCol === step.move.fromCol &&
      move.toRow === step.move.toRow && move.toCol === step.move.toCol));
    makeMove(board, step.move);
    color = opposite(color);
  }
});
