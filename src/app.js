import {
  BLACK,
  RED,
  cloneBoard,
  formatMove,
  generateLegalMovesForPiece,
  getGameStatus,
  makeMove,
  opposite,
  boardKey,
  findKing,
} from "./engine.js";
import { createSoundManager } from "./sound.js";
import { getScenario } from "./scenarios.js";

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const sound = createSoundManager();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const LOGICAL_WIDTH = 720;
const LOGICAL_HEIGHT = 800;
const MARGIN_X = 56;
const MARGIN_Y = 58;
const GAP_X = (LOGICAL_WIDTH - MARGIN_X * 2) / 8;
const GAP_Y = (LOGICAL_HEIGHT - MARGIN_Y * 2) / 9;

const GLYPHS = {
  red: { K: "帥", A: "仕", E: "相", H: "馬", R: "車", C: "炮", P: "兵" },
  black: { K: "將", A: "士", E: "象", H: "馬", R: "車", C: "砲", P: "卒" },
};

const els = {
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  sideButtons: [...document.querySelectorAll("[data-side]")],
  difficulty: document.querySelector("#difficulty"),
  difficultyField: document.querySelector("#difficultyField"),
  sideField: document.querySelector("#sideField"),
  newGame: document.querySelector("#newGame"),
  undo: document.querySelector("#undoBtn"),
  hint: document.querySelector("#hintBtn"),
  flip: document.querySelector("#flipBtn"),
  scenarioSelect: document.querySelector("#scenarioSelect"),
  scenarioDescription: document.querySelector("#scenarioDescription"),
  loadScenario: document.querySelector("#loadScenario"),
  soundToggle: document.querySelector("#soundToggle"),
  soundLabel: document.querySelector("#soundLabel"),
  boardFrame: document.querySelector("#boardFrame"),
  ceremony: document.querySelector("#startCeremony"),
  ceremonyKicker: document.querySelector("#ceremonyKicker"),
  ceremonyTitle: document.querySelector("#ceremonyTitle"),
  ceremonySubtitle: document.querySelector("#ceremonySubtitle"),
  thinkingStatus: document.querySelector("#thinkingStatus"),
  thinkingText: document.querySelector("#thinkingText"),
  resultBackdrop: document.querySelector("#resultBackdrop"),
  resultPanel: document.querySelector(".result-panel"),
  resultGlyph: document.querySelector("#resultGlyph"),
  resultKicker: document.querySelector("#resultKicker"),
  resultTitle: document.querySelector("#resultTitle"),
  resultReason: document.querySelector("#resultReason"),
  resultMoves: document.querySelector("#resultMoves"),
  closeResult: document.querySelector("#closeResult"),
  review: document.querySelector("#reviewBtn"),
  rematch: document.querySelector("#rematchBtn"),
  statusCard: document.querySelector("#statusCard"),
  statusIcon: document.querySelector("#statusIcon"),
  statusLabel: document.querySelector("#statusLabel"),
  statusText: document.querySelector("#statusText"),
  redStrip: document.querySelector("#redStrip"),
  blackStrip: document.querySelector("#blackStrip"),
  redTurn: document.querySelector("#redTurn"),
  blackTurn: document.querySelector("#blackTurn"),
  redName: document.querySelector("#redName"),
  blackName: document.querySelector("#blackName"),
  moveList: document.querySelector("#moveList"),
  moveCount: document.querySelector("#moveCount"),
  depth: document.querySelector("#metricDepth"),
  nodes: document.querySelector("#metricNodes"),
  time: document.querySelector("#metricTime"),
  analysisPanel: document.querySelector("#analysisPanel"),
  analysisBest: document.querySelector("#analysisBest"),
  analysisScore: document.querySelector("#analysisScore"),
  analysisLine: document.querySelector("#analysisLine"),
  toast: document.querySelector("#toast"),
};

let board;
let turn;
let selected;
let legalTargets;
let lastMove;
let hintMove;
let moveLog;
let history;
let positionKeys;
let gameOver;
let drawReason;
let mode = "pve";
let humanColor = RED;
let flipped = false;
let thinking = false;
let worker;
let requestSequence = 0;
let pendingRequest = null;
let toastTimer;
let ceremonyTimer;
let aiTimer;
let resultTimer;
let arenaTimer;
let animationFrame;
let effectFrame;
let animationToken = 0;
let effectToken = 0;
let animation = null;
let impacts = [];
let effectLoopRunning = false;
let animating = false;
let ceremonyActive = false;
let resultShown = false;

function createWorker() {
  worker?.terminate();
  worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", () => {
    setThinking(false);
    showToast("AI gặp lỗi. Hãy tạo ván mới và thử lại.");
  });
}

function hideResult() {
  resultShown = false;
  els.resultBackdrop.hidden = true;
  document.body.classList.remove("result-open");
}

function cancelPresentation() {
  animationToken += 1;
  window.cancelAnimationFrame(animationFrame);
  window.clearTimeout(ceremonyTimer);
  window.clearTimeout(aiTimer);
  window.clearTimeout(resultTimer);
  window.clearTimeout(arenaTimer);
  window.cancelAnimationFrame(effectFrame);
  effectToken += 1;
  effectLoopRunning = false;
  impacts = [];
  animation = null;
  animating = false;
  ceremonyActive = false;
  els.ceremony.hidden = true;
  els.boardFrame.classList.remove("board-entering");
  els.boardFrame.classList.remove("arena-impact", "arena-check", "arena-finale");
  hideResult();
}

