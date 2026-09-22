import {
  BLACK,
  RED,
  boardKey,
  cloneBoard,
  findKing,
  generateLegalMoves,
  isInCheck,
  makeMove,
  opposite,
  undoMove,
} from "./engine.js";

const INF = 1_000_000_000;
const MATE = 10_000_000;
const VALUES = { K: MATE, R: 900, C: 450, H: 420, E: 210, A: 210, P: 100 };

export const AI_LEVELS = {
  easy: { label: "Dễ", maxDepth: 1, timeMs: 250, randomness: 90 },
  medium: { label: "Vừa", maxDepth: 2, timeMs: 700, randomness: 20 },
  hard: { label: "Khó", maxDepth: 4, timeMs: 1800, randomness: 0 },
  expert: { label: "Chuyên gia", maxDepth: 6, timeMs: 4000, randomness: 0 },
};

function positionalValue(piece, row, col) {
  const perspectiveRow = piece.color === RED ? 9 - row : row;
  const center = 4 - Math.abs(4 - col);
  switch (piece.type) {
    case "P":
      return perspectiveRow >= 5 ? perspectiveRow * 16 + center * 5 : perspectiveRow * 6;
    case "H":
      return center * 8 + (4 - Math.abs(4.5 - row)) * 3;
    case "C":
      return center * 4 + (perspectiveRow > 1 && perspectiveRow < 8 ? 10 : 0);
    case "R":
      return center * 2 + perspectiveRow * 2;
    case "A":
    case "E":
      return 8;
    case "K":
      return -Math.abs(4 - col) * 4;
    default:
      return 0;
  }
}

export function evaluateBoard(board, perspective) {
  let redScore = 0;
  let blackScore = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) continue;
      const score = VALUES[piece.type] + positionalValue(piece, row, col);
      if (piece.color === RED) redScore += score;
      else blackScore += score;
    }
  }
  const raw = redScore - blackScore;
  return perspective === RED ? raw : -raw;
}

function moveOrderScore(board, move, ttMove, killers, ply) {
  if (ttMove && sameMove(move, ttMove)) return 2_000_000;
  const attacker = board[move.fromRow][move.fromCol];
  const victim = board[move.toRow][move.toCol];
  if (victim) return 1_000_000 + VALUES[victim.type] * 10 - VALUES[attacker.type];
  if (killers[ply]?.some((killer) => sameMove(move, killer))) return 500_000;
  return 0;
}

function sameMove(a, b) {
  return a && b && a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol;
}

function rememberKiller(killers, ply, move) {
  killers[ply] ??= [];
  if (!killers[ply].some((item) => sameMove(item, move))) {
    killers[ply].unshift({ ...move });
    killers[ply] = killers[ply].slice(0, 2);
  }
}

function shouldStop(ctx) {
  if ((ctx.nodes & 1023) !== 0) return false;
  if (Date.now() >= ctx.deadline) {
    ctx.stopped = true;
    return true;
  }
  return false;
}

