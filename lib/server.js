import { timingSafeEqual } from "node:crypto";
import { NPCS } from "./world.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export function authorize(req) {
  const expected = process.env.APP_ACCESS_KEY;
  if (!expected) return;
  const actual = req.headers?.["x-access-key"];
  const a = Buffer.from(typeof actual === "string" ? actual : "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new ApiError(401, "请输入正确的访问口令。");
}

export function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body) > 100000)
      throw new ApiError(413, "对话记录过大，请减少记录后重试。");
    try {
      body = JSON.parse(body);
    } catch {
      throw new ApiError(400, "请求内容不是有效 JSON。");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "请求内容格式不正确。");
  if (Buffer.byteLength(JSON.stringify(body)) > 100000)
    throw new ApiError(413, "对话记录过大，请减少记录后重试。");
  return body;
}

function validTime(at) {
  return (
    typeof at === "number" &&
    Number.isFinite(at) &&
    at > 0 &&
    at <= Date.now() + 60000
  );
}

export function validateChat(body) {
  const npc = NPCS.find((n) => n.id === body.npcId);
  if (!npc) throw new ApiError(400, "没有找到这位居民。");
  if (
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 1000
  )
    throw new ApiError(400, "请输入 1 至 1000 字的消息。");
  const history = body.history ?? [];
  const memories = body.memories ?? [];
  if (
    !Array.isArray(history) ||
    history.length > 50 ||
    history.some(
      (m) =>
        !m ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 2000 ||
        !validTime(m.at),
    )
  )
    throw new ApiError(400, "近期对话记录格式不正确。");
  if (
    !Array.isArray(memories) ||
    memories.length > 200 ||
    memories.some(
      (m) =>
        !m ||
        typeof m.text !== "string" ||
        m.text.length > 2000 ||
        !validTime(m.at),
    )
  )
    throw new ApiError(400, "长期记忆格式不正确。");
  const affinity = body.affinity ?? 0;
  if (
    typeof affinity !== "number" ||
    !Number.isFinite(affinity) ||
    affinity < 0 ||
    affinity > 100
  )
    throw new ApiError(400, "好感度应在 0 至 100 之间。");
  return { npc, message: body.message.trim(), history, memories, affinity };
}

export function mode() {
  return process.env.LLM_API_KEY ? "ai" : "demo";
}

export async function completion(messages) {
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  let url;
  try {
    url = new URL(`${base.replace(/\/$/, "")}/chat/completions`);
  } catch {
    throw new ApiError(503, "模型服务地址配置无效。");
  }
  if (url.protocol !== "https:")
    throw new ApiError(503, "模型服务地址必须使用 HTTPS。");
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages,
        max_tokens: 650,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok)
      throw new ApiError(502, "模型服务暂时不可用，请稍后重试或检查配置。");
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Invalid content");
    const result = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("Invalid JSON object");
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new ApiError(504, "居民暂时没有回应，请稍后再试。");
    throw new ApiError(502, "模型返回的内容无法读取，请重试。");
  }
}

export function fail(res, error) {
  return json(res, error instanceof ApiError ? error.status : 500, {
    error:
      error instanceof ApiError
        ? error.message
        : "服务暂时遇到问题，请稍后再试。",
  });
}