function pulseArena(kind, color) {
  if (reducedMotion.matches || document.visibilityState === "hidden") return;
  window.clearTimeout(arenaTimer);
  els.boardFrame.classList.remove("arena-impact", "arena-check", "arena-finale");
  els.boardFrame.dataset.energy = color;
  // Restart the short border reaction even when two events happen close together.
  void els.boardFrame.offsetWidth;
  els.boardFrame.classList.add(`arena-${kind}`);
  arenaTimer = window.setTimeout(() => {
    els.boardFrame.classList.remove(`arena-${kind}`);
  }, kind === "finale" ? 1150 : 760);
}

function showCeremony() {
  ceremonyActive = true;
  els.ceremony.hidden = false;
  els.ceremony.classList.remove("ceremony-play");
  void els.ceremony.offsetWidth;
  els.ceremony.classList.add("ceremony-play");
  els.boardFrame.classList.add("board-entering");
  sound.play("start");
  ceremonyTimer = window.setTimeout(() => {
    els.ceremony.hidden = true;
    els.boardFrame.classList.remove("board-entering");
    ceremonyActive = false;
    renderStatus();
    const status = getGameStatus(board, turn);
    if (status.over) {
      resultTimer = window.setTimeout(() => showResult(status), reducedMotion.matches ? 0 : 350);
    } else if (mode === "pve" && turn !== humanColor) {
      aiTimer = window.setTimeout(requestAiMove, 220);
    }
  }, reducedMotion.matches ? 80 : 1800);
}

function showResult(status) {
  if (resultShown) return;
  resultShown = true;
  const drawn = Boolean(drawReason);
  const winner = status.winner;
  els.resultBackdrop.dataset.outcome = drawn ? "draw" : winner;
  els.resultGlyph.textContent = drawn ? "和" : GLYPHS[winner].K;
  els.resultKicker.textContent = drawn ? "BẤT PHÂN THẮNG BẠI" : "VÁN ĐẤU KẾT THÚC";
  els.resultTitle.textContent = drawn ? "Ván cờ hòa" : `${winner === RED ? "Đỏ" : "Đen"} chiến thắng`;
  els.resultReason.textContent = drawn ? drawReason : status.reason;
  els.resultMoves.textContent = `${moveLog.length} nước`;
  els.resultBackdrop.hidden = false;
  document.body.classList.add("result-open");
  els.resultPanel.focus();
  sound.play(drawn ? "draw" : "win");
}

function spawnImpact(row, col, kind, color) {
  if (reducedMotion.matches || document.visibilityState === "hidden") return;
  const count = kind === "finale" ? 52 : kind === "capture" ? 36 : kind === "check" ? 26 : 15;
  const seed = row * 37 + col * 19 + moveLog.length * 53;
  const particles = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (seed % 11) * 0.07;
    const speed = kind === "finale" ? 55 + (index * 23 % 115) : kind === "capture" ? 34 + (index * 17 % 55) : 21 + (index * 13 % 30);
    return {
      angle,
      speed,
      radius: index % 4 === 0 ? 4.1 : 2.1,
      delay: (index % 6) * 0.025,
      shard: index % 3 === 0,
      star: index % 7 === 0,
      spin: (index % 2 ? 1 : -1) * (2 + index % 4),
    };
  });
  impacts.push({ row, col, kind, color, created: performance.now(), duration: kind === "finale" ? 1080 : kind === "capture" ? 860 : 650, particles });
  if (effectLoopRunning) return;
  effectLoopRunning = true;
  const token = ++effectToken;
  function frame(now) {
    if (token !== effectToken) return;
    impacts = impacts.filter((impact) => now - impact.created < impact.duration);
    renderBoard();
    if (impacts.length) effectFrame = window.requestAnimationFrame(frame);
    else effectLoopRunning = false;
  }
  effectFrame = window.requestAnimationFrame(frame);
}

function animateMove(move, piece, captured, onComplete) {
  const landing = displayCoordinate(move.toRow, move.toCol);
  const pan = (landing.col - 4) * 0.13;
  const duration = reducedMotion.matches || document.visibilityState === "hidden"
    ? 0
    : Math.min(540, 270 + Math.hypot(move.toRow - move.fromRow, move.toCol - move.fromCol) * 38);
  if (!duration) {
    sound.play(captured ? "capture" : "move", { pan });
    onComplete();
    return;
  }
  animating = true;
  const token = ++animationToken;
  const started = performance.now();
  animation = { move, piece: { ...piece }, captured: captured ? { ...captured } : null, progress: 0 };
  sound.play(captured ? "captureStart" : "moveStart", { pan });
  renderBoard();
  renderStatus();

  function frame(now) {
    if (token !== animationToken) return;
    animation.progress = Math.min(1, (now - started) / duration);
    renderBoard();
    if (animation.progress < 1) {
      animationFrame = window.requestAnimationFrame(frame);
      return;
    }
    animation = null;
    animating = false;
    renderBoard();
    renderStatus();
    sound.play(captured ? "capture" : "move", { pan });
    spawnImpact(move.toRow, move.toCol, captured ? "capture" : "move", piece.color);
    if (captured) pulseArena("impact", piece.color);
    onComplete();
  }
  animationFrame = window.requestAnimationFrame(frame);
}

