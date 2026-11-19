export const WIDTH = 840,
  HEIGHT = 560;
export const OBSTACLES = [
  { x: 150, y: 120, w: 190, h: 48 },
  { x: 505, y: 120, w: 190, h: 48 },
  { x: 350, y: 330, w: 160, h: 45 },
  { x: 55, y: 350, w: 95, h: 90 },
  { x: 680, y: 355, w: 110, h: 65 },
  { x: 40, y: 110, w: 40, h: 50 },
  { x: 760, y: 110, w: 40, h: 50 },
];
export function canMove(x, y) {
  return (
    x >= 28 &&
    x <= 812 &&
    y >= 105 &&
    y <= 530 &&
    !OBSTACLES.some(
      (o) =>
        x + 10 > o.x && x - 10 < o.x + o.w && y > o.y && y - 10 < o.y + o.h,
    )
  );
}
export function nearestNPC(player, npcs) {
  return [...npcs]
    .sort(
      (a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) -
        Math.hypot(b.x - player.x, b.y - player.y),
    )
    .find((n) => Math.hypot(n.x - player.x, n.y - player.y) < 82);
}
export function createWorld(canvas, npcs, player, interact, onMove) {
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  let last = 0,
    frame = 0,
    enabled = true,
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ambient = {};
  let focusId = null;
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const text = (s, x, y, c = "#e9ecda", size = 13) => {
    ctx.font = `${size}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = c;
    ctx.textAlign = "center";
    ctx.fillText(s, x, y);
  };
  function plant(x, y) {
    rect(x - 12, y, 24, 18, "#b36c52");
    rect(x - 9, y + 18, 18, 5, "#784c3c");
    rect(x - 3, y - 27, 6, 30, "#396544");
    rect(x - 20, y - 18, 20, 12, "#578356");
    rect(x, y - 29, 20, 12, "#75a262");
    rect(x + 3, y - 8, 16, 10, "#446c4a");
  }
  function desk(x, y, w) {
    rect(x + 5, y + 8, w, 44, "#6d503d");
    rect(x, y, w, 35, "#c8a076");
    rect(x, y, w, 5, "#edc995");
    rect(x + 12, y + 35, 8, 15, "#654e3e");
    rect(x + w - 20, y + 35, 8, 15, "#654e3e");
    rect(x + 35, y - 26, 55, 32, "#263f3d");
    rect(x + 40, y - 22, 45, 22, "#86a8a0");
    rect(x + 45, y - 18, 24, 3, "#d0e4c9");
    rect(x + 45, y - 11, 33, 3, "#4d807c");
    rect(x + 58, y + 6, 10, 8, "#364a40");
    rect(x + 45, y + 18, 55, 8, "#e0d6b3");
    rect(x + w - 34, y + 8, 12, 13, "#e9d9b6");
    rect(x + w - 20, y + 10, 5, 7, "#b68767");
  }
  function person(x, y, color, name, isPlayer = false) {
    const bob =
      !reduced && isPlayer && keys.size ? Math.sin(frame / 70) * 2 : 0;
    y += bob;
    ctx.globalAlpha = 0.25;
    rect(x - 14, y + 1, 28, 7, "#182d29");
    ctx.globalAlpha = 1;
    rect(x - 10, y - 21, 20, 22, color);
    rect(x - 9, y - 44, 18, 20, "#ebbc8a");
    rect(x - 11, y - 46, 22, 9, isPlayer ? "#a66a42" : "#39443a");
    rect(x - 11, y - 39, 5, 7, "#39443a");
    rect(x + 3, y - 34, 3, 3, "#26342f");
    rect(x - 14, y - 18, 5, 13, "#ebbc8a");
    rect(x + 9, y - 18, 5, 13, "#ebbc8a");
    rect(x - 9, y + 1, 7, 8, "#243c3b");
    rect(x + 3, y + 1, 7, 8, "#243c3b");
    if (isPlayer) {
      text("▼", x, y - 54, "#f39b79", 15);
    }
    text(name, x, y + 26, isPlayer ? "#faf3d6" : "#eef0d7", 14);
  }
  function draw(t) {
    const dt = Math.min((t - last) / 1000 || 0, 0.04);
    last = t;
    frame = t;
    if (enabled) {
      let dx =
          Number(keys.has("d") || keys.has("ArrowRight")) -
          Number(keys.has("a") || keys.has("ArrowLeft")),
        dy =
          Number(keys.has("s") || keys.has("ArrowDown")) -
          Number(keys.has("w") || keys.has("ArrowUp"));
      const len = Math.hypot(dx, dy) || 1;
      dx = (dx / len) * 150 * dt;
      dy = (dy / len) * 150 * dt;
      if (canMove(player.x + dx, player.y)) player.x += dx;
      if (canMove(player.x, player.y + dy)) player.y += dy;
      if (dx || dy) onMove();
    }
    rect(0, 0, 840, 560, "#a4ac88");
    rect(0, 0, 840, 85, "#d7d1ad");
    rect(0, 80, 840, 15, "#7f856b");
    for (let y = 100; y < 560; y += 40)
      for (let x = 0; x < 840; x += 40) {
        rect(x, y, 39, 39, ((x + y) / 40) % 2 ? "#a2a88a" : "#a9af90");
        rect(x, y, 39, 1, "#959e80");
      }
    for (const x of [130, 565]) {
      rect(x, 15, 140, 55, "#4e6d63");
      rect(x + 6, 21, 128, 43, "#a9c9bf");
      rect(x + 68, 21, 5, 43, "#e1dbb5");
      rect(x + 6, 41, 128, 4, "#e1dbb5");
      rect(x - 5, 68, 150, 6, "#f1dab1");
    }
    rect(363, 21, 114, 44, "#3c5b4c");
    text("MAKE IT HUMAN", 420, 49, "#d9deb8", 12);
    rect(210, 270, 430, 28, "#869a7b");
    rect(210, 295, 430, 7, "#7f9274");
    for (const o of OBSTACLES.slice(0, 3)) desk(o.x, o.y, o.w);
    rect(55, 350, 95, 90, "#647f69");
    rect(48, 360, 108, 25, "#829c7c");
    rect(48, 400, 108, 25, "#829c7c");
    rect(55, 440, 12, 10, "#4d604f");
    rect(132, 440, 12, 10, "#4d604f");
    rect(680, 355, 110, 65, "#ad8261");
    rect(685, 360, 100, 8, "#dbb78c");
    rect(700, 327, 33, 29, "#384f45");
    rect(708, 333, 17, 10, "#a5c0a4");
    rect(746, 340, 17, 15, "#ead9ae");
    plant(60, 133);
    plant(780, 133);
    plant(770, 489);
    plant(70, 493);
    text("休 息 区", 102, 474, "#445f4b", 13);
    text("咖 啡 角", 735, 445, "#445f4b", 13);
    const nearby = nearestNPC(player, npcs);
    if (nearby) {
      ctx.strokeStyle = "#f9e6ba";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(nearby.x - 27, nearby.y - 52, 54, 66);
      ctx.setLineDash([]);
    }
    for (const n of [
      ...npcs,
      { ...player, color: "#f39b79", name: "你", player: true },
    ].sort((a, b) => a.y - b.y))
      person(n.x, n.y, n.color || "#83abb1", n.name, n.player);
    for (const n of npcs) {
      if (
        n.id === focusId ||
        (!focusId && Math.floor(t / 5000) % 3 === npcs.indexOf(n))
      ) {
        const words = (
          ambient[n.id] ||
          n.greeting ||
          "今天也有新鲜事发生。"
        ).slice(0, 19);
        const w = Math.min(280, words.length * 13 + 24);
        rect(n.x - w / 2, n.y - 93, w, 28, "#f5edce");
        text(words, n.x, n.y - 74, "#334c41", 12);
        rect(n.x - 3, n.y - 65, 6, 5, "#f5edce");
      }
    }
    requestAnimationFrame(draw);
  }
  addEventListener("keydown", (e) => {
    if (
      ["INPUT", "TEXTAREA", "BUTTON"].includes(
        document.activeElement?.tagName,
      ) ||
      !enabled
    )
      return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "e",
      ].includes(key)
    ) {
      e.preventDefault();
      keys.add(key);
      if (key === "e" && !e.repeat) interact(nearestNPC(player, npcs));
    }
  });
  addEventListener("keyup", (e) =>
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
  );
  addEventListener("blur", () => keys.clear());
  canvas.addEventListener("click", (e) => {
    canvas.focus();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * 840) / r.width,
      y = ((e.clientY - r.top) * 560) / r.height;
    const n = npcs.find((n) => Math.hypot(n.x - x, n.y - y) < 45);
    if (n) interact(n);
  });
  requestAnimationFrame(draw);
  return {
    keys,
    setEnabled(v) {
      enabled = v;
      keys.clear();
    },
    setAmbient(v) {
      ambient = v;
    },
    focus(id) {
      focusId = id;
    },
  };
}
