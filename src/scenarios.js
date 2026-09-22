import { BLACK, RED, createInitialBoard } from "./engine.js";

function emptyBoard() {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function place(board, row, col, type, color) {
  board[row][col] = { type, color };
}

function tacticalBoard(attacker, finished) {
  const board = emptyBoard();
  place(board, 0, 4, "K", BLACK);
  place(board, 9, 4, "K", RED);
  if (attacker === RED) {
    place(board, finished ? 1 : 2, 4, "R", RED);
    place(board, 1, 3, "R", RED);
    place(board, 1, 5, "P", RED);
    if (!finished) place(board, 1, 4, "P", BLACK);
  } else {
    place(board, finished ? 8 : 7, 4, "R", BLACK);
    place(board, 8, 3, "R", BLACK);
    place(board, 8, 5, "P", BLACK);
    if (!finished) place(board, 8, 4, "P", RED);
  }
  return board;
}

export const SCENARIOS = [
  {
    id: "initial",
    label: "Bàn cờ ban đầu",
    description: "Khai cuộc tiêu chuẩn, Đỏ đi trước.",
    expectedWinner: null,
    turn: RED,
    createBoard: createInitialBoard,
  },
  {
    id: "red_mate_one",
    label: "Đỏ thắng trong 1 nước",
    description: "Đỏ ăn Tốt chắn cột giữa bằng Xe để chiếu bí.",
    expectedWinner: RED,
    turn: RED,
    createBoard: () => tacticalBoard(RED, false),
  },
  {
    id: "black_mate_one",
    label: "Đen thắng trong 1 nước",
    description: "Đen ăn Tốt chắn cột giữa bằng Xe để chiếu bí.",
    expectedWinner: BLACK,
    turn: BLACK,
    createBoard: () => tacticalBoard(BLACK, false),
  },
  {
    id: "red_won",
    label: "Thế cờ: Đỏ đã thắng",
    description: "Đen đang bị chiếu bí, không còn nước hợp lệ.",
    expectedWinner: RED,
    turn: BLACK,
    createBoard: () => tacticalBoard(RED, true),
  },
  {
    id: "black_won",
    label: "Thế cờ: Đen đã thắng",
    description: "Đỏ đang bị chiếu bí, không còn nước hợp lệ.",
    expectedWinner: BLACK,
    turn: RED,
    createBoard: () => tacticalBoard(BLACK, true),
  },
];

export function getScenario(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}