function finishMove() {
  const status = getGameStatus(board, turn);
  renderStatus();
  if (drawReason || status.over) {
    gameOver = true;
    renderStatus();
    if (!drawReason && status.winner && lastMove) {
      spawnImpact(lastMove.toRow, lastMove.toCol, "finale", status.winner);
      pulseArena("finale", status.winner);
      if (!reducedMotion.matches) sound.play("finisher");
    }
    resultTimer = window.setTimeout(() => showResult(status), reducedMotion.matches ? 0 : status.winner ? 950 : 420);
  } else {
    if (status.inCheck) {
      const king = findKing(board, turn);
      if (king) spawnImpact(king.row, king.col, "check", turn);
      pulseArena("check", opposite(turn));
      sound.play("check");
    }
    if (mode === "pve" && turn !== humanColor) {
      aiTimer = window.setTimeout(requestAiMove, reducedMotion.matches ? 120 : 320);
    }
  }
}

function resetGame(scenario = getScenario("initial")) {
  requestSequence += 1;
  pendingRequest = null;
  cancelPresentation();
  createWorker();
  board = scenario.createBoard();
  turn = scenario.turn;
  els.scenarioSelect.value = scenario.id;
  els.scenarioDescription.textContent = scenario.description;
  selected = null;
  legalTargets = [];
  lastMove = null;
  hintMove = null;
  moveLog = [];
  history = [];
  positionKeys = [boardKey(board, turn)];
  gameOver = getGameStatus(board, turn).over;
  drawReason = "";
  els.analysisPanel.hidden = true;
  els.ceremonyKicker.textContent = scenario.id === "initial" ? "VÁN CỜ BẮT ĐẦU" : "THẾ CỜ KIỂM THỬ";
  els.ceremonyTitle.textContent = scenario.id === "initial" ? "Sẵn sàng khai cuộc" : scenario.label;
  els.ceremonySubtitle.textContent = scenario.description;
  setThinking(false);
  els.depth.textContent = "—";
  els.nodes.textContent = "—";
  els.time.textContent = "—";
  updateNames();
  renderAll();
  showCeremony();
  renderStatus();
}

function snapshot(movedColor) {
  return {
    board: cloneBoard(board),
    turn,
    lastMove: lastMove ? { ...lastMove } : null,
    moveLog: moveLog.map((item) => ({ ...item, move: { ...item.move } })),
    positionKeys: [...positionKeys],
    movedColor,
  };
}

function playMove(move, actor = "human") {
  if (gameOver || animating || ceremonyActive) return;
  const piece = board[move.fromRow][move.fromCol];
  const captured = board[move.toRow][move.toCol];
  history.push(snapshot(piece.color));
  const notation = formatMove(move, piece);
  makeMove(board, move);
  lastMove = { ...move };
  hintMove = null;
  els.analysisPanel.hidden = true;
  moveLog.push({ move: { ...move }, color: piece.color, notation, actor });
  turn = opposite(turn);
  positionKeys.push(boardKey(board, turn));
  selected = null;
  legalTargets = [];

  const occurrences = positionKeys.filter((key) => key === positionKeys.at(-1)).length;
  if (occurrences >= 3) {
    gameOver = true;
    drawReason = "Hòa do lặp lại thế cờ 3 lần";
  } else if (moveLog.length >= 200) {
    gameOver = true;
    drawReason = "Hòa theo giới hạn 200 lượt của bản mô phỏng";
  }
  renderAll();
  animateMove(move, piece, captured, finishMove);
}

function requestAiMove() {
  if (gameOver || mode !== "pve" || turn === humanColor || thinking || animating || ceremonyActive) return;
  setThinking(true);
  const requestId = ++requestSequence;
  pendingRequest = { requestId, action: "move" };
  worker.postMessage({ board: cloneBoard(board), color: turn, level: els.difficulty.value, requestId });
}

function requestHint() {
  if (gameOver || thinking || animating || ceremonyActive || (mode === "pve" && turn !== humanColor)) return;
  sound.unlock();
  setThinking(true, true);
  const requestId = ++requestSequence;
  pendingRequest = { requestId, action: "hint" };
  worker.postMessage({ board: cloneBoard(board), color: turn, level: "hard", requestId });
}

function handleWorkerMessage(event) {
  const { requestId, result, error } = event.data;
  if (!pendingRequest || requestId !== pendingRequest.requestId) return;
  const action = pendingRequest.action;
  pendingRequest = null;
  setThinking(false);
  if (error) {
    showToast(`Lỗi AI: ${error}`);
    return;
  }
  updateMetrics(result);
  if (!result.move) {
    gameOver = true;
    renderAll();
    finishMove();
    return;
  }
  if (action === "hint") {
    hintMove = result.move;
    renderAnalysis(result);
    renderBoard();
    showToast(`Gợi ý: ${formatMove(result.move, board[result.move.fromRow][result.move.fromCol])}`);
  } else {
    playMove(result.move, "ai");
  }
}

