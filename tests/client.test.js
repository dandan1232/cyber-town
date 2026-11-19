import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  validateState,
  loadState,
  STORAGE_KEY,
} from "../src/storage.js";
import { canMove, nearestNPC, OBSTACLES } from "../src/world.js";
import { NPCS, retrieveMemories } from "../lib/world.js";

test("new saves and residents have independent histories", () => {
  const a = freshState(),
    b = freshState();
  a.residents.engineer.history.push({
    role: "user",
    content: "你好",
    at: Date.now(),
  });
  assert.equal(a.residents.designer.history.length, 0);
  assert.equal(b.residents.engineer.history.length, 0);
  assert.equal(canMove(a.player.x, a.player.y), true);
});

test("save import filters null, invalid roles and invalid dates without crashing", () => {
  const save = freshState(),
    now = Date.now();
  save.residents.engineer.history = [
    null,
    false,
    { role: "system", content: "bad", at: now },
    ...[-1, 0, Infinity, now + 120000, "yesterday"].map((at) => ({
      role: "user",
      content: "bad",
      at,
    })),
    { role: "user", content: "<script>test</script>", at: now },
  ];
  save.residents.engineer.memories = [
    null,
    { text: "bad", at: -1 },
    { text: "good", at: now },
  ];
  save.logs = [null, { text: "bad", at: Infinity }, { text: "good", at: now }];
  const imported = validateState(save);
  assert.deepEqual(imported.residents.engineer.history, [
    { role: "user", content: "<script>test</script>", at: now },
  ]);
  assert.deepEqual(imported.residents.engineer.memories, [
    { text: "good", at: now },
  ]);
  assert.deepEqual(imported.logs, [{ text: "good", at: now }]);
});

test("save import bounds size, strings, affinity and position", () => {
  const save = freshState(),
    now = Date.now();
  save.player = { x: -300, y: 10000 };
  save.residents.engineer.affinity = 300;
  save.residents.product.affinity = -20;
  save.residents.engineer.history = Array.from({ length: 60 }, (_, i) => ({
    role: "user",
    content: `${i}:${"字".repeat(3000)}`,
    at: now,
  }));
  save.residents.engineer.memories = Array.from({ length: 210 }, (_, i) => ({
    text: `${i}:${"字".repeat(3000)}`,
    at: now,
  }));
  save.logs = Array.from({ length: 110 }, () => ({
    text: "字".repeat(2000),
    at: now,
  }));
  const imported = validateState(save),
    r = imported.residents.engineer;
  assert.equal(r.affinity, 100);
  assert.equal(imported.residents.product.affinity, 0);
  assert.deepEqual(imported.player, { x: 40, y: 520 });
  assert.equal(r.history.length, 50);
  assert.equal(r.memories.length, 200);
  assert.equal(imported.logs.length, 100);
  assert.equal(r.history[0].content.length, 2000);
  assert.match(r.history[0].content, /^10:/);
  assert.equal(imported.logs[0].text.length, 1000);
  const request = {
    npcId: "engineer",
    message: "字".repeat(1000),
    history: r.history.slice(-10),
    memories: retrieveMemories("字", r.memories),
    affinity: r.affinity,
  };
  assert.ok(
    Buffer.byteLength(JSON.stringify(request)) < 100000,
    "maximal imported Chinese histories remain within API body limit",
  );
});

test("invalid save versions and corrupted JSON fail explicitly", () => {
  assert.throws(() => validateState(null), /版本/);
  assert.throws(() => validateState({ version: 2 }), /版本/);
  const incomplete = freshState();
  incomplete.residents.engineer.affinity = NaN;
  assert.throws(() => validateState(incomplete), /不完整/);
  assert.throws(() => loadState({ getItem: () => "{broken" }), SyntaxError);
  assert.deepEqual(
    loadState({
      getItem: (key) => {
        assert.equal(key, STORAGE_KEY);
        return null;
      },
    }),
    freshState(),
  );
  assert.deepEqual(
    loadState({ getItem: () => JSON.stringify(freshState()) }),
    freshState(),
  );
});

test("collision rejects room edges, nonfinite positions and every furniture rectangle", () => {
  for (const [x, y] of [
    [27, 300],
    [813, 300],
    [420, 104],
    [420, 531],
    [NaN, 310],
    [420, Infinity],
  ])
    assert.equal(canMove(x, y), false);
  for (const rect of OBSTACLES)
    assert.equal(canMove(rect.x + rect.w / 2, rect.y + rect.h / 2), false);
  assert.equal(canMove(420, 310), true);
  // The avatar's ten-pixel footprint must not clip through the side of a desk.
  assert.equal(canMove(145, 140), false);
  assert.equal(canMove(140, 140), true);
});

test("interaction chooses the closest NPC only within 82 pixels, without mutating order", () => {
  const npcs = [
    { id: "far", x: 70, y: 0 },
    { id: "near", x: 20, y: 0 },
  ];
  assert.equal(nearestNPC({ x: 0, y: 0 }, npcs).id, "near");
  assert.equal(npcs[0].id, "far");
  assert.equal(nearestNPC({ x: 0, y: 0 }, [{ x: 82, y: 0 }]), undefined);
  assert.equal(nearestNPC({ x: 0, y: 0 }, []), undefined);
  for (const npc of NPCS)
    assert.equal(nearestNPC({ x: npc.x, y: npc.y + 30 }, NPCS).id, npc.id);
});
