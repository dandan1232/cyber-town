import { NPCS } from "../lib/world.js";
import {
  ApiError,
  authorize,
  mode,
  completion,
  json,
  fail,
} from "../lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "请使用 POST 请求。" });
  }
  try {
    authorize(req);
    const currentMode = mode();
    let dialogues = Object.fromEntries(NPCS.map((n) => [n.id, n.ambient]));
    if (currentMode === "ai") {
      dialogues = await completion([
        {
          role: "system",
          content:
            "为像素办公室中的三位居民分别写一句20至40字的自言自语，可以相互呼应。只返回JSON对象，键为居民id，值为台词。",
        },
        {
          role: "user",
          content: JSON.stringify(
            NPCS.map(({ id, role, personality }) => ({
              id,
              role,
              personality,
            })),
          ),
        },
      ]);
      if (
        NPCS.some(
          (n) =>
            typeof dialogues[n.id] !== "string" ||
            !dialogues[n.id].trim() ||
            dialogues[n.id].length > 200,
        )
      )
        throw new ApiError(502, "背景对话格式不完整，请重试。");
      dialogues = Object.fromEntries(NPCS.map((n) => [n.id, dialogues[n.id]]));
    }
    return json(res, 200, {
      mode: currentMode,
      dialogues,
      generatedAt: Date.now(),
    });
  } catch (error) {
    return fail(res, error);
  }
}