function renderAnalysis(result) {
  const piece = board[result.move.fromRow][result.move.fromCol];
  els.analysisBest.textContent = formatMove(result.move, piece);
  els.analysisScore.textContent = Math.abs(result.score) > 9_000_000
    ? (result.score > 0 ? "Thế thắng quyết định" : "Nguy cơ thua quyết định")
    : `Đánh giá ${result.score >= 0 ? "+" : ""}${(result.score / 100).toFixed(2)} tốt`;
  const line = result.pv?.length ? result.pv : [{ move: result.move, piece, color: turn }];
  els.analysisLine.innerHTML = line.map((step) => `<li><span>${step.color === RED ? "Đỏ" : "Đen"}</span><strong>${formatMove(step.move, step.piece)}</strong></li>`).join("");
  els.analysisPanel.hidden = false;
}

function updateMetrics(result) {
  els.depth.textContent = result.depth || "1*";
  els.nodes.textContent = Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(result.nodes);
  els.time.textContent = `${(result.timeMs / 1000).toFixed(result.timeMs < 1000 ? 2 : 1)}s`;
}

function setThinking(value, isHint = false) {
  thinking = value;
  els.thinkingStatus.classList.toggle("active", value);
  els.thinkingStatus.setAttribute("aria-hidden", String(!value));
  els.thinkingText.textContent = isHint ? "AI đang tìm nước tốt nhất · duyệt cây nước đi" : "AI đang suy nghĩ · duyệt cây nước đi";
  els.hint.disabled = value || gameOver;
  els.undo.disabled = history.length === 0 || value || animating || ceremonyActive;
  if (board) renderStatus();
}

function undoHumanTurn() {
  if (animating || ceremonyActive || thinking) return;
  let targetIndex;
  if (mode === "pve") {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].movedColor === humanColor) {
        targetIndex = index;
        break;
      }
    }
  } else if (history.length) {
    targetIndex = history.length - 1;
  }
  if (targetIndex === undefined) {
    showToast("Chưa có nước của người chơi để hoàn tác.");
    return;
  }
  requestSequence += 1;
  pendingRequest = null;
  cancelPresentation();
  createWorker();
  const state = history[targetIndex];
  board = cloneBoard(state.board);
  turn = state.turn;
  lastMove = state.lastMove;
  moveLog = state.moveLog;
  positionKeys = state.positionKeys;
  history = history.slice(0, targetIndex);
  selected = null;
  legalTargets = [];
  hintMove = null;
  els.analysisPanel.hidden = true;
  gameOver = false;
  drawReason = "";
  setThinking(false);
  renderAll();
}

