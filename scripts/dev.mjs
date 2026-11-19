import http from "node:http";
import { existsSync } from "node:fs";
import { createServer } from "vite";
if (existsSync(".env")) process.loadEnvFile(".env");
const handlers = {
  "/api/chat": (await import("../api/chat.js")).default,
  "/api/status": (await import("../api/status.js")).default,
  "/api/ambient": (await import("../api/ambient.js")).default,
};
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "spa",
});
http
  .createServer(async (req, res) => {
    const handler = handlers[req.url.split("?")[0]];
    if (!handler) return vite.middlewares(req, res);
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    try {
      let data = "";
      for await (const chunk of req) {
        data += chunk;
        if (data.length > 100000) {
          res.status(413).json({ error: "请求过大" });
          return;
        }
      }
      if (data) req.body = JSON.parse(data);
      await handler(req, res);
    } catch {
      if (!res.writableEnded) res.status(400).json({ error: "请求格式不正确" });
    }
  })
  .listen(5173, "127.0.0.1", () =>
    console.log("赛博小镇 http://127.0.0.1:5173"),
  );
