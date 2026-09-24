import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

test("server phục vụ bản 3D đúng checkout kể cả khi chạy từ thư mục khác", async t => {
  const process = spawn(globalThis.process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url))], {
    cwd: tmpdir(), env: { ...globalThis.process.env, PORT: "0" }, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => process.kill());
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timeout")), 10000);
    process.once("error", error => { clearTimeout(timer); reject(error); });
    process.stdout.on("data", data => {
      const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  for (const file of ["index.html", "arena.css", "src/arena3d.js", "vendor/three.js"]) {
    const response = await fetch(`${base}/${file}?v=latest`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(await response.text(), await readFile(new URL(`../${file}`, import.meta.url), "utf8"), file);
  }
  const version = await (await fetch(`${base}/__version`)).json();
  assert.equal(version.build, "huyen-gioi-3d-2026-09-24");
  const home = await (await fetch(base)).text();
  assert.match(home, /id="arena3d"/);
  assert.match(home, /id="rendererMode"/);
  assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
  assert.equal((await fetch(`${base}/missing-file`)).status, 404);
  assert.equal((await fetch(`${base}/`)).status, 200, "server còn sống sau yêu cầu sai");
});
