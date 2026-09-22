import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("trạng thái AI nằm ngoài khung bàn cờ và không có lớp phủ suy nghĩ", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const status = html.indexOf('id="thinkingStatus"');
  const frame = html.indexOf('id="boardFrame"');
  assert.ok(status > 0 && frame > status);
  assert.ok(!html.includes('id="thinkingOverlay"'));
  assert.ok(!html.slice(frame, html.indexOf('id="redStrip"')).includes('id="thinkingStatus"'));
  assert.ok(html.includes('class="ceremony-sigil"'), "mở ván có vòng triệu hồi riêng");
});