function handleBoardPointer(event) {
  if (thinking || animating || ceremonyActive || gameOver || (mode === "pve" && turn !== humanColor)) return;
  sound.unlock();
  const rect = canvas.getBoundingClientRect();
  const logicalX = ((event.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
  const logicalY = ((event.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
  let col = Math.round((logicalX - MARGIN_X) / GAP_X);
  let row = Math.round((logicalY - MARGIN_Y) / GAP_Y);
  if (flipped) {
    row = 9 - row;
    col = 8 - col;
  }
  if (row < 0 || row > 9 || col < 0 || col > 8) return;

  const targetMove = legalTargets.find((move) => move.toRow === row && move.toCol === col);
  if (selected && targetMove) {
    playMove(targetMove);
    return;
  }
  const piece = board[row][col];
  if (piece?.color === turn) {
    selected = { row, col };
    legalTargets = generateLegalMovesForPiece(board, row, col);
    hintMove = null;
    sound.play("select");
  } else {
    selected = null;
    legalTargets = [];
  }
  renderBoard();
}

function displayCoordinate(row, col) {
  return flipped ? { row: 9 - row, col: 8 - col } : { row, col };
}

function drawBoardSurface() {
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  gradient.addColorStop(0, "#dfbd80");
  gradient.addColorStop(0.5, "#cda567");
  gradient.addColorStop(1, "#b98e55");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#3f2514";
  for (let y = 10; y < LOGICAL_HEIGHT; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 2);
    ctx.bezierCurveTo(190, y - 3, 490, y + 5, LOGICAL_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#4c2e1b";
  ctx.lineWidth = 2;
  ctx.strokeRect(MARGIN_X, MARGIN_Y, GAP_X * 8, GAP_Y * 9);
  for (let row = 0; row < 10; row += 1) {
    const y = MARGIN_Y + row * GAP_Y;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, y);
    ctx.lineTo(MARGIN_X + GAP_X * 8, y);
    ctx.stroke();
  }
  for (let col = 0; col < 9; col += 1) {
    const x = MARGIN_X + col * GAP_X;
    ctx.beginPath();
    ctx.moveTo(x, MARGIN_Y);
    ctx.lineTo(x, MARGIN_Y + GAP_Y * 4);
    ctx.moveTo(x, MARGIN_Y + GAP_Y * 5);
    ctx.lineTo(x, MARGIN_Y + GAP_Y * 9);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + GAP_X * 3, MARGIN_Y);
  ctx.lineTo(MARGIN_X + GAP_X * 5, MARGIN_Y + GAP_Y * 2);
  ctx.moveTo(MARGIN_X + GAP_X * 5, MARGIN_Y);
  ctx.lineTo(MARGIN_X + GAP_X * 3, MARGIN_Y + GAP_Y * 2);
  ctx.moveTo(MARGIN_X + GAP_X * 3, MARGIN_Y + GAP_Y * 7);
  ctx.lineTo(MARGIN_X + GAP_X * 5, MARGIN_Y + GAP_Y * 9);
  ctx.moveTo(MARGIN_X + GAP_X * 5, MARGIN_Y + GAP_Y * 7);
  ctx.lineTo(MARGIN_X + GAP_X * 3, MARGIN_Y + GAP_Y * 9);
  ctx.stroke();

  ctx.fillStyle = "rgba(64,35,20,.82)";
  ctx.font = '600 27px "Noto Serif", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(flipped ? "漢 界" : "楚 河", MARGIN_X + GAP_X * 2, MARGIN_Y + GAP_Y * 4.5);
  ctx.fillText(flipped ? "楚 河" : "漢 界", MARGIN_X + GAP_X * 6, MARGIN_Y + GAP_Y * 4.5);

  drawPositionMarks();
}

function drawPositionMarks() {
  const locations = [[2,1],[2,7],[3,0],[3,2],[3,4],[3,6],[3,8],[6,0],[6,2],[6,4],[6,6],[6,8],[7,1],[7,7]];
  ctx.strokeStyle = "rgba(76,46,27,.75)";
  ctx.lineWidth = 1.4;
  for (const [rawRow, rawCol] of locations) {
    const { row, col } = displayCoordinate(rawRow, rawCol);
    const x = MARGIN_X + col * GAP_X;
    const y = MARGIN_Y + row * GAP_Y;
    for (const side of [-1, 1]) {
      if ((side === -1 && col === 0) || (side === 1 && col === 8)) continue;
      ctx.beginPath();
      ctx.moveTo(x + side * 7, y - 4);
      ctx.lineTo(x + side * 7, y - 10);
      ctx.lineTo(x + side * 14, y - 10);
      ctx.moveTo(x + side * 7, y + 4);
      ctx.lineTo(x + side * 7, y + 10);
      ctx.lineTo(x + side * 14, y + 10);
      ctx.stroke();
    }
  }
}

function drawMoveMarker(move, color) {
  if (!move) return;
  const from = displayCoordinate(move.fromRow, move.fromCol);
  const to = displayCoordinate(move.toRow, move.toCol);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const point of [from, to]) {
    const x = MARGIN_X + point.col * GAP_X;
    const y = MARGIN_Y + point.row * GAP_Y;
    ctx.beginPath();
    ctx.arc(x, y, 31, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHintArrow(move) {
  if (!move) return;
  const from = displayCoordinate(move.fromRow, move.fromCol);
  const to = displayCoordinate(move.toRow, move.toCol);
  const sx = MARGIN_X + from.col * GAP_X;
  const sy = MARGIN_Y + from.row * GAP_Y;
  const tx = MARGIN_X + to.col * GAP_X;
  const ty = MARGIN_Y + to.row * GAP_Y;
  const angle = Math.atan2(ty - sy, tx - sx);
  const x1 = sx + Math.cos(angle) * 33;
  const y1 = sy + Math.sin(angle) * 33;
  const x2 = tx - Math.cos(angle) * 36;
  const y2 = ty - Math.sin(angle) * 36;
  ctx.save();
  ctx.strokeStyle = "rgba(34,104,67,.92)";
  ctx.fillStyle = "rgba(34,104,67,.92)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(146,239,165,.75)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(angle) * 14, y2 + Math.sin(angle) * 14);
  ctx.lineTo(x2 + Math.cos(angle + 2.45) * 10, y2 + Math.sin(angle + 2.45) * 10);
  ctx.lineTo(x2 + Math.cos(angle - 2.45) * 10, y2 + Math.sin(angle - 2.45) * 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArcaneSeal(x, y, tint, phase, opacity, radius = 42) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(phase * 0.45);
  ctx.strokeStyle = `rgba(${tint},${opacity})`;
  ctx.fillStyle = `rgba(${tint},${opacity * 0.8})`;
  ctx.shadowColor = `rgba(${tint},${opacity * 0.8})`;
  ctx.shadowBlur = 13;
  ctx.lineWidth = 1.8;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, angle + 0.12, angle + 0.61);
    ctx.stroke();
    const inner = radius - 9;
    const outer = radius - 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.rotate(-phase * 0.9);
  for (let index = 0; index < 4; index += 1) {
    const angle = (index * Math.PI) / 2;
    const dx = Math.cos(angle) * (radius + 8);
    const dy = Math.sin(angle) * (radius + 8);
    ctx.beginPath();
    ctx.moveTo(dx, dy - 4);
    ctx.lineTo(dx + 3, dy);
    ctx.lineTo(dx, dy + 4);
    ctx.lineTo(dx - 3, dy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTravelTrail(move, piece, x, y, progress, captured) {
  const from = displayCoordinate(move.fromRow, move.fromCol);
  const sx = MARGIN_X + from.col * GAP_X;
  const sy = MARGIN_Y + from.row * GAP_Y;
  const color = piece.color === RED ? "221,85,65" : "94,115,100";
  ctx.save();
  const trail = ctx.createLinearGradient(sx, sy, x, y);
  trail.addColorStop(0, `rgba(${color},0)`);
  trail.addColorStop(0.65, `rgba(${color},.34)`);
  trail.addColorStop(1, `rgba(${color},.65)`);
  ctx.strokeStyle = trail;
  ctx.lineWidth = 4 + Math.sin(progress * Math.PI) * 4;
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(${color},.5)`;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + x) / 2, (sy + y) / 2 - 13, x, y);
  ctx.stroke();
  if (captured) {
    ctx.shadowColor = "rgba(244,198,112,.72)";
    ctx.shadowBlur = 17;
    for (const offset of [-13, 13]) {
      ctx.strokeStyle = `rgba(240,190,103,${0.25 * Math.sin(progress * Math.PI)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + x) / 2 + offset, (sy + y) / 2 - 21, x, y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  for (let i = 3; i >= 1; i -= 1) {
    const lag = Math.min(progress, i * 0.045);
    const ghostProgress = Math.max(0, progress - lag);
    const ghostEase = 1 - Math.pow(1 - ghostProgress, 3);
    const to = displayCoordinate(move.toRow, move.toCol);
    const gx = sx + (to.col - from.col) * GAP_X * ghostEase;
    const gy = sy + (to.row - from.row) * GAP_Y * ghostEase - Math.sin(ghostProgress * Math.PI) * 16;
    ctx.fillStyle = `rgba(${color},${0.09 * (4 - i) * (1 - progress * 0.55)})`;
    ctx.beginPath();
    ctx.arc(gx, gy, 16 - i * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4;
    const px = sx + (x - sx) * t;
    const py = sy + (y - sy) * t - Math.sin(t * Math.PI) * 10;
    ctx.fillStyle = `rgba(${color},${0.12 * i})`;
    ctx.beginPath();
    ctx.arc(px, py, 2 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawImpacts() {
  const now = performance.now();
  for (const impact of impacts) {
    const progress = Math.min(1, Math.max(0, (now - impact.created) / impact.duration));
    const point = displayCoordinate(impact.row, impact.col);
    const x = MARGIN_X + point.col * GAP_X;
    const y = MARGIN_Y + point.row * GAP_Y;
    const finale = impact.kind === "finale";
    const capture = impact.kind === "capture" || finale;
    const check = impact.kind === "check";
    const color = check || finale ? "223,184,99" : capture ? impact.color === RED ? "226,102,70" : "111,181,152" : "136,98,54";
    ctx.save();
    if (capture || check) {
      drawArcaneSeal(x, y, color, progress * (finale ? 5 : 3), (1 - progress) * (finale ? 0.92 : 0.7), 41 + progress * (finale ? 80 : 42));
    }
    const burst = Math.max(0, 1 - progress * 3.5);
    if (burst > 0) {
      const haze = ctx.createRadialGradient(x, y, 5, x, y, capture ? 85 : 58);
      haze.addColorStop(0, `rgba(${color},${burst * (capture ? 0.25 : 0.14)})`);
      haze.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(x, y, capture ? 85 : 58, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = capture ? 3.7 : 2.5;
    ctx.strokeStyle = `rgba(${color},${(1 - progress) * (capture ? 0.78 : 0.5)})`;
    ctx.shadowColor = `rgba(${color},.46)`;
    ctx.shadowBlur = capture ? 13 : 7;
    for (let ring = 0; ring < (capture ? 3 : 2); ring += 1) {
      const ringProgress = Math.max(0, progress - ring * 0.13);
      ctx.globalAlpha = ringProgress === 0 && ring > 0 ? 0 : Math.max(0, 1 - ringProgress * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, 28 + ringProgress * (capture ? 63 : 40), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    for (const particle of impact.particles) {
      const t = (progress - particle.delay) / (1 - particle.delay);
      if (t < 0 || t > 1) continue;
      const travel = Math.sin(Math.min(t, 1) * Math.PI / 2) * particle.speed;
      const px = x + Math.cos(particle.angle) * travel;
      const py = y + Math.sin(particle.angle) * travel + t * t * (capture ? 22 : 11);
      ctx.fillStyle = `rgba(${particle.star ? "255,224,158" : color},${(1 - t) * (capture ? 0.9 : 0.68)})`;
      ctx.beginPath();
      if (particle.star) {
        const size = particle.radius * (2.8 - t * 1.5);
        ctx.moveTo(px, py - size);
        ctx.lineTo(px + size * 0.22, py - size * 0.22);
        ctx.lineTo(px + size, py);
        ctx.lineTo(px + size * 0.22, py + size * 0.22);
        ctx.lineTo(px, py + size);
        ctx.lineTo(px - size * 0.22, py + size * 0.22);
        ctx.lineTo(px - size, py);
        ctx.lineTo(px - size * 0.22, py - size * 0.22);
        ctx.closePath();
      } else if (particle.shard) {
        const direction = particle.angle + t * particle.spin;
        const length = particle.radius * (2.5 - t);
        ctx.moveTo(px + Math.cos(direction) * length, py + Math.sin(direction) * length);
        ctx.lineTo(px + Math.cos(direction + 2.4) * particle.radius, py + Math.sin(direction + 2.4) * particle.radius);
        ctx.lineTo(px + Math.cos(direction - 2.4) * particle.radius, py + Math.sin(direction - 2.4) * particle.radius);
        ctx.closePath();
      } else {
        ctx.arc(px, py, particle.radius * (1 - t * 0.45), 0, Math.PI * 2);
      }
      ctx.fill();
    }
    if (capture && progress < 0.34) {
      ctx.strokeStyle = `rgba(238,184,105,${(1 - progress / 0.34) * 0.72})`;
      ctx.lineWidth = 1.6;
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = ray * Math.PI / 4 + 0.2;
        const inner = 35 + progress * 85;
        const outer = inner + 13 * (1 - progress);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    }
    if ((capture && !finale) || check) {
      ctx.fillStyle = `rgba(${color},${Math.sin(progress * Math.PI) * 0.92})`;
      ctx.shadowColor = `rgba(${color},.35)`;
      ctx.shadowBlur = 8;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '700 17px "Noto Serif", serif';
      ctx.fillText(check ? "CHIẾU!" : "ĂN QUÂN", x, Math.max(17, y - 54 - progress * 16));
    }
    ctx.restore();
  }
}

function drawPiece(piece, rawRow, rawCol, effects = {}) {
  const { row, col } = displayCoordinate(rawRow, rawCol);
  const x = effects.x ?? MARGIN_X + col * GAP_X;
  const y = effects.y ?? MARGIN_Y + row * GAP_Y;
  const radius = Math.min(GAP_X, GAP_Y) * 0.39;
  ctx.save();
  ctx.globalAlpha = effects.alpha ?? 1;
  if (effects.scale || effects.rotation) {
    ctx.translate(x, y);
    if (effects.rotation) ctx.rotate(effects.rotation);
    if (effects.scale) ctx.scale(effects.scale, effects.scale);
    ctx.translate(-x, -y);
  }
  ctx.shadowColor = "rgba(48,28,16,.42)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  const fill = ctx.createRadialGradient(x - 8, y - 9, 2, x, y, radius);
  if (piece.color === RED) {
    fill.addColorStop(0, "#f4d99e");
    fill.addColorStop(1, "#c69a5b");
  } else {
    fill.addColorStop(0, "#e0c78e");
    fill.addColorStop(1, "#a98654");
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = piece.color === RED ? "#9d302a" : "#29312c";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius - 5, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = piece.color === RED ? "#aa302b" : "#232c27";
  ctx.font = `700 ${Math.round(radius * 1.15)}px "Noto Serif", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(GLYPHS[piece.color][piece.type], x, y + 1);
  ctx.restore();
}

function renderBoard() {
  drawBoardSurface();
  drawMoveMarker(lastMove, "rgba(252,225,149,.72)");
  drawHintArrow(hintMove);
  if (animation) {
    const point = displayCoordinate(animation.move.toRow, animation.move.toCol);
    const tint = animation.piece.color === RED ? "229,156,97" : "129,190,158";
    drawArcaneSeal(MARGIN_X + point.col * GAP_X, MARGIN_Y + point.row * GAP_Y,
      tint, animation.progress * 2.4, (0.18 + Math.sin(animation.progress * Math.PI) * 0.43),
      animation.captured ? 52 : 43);
  }

  if (selected) {
    const point = displayCoordinate(selected.row, selected.col);
    ctx.fillStyle = "rgba(245,211,125,.22)";
    ctx.beginPath();
    ctx.arc(MARGIN_X + point.col * GAP_X, MARGIN_Y + point.row * GAP_Y, 35, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const move of legalTargets) {
    const point = displayCoordinate(move.toRow, move.toCol);
    const x = MARGIN_X + point.col * GAP_X;
    const y = MARGIN_Y + point.row * GAP_Y;
    if (board[move.toRow][move.toCol]) {
      ctx.strokeStyle = "rgba(184,50,42,.82)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(70,69,48,.65)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (animation && row === animation.move.toRow && col === animation.move.toCol) continue;
      if (board[row][col]) drawPiece(board[row][col], row, col);
    }
  }
  if (animation) {
    const { move, piece, captured, progress } = animation;
    const from = displayCoordinate(move.fromRow, move.fromCol);
    const to = displayCoordinate(move.toRow, move.toCol);
    const ease = 1 - Math.pow(1 - progress, 3);
    const x = MARGIN_X + (from.col + (to.col - from.col) * ease) * GAP_X;
    const y = MARGIN_Y + (from.row + (to.row - from.row) * ease) * GAP_Y - Math.sin(progress * Math.PI) * 16;
    drawTravelTrail(move, piece, x, y, progress, captured);
    if (captured) {
      drawPiece(captured, move.toRow, move.toCol, {
        alpha: Math.max(0, 1 - progress * 1.5),
        scale: Math.max(0.65, 1 - progress * 0.3),
        rotation: progress * 0.25,
      });
    }
    drawPiece(piece, move.toRow, move.toCol, { x, y, scale: 1 + Math.sin(progress * Math.PI) * 0.09 });
  }
  drawImpacts();
}

function renderStatus() {
  const status = getGameStatus(board, turn);
  const colorName = turn === RED ? "Đỏ" : "Đen";
  const activeGlyph = GLYPHS[turn].K;
  els.redStrip.classList.toggle("active", !gameOver && turn === RED);
  els.blackStrip.classList.toggle("active", !gameOver && turn === BLACK);
  els.redTurn.textContent = !gameOver && turn === RED ? "LƯỢT ĐI" : "ĐANG ĐỢI";
  els.blackTurn.textContent = !gameOver && turn === BLACK ? "LƯỢT ĐI" : "ĐANG ĐỢI";
  els.statusIcon.textContent = activeGlyph;
  if (drawReason) {
    els.statusLabel.textContent = "VÁN ĐẤU KẾT THÚC";
    els.statusText.textContent = drawReason;
  } else if (status.over) {
    els.statusLabel.textContent = "VÁN ĐẤU KẾT THÚC";
    els.statusText.textContent = `${status.winner === RED ? "Đỏ" : "Đen"} thắng · ${status.reason}`;
  } else if (status.inCheck) {
    els.statusLabel.textContent = "ĐANG BỊ CHIẾU";
    els.statusText.textContent = `${colorName} phải hóa giải`;
  } else {
    els.statusLabel.textContent = thinking ? "AI ĐANG TÍNH" : "LƯỢT HIỆN TẠI";
    els.statusText.textContent = `${colorName} đi`;
  }
  els.undo.disabled = thinking || animating || ceremonyActive || history.length === 0;
  els.hint.disabled = thinking || animating || ceremonyActive || gameOver || (mode === "pve" && turn !== humanColor);
}

function renderMoveLog() {
  els.moveCount.textContent = `${moveLog.length} nước`;
  if (!moveLog.length) {
    els.moveList.innerHTML = '<li class="empty-moves">Chưa có nước đi nào.<br>Đỏ sẽ khai cuộc trước.</li>';
    return;
  }
  els.moveList.innerHTML = moveLog.map((item, index) => `
    <li>
      <span class="move-number">${index + 1}.</span>
      <span class="move-text"><i class="move-color ${item.color}"></i>${item.notation}</span>
      <span>${item.actor === "ai" ? "AI" : ""}</span>
    </li>`).join("");
  els.moveList.scrollTop = els.moveList.scrollHeight;
}

function renderAll() {
  renderBoard();
  renderStatus();
  renderMoveLog();
}

function updateNames() {
  if (mode === "pvp") {
    els.redName.textContent = "Người chơi 1";
    els.blackName.textContent = "Người chơi 2";
  } else {
    els.redName.textContent = humanColor === RED ? "Bạn" : "Kỳ Thủ AI";
    els.blackName.textContent = humanColor === BLACK ? "Bạn" : "Kỳ Thủ AI";
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function updateSoundButton() {
  const enabled = sound.isEnabled();
  els.soundToggle.setAttribute("aria-pressed", String(enabled));
  els.soundToggle.setAttribute("aria-label", enabled ? "Tắt âm thanh" : "Bật âm thanh");
  els.soundLabel.textContent = `Âm thanh: ${enabled ? "Bật" : "Tắt"}`;
  els.soundToggle.classList.toggle("muted", !enabled);
}

canvas.addEventListener("pointerup", handleBoardPointer);
els.soundToggle.addEventListener("click", () => {
  sound.setEnabled(!sound.isEnabled());
  updateSoundButton();
});
els.closeResult.addEventListener("click", () => { hideResult(); els.newGame.focus(); });
els.review.addEventListener("click", () => { hideResult(); els.newGame.focus(); });
els.rematch.addEventListener("click", () => { sound.unlock(); resetGame(); });
els.resultBackdrop.addEventListener("pointerup", (event) => {
  if (event.target === els.resultBackdrop) { hideResult(); els.newGame.focus(); }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resultShown) { hideResult(); els.newGame.focus(); }
  if (event.key !== "Tab" || !resultShown) return;
  const controls = [els.closeResult, els.rematch, els.review];
  const current = controls.indexOf(document.activeElement);
  if (event.shiftKey && (current <= 0)) {
    event.preventDefault();
    controls.at(-1).focus();
  } else if (!event.shiftKey && current === controls.length - 1) {
    event.preventDefault();
    controls[0].focus();
  }
});
els.newGame.addEventListener("click", () => { sound.unlock(); resetGame(); });
els.undo.addEventListener("click", undoHumanTurn);
els.hint.addEventListener("click", requestHint);
els.flip.addEventListener("click", () => { flipped = !flipped; renderBoard(); });
els.scenarioSelect.addEventListener("change", () => {
  els.scenarioDescription.textContent = getScenario(els.scenarioSelect.value).description;
});
els.loadScenario.addEventListener("click", () => {
  sound.unlock();
  resetGame(getScenario(els.scenarioSelect.value));
});
els.modeButtons.forEach((button) => button.addEventListener("click", () => {
  sound.unlock();
  mode = button.dataset.mode;
  els.modeButtons.forEach((item) => item.classList.toggle("active", item === button));
  els.difficultyField.hidden = mode === "pvp";
  els.sideField.hidden = mode === "pvp";
  resetGame();
}));
els.sideButtons.forEach((button) => button.addEventListener("click", () => {
  sound.unlock();
  humanColor = button.dataset.side;
  flipped = humanColor === BLACK;
  els.sideButtons.forEach((item) => item.classList.toggle("active", item === button));
  resetGame();
}));

updateSoundButton();
resetGame();
