import { findBestMove } from "./ai.js";

self.addEventListener("message", (event) => {
  const { board, color, level, requestId } = event.data;
  try {
    const result = findBestMove(board, color, { level });
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
  }
});
