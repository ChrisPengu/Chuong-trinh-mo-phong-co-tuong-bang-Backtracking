import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const explicitPort = process.env.PORT !== undefined;
const requestedPort = Number(process.env.PORT || 4173);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  console.error("PORT phải là số nguyên từ 0 đến 65535.");
  process.exit(1);
}
let port = requestedPort;
// Always serve THIS checkout, even when launched from a different terminal folder.
const root = dirname(fileURLToPath(import.meta.url));
const build = "huyen-gioi-3d-2026-09-24";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ogg": "audio/ogg",
};

const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("X-Ky-Thap-Build", build);
  let requestPath;
  try { requestPath = decodeURIComponent((request.url || "/").split("?")[0]); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  if (requestPath === "/__version") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ app: "ky-thap", build, entry: "index.html", renderer: "three-webgl2" }));
    return;
  }
  let filePath = resolve(root, `.${requestPath.replaceAll("\\", "/")}`);
  const withinRoot = relative(root, filePath);
  if (withinRoot.startsWith("..") || isAbsolute(withinRoot) || requestPath.includes("\0")) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = resolve(filePath, "index.html");
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("404 - Không tìm thấy tài nguyên");
    return;
  }
  response.writeHead(200, {
    "Content-Type": types[extname(filePath)] || "application/octet-stream",
  });
  const stream = createReadStream(filePath);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && !explicitPort && port !== 0) {
    const busyPort = port;
    port = port < 4183 ? port + 1 : 0;
    console.warn(`Cổng ${busyPort} đang được sử dụng; đang thử ${port || "một cổng trống"}...`);
    server.listen(port, "127.0.0.1");
    return;
  }
  if (error.code === "EADDRINUSE") {
    console.error(`Cổng ${port} đang được sử dụng. Hãy dừng server cũ hoặc chọn PORT khác.`);
  } else {
    console.error(`Không thể khởi động server: ${error.message}`);
  }
  process.exitCode = 1;
});

server.on("listening", () => {
  const actualPort = server.address().port;
  console.log(`Kỳ Thập đang chạy tại http://127.0.0.1:${actualPort}`);
  console.log(`Bản: ${build}`);
  console.log(`Thư mục phục vụ: ${root}`);
  console.log(`Mở bản mới: http://127.0.0.1:${actualPort}/?v=${build}`);
  console.log("Nhấn Ctrl+C để dừng server.");
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
