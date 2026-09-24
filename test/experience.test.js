import test from "node:test";
import assert from "node:assert/strict";
import { CONTACT, PIECE_FX, movePose } from "../src/experience.js";

test("mọi quân chạm đúng ô đích trước nhịp đáp, không vượt ô hoặc thay đổi vị trí cuối", () => {
  for (const type of Object.keys(PIECE_FX)) {
    for (const capture of [false, true]) {
      let previous = 0;
      for (let i = 0; i <= 100; i += 1) {
        const pose = movePose(type, i / 100, capture);
        assert.ok(pose.travel >= previous && pose.travel <= 1);
        assert.ok(pose.lift >= 0 && pose.scaleX > 0 && pose.scaleY > 0);
        previous = pose.travel;
      }
      const contact = movePose(type, CONTACT, capture);
      assert.equal(contact.travel, 1);
      assert.ok(Math.abs(contact.lift) < 1e-10);
      const end = movePose(type, 1, capture);
      assert.equal(end.scaleX, 1);
      assert.equal(end.scaleY, 1);
      assert.equal(movePose(type, 0, capture).travel, 0);
    }
  }
  assert.ok(movePose("H", 0.43, true).lift > movePose("R", 0.43, true).lift);
  assert.ok(movePose("C", 0.43, true).lift > movePose("C", 0.43, false).lift);
});
