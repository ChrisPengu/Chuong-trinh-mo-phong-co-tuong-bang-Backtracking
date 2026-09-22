import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const explicitPort = process.env.PORT !== undefined;
const requestedPort = Number(process.env.PORT || 4173);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  console.error("PORT phải là số nguyên từ 0 đến 65535.");
  process.exit(1);
}
let port = requestedPort;
const root = process.cwd();
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
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, safePath === "/" || safePath === "\\" ? "index.html" : safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("404 - Không tìm thấy tài nguyên");
    return;
  }
  if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
  response.writeHead(200, {
    "Content-Type": types[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
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
  console.log("Nhấn Ctrl+C để dừng server.");
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
