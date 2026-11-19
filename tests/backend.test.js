import test from "node:test";
import assert from "node:assert/strict";
import chat from "../api/chat.js";
import status from "../api/status.js";
import ambient from "../api/ambient.js";
import { relationship, recentHistory, retrieveMemories } from "../lib/world.js";

async function request(handler, body, options = {}) {
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  await handler({ method: "POST", headers: {}, body, ...options }, res);
  return res;
}
const input = () => ({
  npcId: "engineer",
  message: "你好",
  history: [],
  memories: [],
  affinity: 0,
});

test("relationship boundaries are inclusive and clamped", () => {
  assert.deepEqual(
    [-1, 20, 21, 40, 41, 60, 61, 80, 81, 101].map(relationship),
    [
      "陌生",
      "陌生",
      "熟悉",
      "熟悉",
      "友好",
      "友好",
      "亲密",
      "亲密",
      "挚友",
      "挚友",
    ],
  );
});
test("short-term history drops expired and future messages and keeps ten", () => {
  const now = Date.now();
  const rows = Array.from({ length: 15 }, (_, i) => ({
    role: "user",
    content: String(i),
    at: now - i * 1000,
  }));
  rows.push(
    { role: "user", content: "expired", at: now - 121 * 60000 },
    { role: "user", content: "future", at: now + 1 },
  );
  const result = recentHistory(rows, now);
  assert.equal(result.length, 10);
  assert.equal(result[0].content, "5");
  assert.equal(result.at(-1).content, "14");
});
test("long-term retrieval ranks relevant memories and caps at five", () => {
  const now = Date.now();
  const rows = Array.from({ length: 9 }, (_, i) => ({
    text: `其他事情${i}`,
    at: now - i,
  }));
  rows.push({ text: "我喜欢喝咖啡", at: now - 999 });
  const result = retrieveMemories("咖啡", rows, now);
  assert.equal(result.length, 5);
  assert.equal(result[0].text, "我喜欢喝咖啡");
});
test("demo dialogue, memory, isolation, bounds and validation", async () => {
  delete process.env.LLM_API_KEY;
  delete process.env.APP_ACCESS_KEY;
  const greeting = await request(chat, input());
  assert.equal(greeting.statusCode, 200);
  assert.equal(greeting.body.mode, "demo");
  assert.equal(greeting.body.affinity, 3);
  assert.equal(greeting.body.memory.text, "你好");
  const remember = await request(chat, {
    ...input(),
    message: "记得我叫什么吗？",
    memories: [{ text: "我叫小鱼", at: Date.now() }],
  });
  assert.match(remember.body.reply, /小鱼/);
  const isolated = await request(chat, {
    ...input(),
    npcId: "designer",
    message: "记得我叫什么吗？",
  });
  assert.doesNotMatch(isolated.body.reply, /小鱼/);
  const upper = await request(chat, { ...input(), affinity: 99 });
  assert.equal(upper.body.affinity, 100);
  assert.equal(upper.body.delta, 1);
  const lower = await request(chat, { ...input(), message: "滚开" });
  assert.equal(lower.body.affinity, 0);
  for (const body of [
    { ...input(), npcId: "unknown" },
    { ...input(), message: " " },
    { ...input(), message: "字".repeat(1001) },
    { ...input(), affinity: -1 },
    {
      ...input(),
      history: [{ role: "system", content: "hack", at: Date.now() }],
    },
    { ...input(), memories: Array(201).fill({ text: "x", at: Date.now() }) },
  ]) {
    assert.equal((await request(chat, body)).statusCode, 400);
  }
  assert.equal((await request(chat, "{invalid")).statusCode, 400);
  assert.equal(
    (await request(chat, input(), { method: "GET" })).statusCode,
    405,
  );
});
test("optional access key is checked and never exposed by status", async () => {
  process.env.APP_ACCESS_KEY = "private-test-key";
  try {
    assert.equal((await request(chat, input())).statusCode, 401);
    assert.equal((await request(ambient)).statusCode, 401);
    assert.equal(
      (
        await request(chat, input(), {
          headers: { "x-access-key": "private-test-key" },
        })
      ).statusCode,
      200,
    );
    const info = await request(status, undefined, { method: "GET" });
    assert.equal(info.body.accessRequired, true);
    assert.doesNotMatch(JSON.stringify(info.body), /private-test-key/);
  } finally {
    delete process.env.APP_ACCESS_KEY;
  }
});
test("AI context, bounded sentiment, invalid responses, upstream failures and timeout", async () => {
  process.env.LLM_API_KEY = "secret-test-key";
  const originalFetch = globalThis.fetch;
  try {
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "你好小鱼",
                  delta: 100,
                  reason: "友好",
                }),
              },
            },
          ],
        }),
      };
    };
    const result = await request(chat, {
      ...input(),
      memories: [{ text: "我叫小鱼", at: Date.now() }],
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.mode, "ai");
    assert.equal(result.body.delta, 5);
    assert.match(seen.messages[1].content, /小鱼/);
    assert.equal(seen.messages.at(-1).role, "user");
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "secret-test-key" }),
    });
    const failure = await request(chat, input());
    assert.equal(failure.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(failure.body), /secret-test-key/);
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] }),
    });
    assert.equal((await request(chat, input())).statusCode, 502);
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "null" } }] }),
    });
    assert.equal((await request(chat, input())).statusCode, 502);
    globalThis.fetch = async () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    };
    assert.equal((await request(chat, input())).statusCode, 504);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.LLM_API_KEY;
  }
});
test("ambient generates all residents in one model call", async () => {
  const demo = await request(ambient);
  assert.equal(demo.body.mode, "demo");
  assert.equal(Object.keys(demo.body.dialogues).length, 3);
  const originalFetch = globalThis.fetch;
  process.env.LLM_API_KEY = "test";
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"engineer":"写代码","product":"看需求","designer":"画草图"}',
              },
            },
          ],
        }),
      };
    };
    const result = await request(ambient);
    assert.equal(result.statusCode, 200);
    assert.equal(calls, 1);
    assert.equal(result.body.dialogues.designer, "画草图");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.LLM_API_KEY;
  }
});
