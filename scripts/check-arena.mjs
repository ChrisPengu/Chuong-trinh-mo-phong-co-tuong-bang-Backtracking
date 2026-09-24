// Real WebGL smoke test, isolated browser profile, no access to user browsing data.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    server.on("error", reject);
    server.stdout.on("data", chunk => { const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
  });
  const installed = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p => p && existsSync(p));
  browser = await chromium.launch({ executablePath: installed, headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(`${msg.text()} [${msg.location().url}]`); });
  page.on("requestfailed", request => errors.push(`Request failed: ${request.url()}`));
  page.on("response", response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector("#rendererStatus").textContent.includes("3D LIVE"), { timeout: 20000 });
  await page.locator("#startCeremony").waitFor({ state: "hidden" });
  await page.waitForTimeout(800);
  await mkdir(".artifacts", { recursive: true });
  await page.screenshot({ path: ".artifacts/arena-desktop.png", fullPage: true });
  assert.equal(await page.locator("#arena3d").isVisible(), true);
  await page.locator('[data-mode="pvp"]').click();
  await page.locator("#startCeremony").waitFor({ state: "hidden" });
  // Orthographic projection of real board intersections, then genuine pointer clicks.
  async function point(row, col, flipped = false) {
    return page.evaluate(async ({ row, col, flipped }) => {
      const T = await import("/vendor/three.js");
      const rect = document.querySelector("#arena3d").getBoundingClientRect();
      const half = Math.max(6.5, 6.25 / (rect.width / rect.height));
      const top = document.querySelector("#cameraView").value === "top";
      const camera = top ? new T.OrthographicCamera(-half * rect.width / rect.height, half * rect.width / rect.height, half, -half, .1, 80) : new T.PerspectiveCamera(40, rect.width / rect.height, .1, 80);
      if (top) camera.position.set(0, 20, .001);
      else camera.position.set(0, 15, 12).normalize().multiplyScalar(half / Math.tan(Math.PI / 9));
      camera.lookAt(0, -.1, 0); camera.updateMatrixWorld();
      const v = new T.Vector3(flipped ? 4 - col : col - 4, .12, flipped ? 4.5 - row : row - 4.5).project(camera);
      return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 };
    }, { row, col, flipped });
  }
  async function clickCell(row, col, flipped) { const p = await point(row, col, flipped); await page.mouse.click(p.x, p.y); }
  await clickCell(6, 0); await clickCell(5, 0);
  await page.waitForFunction(() => document.querySelector("#moveCount").textContent.includes("1"));
  await page.waitForTimeout(850);
  await page.locator("#flipBtn").click();
  await page.waitForTimeout(500);
  await clickCell(3, 0, true); await clickCell(4, 0, true);
  await page.waitForFunction(() => document.querySelector("#moveCount").textContent.includes("2"));
  await page.waitForTimeout(850);
  await page.locator("#undoBtn").click();
  await page.waitForFunction(() => document.querySelector("#moveCount").textContent.includes("1"));
  await page.locator("#cameraView").selectOption("top");
  await page.locator("#fxLevel").selectOption("medium");
  await page.screenshot({ path: ".artifacts/arena-top.png", fullPage: true });
  await page.locator("#scenarioSelect").selectOption("red_mate_one");
  await page.locator("#loadScenario").click();
  await page.locator("#startCeremony").waitFor({ state: "hidden" });
  // Deterministic mate fixture (AI strength is covered separately by node:test).
  const move = { fromRow: 2, fromCol: 4, toRow: 1, toCol: 4 };
  // Loading a scenario preserves the user's flipped view.
  await clickCell(move.fromRow, move.fromCol, true); await clickCell(move.toRow, move.toCol, true);
  await page.waitForTimeout(320);
  await page.screenshot({ path: ".artifacts/arena-strike.png", fullPage: true });
  await page.locator("#resultBackdrop").waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: ".artifacts/arena-victory.png", fullPage: true });
  await page.locator("#reviewBtn").click();
  await page.locator("#rendererMode").selectOption("2d");
  assert.equal(await page.locator("#board").isVisible(), true);
  await page.locator("#rendererMode").selectOption("3d");
  await page.waitForFunction(() => document.querySelector("#rendererStatus").textContent.includes("3D LIVE"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#newGame").click();
  await page.locator("#startCeremony").waitFor({ state: "hidden" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: ".artifacts/arena-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No mobile horizontal overflow");
  await page.locator('[data-mode="pve"]').click();
  await page.locator("#startCeremony").waitFor({ state: "hidden" });
  await page.locator("#arena3d").scrollIntoViewIfNeeded();
  await clickCell(6, 0, true); await clickCell(5, 0, true);
  await page.waitForFunction(() => document.querySelector("#moveCount").textContent.includes("2"));
  // Real GPU-context-loss path: preserve the current game and expose 2D controls.
  await page.evaluate(() => document.querySelector("#arena3d").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
  await page.locator("#board").waitFor({ state: "visible" });
  assert.equal(await page.locator("#moveCount").textContent(), "2 nước");
  assert.deepEqual(errors.filter(x => !x.includes("favicon.ico")), [], "No browser/runtime/shader errors");
  console.log("PASS: actual WebGL, legal pointer moves, flipped picking, undo, top view, capture/victory, 2D↔3D, mobile, reduced motion, AI Worker reply, context-loss fallback. Screenshots: .artifacts/");
} finally { await browser?.close(); server.kill(); }
