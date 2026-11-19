import { NPCS } from "../lib/world.js";
export const STORAGE_KEY = "cyber-town:v1";
export function freshState() {
  return {
    version: 1,
    player: { x: 420, y: 310 },
    residents: Object.fromEntries(
      NPCS.map((n) => [n.id, { affinity: 0, history: [], memories: [] }]),
    ),
    logs: [],
  };
}
export function validateState(value) {
  if (!value || value.version !== 1) throw new Error("存档版本不支持");
  const now = Date.now();
  const validTime = (at) => Number.isFinite(at) && at > 0 && at <= now + 60000;
  const state = freshState();
  for (const npc of NPCS) {
    const record = value.residents?.[npc.id];
    if (!record || !Number.isFinite(record.affinity))
      throw new Error("角色存档不完整");
    state.residents[npc.id] = {
      affinity: Math.max(0, Math.min(100, record.affinity)),
      history: (Array.isArray(record.history) ? record.history : [])
        .filter(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            validTime(m.at),
        )
        .slice(-50)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 2000),
          at: m.at,
        })),
      memories: (Array.isArray(record.memories) ? record.memories : [])
        .filter((m) => m && typeof m.text === "string" && validTime(m.at))
        .slice(-200)
        .map((m) => ({ text: m.text.slice(0, 2000), at: m.at })),
    };
  }
  state.logs = (Array.isArray(value.logs) ? value.logs : [])
    .filter((l) => l && typeof l.text === "string" && validTime(l.at))
    .slice(-100)
    .map((l) => ({ text: l.text.slice(0, 1000), at: l.at }));
  if (Number.isFinite(value.player?.x) && Number.isFinite(value.player?.y))
    state.player = {
      x: Math.max(40, Math.min(800, value.player.x)),
      y: Math.max(110, Math.min(520, value.player.y)),
    };
  return state;
}
export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? validateState(JSON.parse(raw)) : freshState();
}