function quiescence(board, color, alpha, beta, ply, ctx, depthLeft = 3) {
  ctx.nodes += 1;
  if (shouldStop(ctx)) return 0;
  const standing = evaluateBoard(board, color);
  if (standing >= beta) return beta;
  if (standing > alpha) alpha = standing;
  if (depthLeft <= 0) return alpha;

  const captures = generateLegalMoves(board, color)
    .filter((move) => board[move.toRow][move.toCol])
    .sort((a, b) => moveOrderScore(board, b, null, ctx.killers, ply) - moveOrderScore(board, a, null, ctx.killers, ply));
  for (const move of captures) {
    const captured = makeMove(board, move);
    const score = -quiescence(board, opposite(color), -beta, -alpha, ply + 1, ctx, depthLeft - 1);
    undoMove(board, move, captured);
    if (ctx.stopped) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(board, color, depth, alpha, beta, ply, ctx, lineKeys) {
  ctx.nodes += 1;
  if (shouldStop(ctx)) return 0;
  if (!findKing(board, color)) return -MATE + ply;
  if (!findKing(board, opposite(color))) return MATE - ply;

  const key = boardKey(board, color);
  if (lineKeys.has(key)) return 0;
  if (depth <= 0) return quiescence(board, color, alpha, beta, ply, ctx);

  const cached = ctx.tt.get(key);
  const originalAlpha = alpha;
  if (cached && cached.depth >= depth) {
    if (cached.flag === "exact") return cached.score;
    if (cached.flag === "lower") alpha = Math.max(alpha, cached.score);
    if (cached.flag === "upper") beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  const moves = generateLegalMoves(board, color);
  if (moves.length === 0) return -MATE + ply;
  moves.sort((a, b) => moveOrderScore(board, b, cached?.move, ctx.killers, ply) - moveOrderScore(board, a, cached?.move, ctx.killers, ply));

  let bestScore = -INF;
  let bestMove = moves[0];
  lineKeys.add(key);
  for (const move of moves) {
    const captured = makeMove(board, move);
    const score = -negamax(board, opposite(color), depth - 1, -beta, -alpha, ply + 1, ctx, lineKeys);
    undoMove(board, move, captured);
    if (ctx.stopped) {
      lineKeys.delete(key);
      return 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      if (!captured) rememberKiller(ctx.killers, ply, move);
      ctx.cutoffs += 1;
      break;
    }
  }
  lineKeys.delete(key);

  const flag = bestScore <= originalAlpha ? "upper" : bestScore >= beta ? "lower" : "exact";
  ctx.tt.set(key, { depth, score: bestScore, flag, move: { ...bestMove } });
  return bestScore;
}

function searchRoot(board, color, depth, ctx) {
  const key = boardKey(board, color);
  const ttMove = ctx.tt.get(key)?.move;
  const moves = generateLegalMoves(board, color);
  moves.sort((a, b) => moveOrderScore(board, b, ttMove, ctx.killers, 0) - moveOrderScore(board, a, ttMove, ctx.killers, 0));
  let alpha = -INF;
  let bestMove = moves[0] ?? null;
  const scoredMoves = [];
  for (const move of moves) {
    const captured = makeMove(board, move);
    const score = -negamax(board, opposite(color), depth - 1, -INF, -alpha, 1, ctx, new Set([key]));
    undoMove(board, move, captured);
    if (ctx.stopped) break;
    scoredMoves.push({ move: { ...move }, score });
    if (score > alpha) {
      alpha = score;
      bestMove = { ...move };
    }
  }
  scoredMoves.sort((a, b) => b.score - a.score);
  return { bestMove, score: alpha, scoredMoves };
}

function principalVariation(board, color, depth, table) {
  const line = [];
  const work = cloneBoard(board);
  const seen = new Set();
  for (let ply = 0; ply < depth; ply += 1) {
    const key = boardKey(work, color);
    if (seen.has(key)) break;
    seen.add(key);
    const candidate = table.get(key)?.move;
    if (!candidate) break;
    const move = generateLegalMoves(work, color).find((legal) => sameMove(legal, candidate));
    if (!move) break;
    const piece = { ...work[move.fromRow][move.fromCol] };
    line.push({ move: { ...move }, piece, color });
    makeMove(work, move);
    color = opposite(color);
  }
  return line;
}

export function findBestMove(board, color, options = {}) {
  const level = AI_LEVELS[options.level] ?? AI_LEVELS.medium;
  const maxDepth = options.maxDepth ?? level.maxDepth;
  const timeMs = options.timeMs ?? level.timeMs;
  const started = Date.now();
  const ctx = {
    deadline: started + timeMs,
    nodes: 0,
    cutoffs: 0,
    stopped: false,
    tt: new Map(),
    killers: [],
  };
  let completed = { bestMove: generateLegalMoves(board, color)[0] ?? null, score: 0, scoredMoves: [] };
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const result = searchRoot(board, color, depth, ctx);
    if (ctx.stopped) break;
    completed = result;
    completedDepth = depth;
    if (result.bestMove) {
      ctx.tt.set(boardKey(board, color), {
        depth,
        score: result.score,
        flag: "exact",
        move: { ...result.bestMove },
      });
    }
    if (Math.abs(result.score) > MATE - 1000) break;
  }

  if (level.randomness > 0 && completed.scoredMoves.length > 1) {
    const candidates = completed.scoredMoves.filter((item) => item.score >= completed.score - level.randomness).slice(0, 4);
    completed.bestMove = candidates[Math.floor(Math.random() * candidates.length)]?.move ?? completed.bestMove;
  }

  let pv = principalVariation(board, color, completedDepth, ctx.tt);
  if (completed.bestMove && (!pv.length || !sameMove(pv[0].move, completed.bestMove))) {
    pv = [{ move: { ...completed.bestMove }, piece: { ...board[completed.bestMove.fromRow][completed.bestMove.fromCol] }, color }];
  }

  return {
    move: completed.bestMove,
    pv,
    score: completed.score,
    depth: completedDepth,
    nodes: ctx.nodes,
    cutoffs: ctx.cutoffs,
    timeMs: Date.now() - started,
    inCheck: isInCheck(board, color),
  };
}
