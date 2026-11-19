import { mode, json } from "../lib/server.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "请使用 GET 请求。" });
  }
  return json(res, 200, {
    mode: mode(),
    accessRequired: Boolean(process.env.APP_ACCESS_KEY),
    persistence: "browser",
    version: "1.0.0",
  });
}
