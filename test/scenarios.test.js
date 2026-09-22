import test from "node:test";
import assert from "node:assert/strict";
import { getScenario, SCENARIOS } from "../src/scenarios.js";
import { getGameStatus, makeMove, opposite } from "../src/engine.js";
import { findBestMove } from "../src/ai.js";

test("các thế cờ thắng/thua có kết quả xác định", () => {
  for (const id of ["red_won", "black_won"]) {
    const scenario = getScenario(id);
    const status = getGameStatus(scenario.createBoard(), scenario.turn);
    assert.equal(status.over, true);
    assert.equal(status.winner, scenario.expectedWinner);
    assert.equal(status.reason, "Chiếu bí");
  }
});

test("AI tìm đúng nước chiếu bí một nước cho cả Đỏ và Đen", () => {
  for (const id of ["red_mate_one", "black_mate_one"]) {
    const scenario = getScenario(id);
    const board = scenario.createBoard();
    assert.equal(getGameStatus(board, scenario.turn).over, false);
    const result = findBestMove(board, scenario.turn, { level: "hard", maxDepth: 2, timeMs: 1000 });
    assert.ok(result.move);
    assert.equal(result.pv.length >= 1, true);
    assert.deepEqual(result.pv[0].move, result.move);
    makeMove(board, result.move);
    const after = getGameStatus(board, opposite(scenario.turn));
    assert.equal(after.over, true);
    assert.equal(after.winner, scenario.expectedWinner);
  }
});

test("mỗi lần nạp thế cờ nhận bàn cờ mới, không rò trạng thái", () => {
  assert.equal(SCENARIOS.length >= 5, true);
  const scenario = getScenario("red_mate_one");
  const first = scenario.createBoard();
  first[2][4] = null;
  const second = scenario.createBoard();
  assert.equal(second[2][4].type, "R");
});
