export const NPCS = [
  {
    id: "engineer",
    name: "张三",
    role: "Python 工程师",
    color: "#e9aa61",
    x: 260,
    y: 210,
    personality: "严谨但乐于助人，用具体例子解释技术，喜欢整洁的代码。",
    greeting: "刚好写完一个函数。有什么想一起研究的？",
    ambient: "先让测试变绿，再去泡一杯咖啡。",
  },
  {
    id: "product",
    name: "李四",
    role: "产品经理",
    color: "#92b9a0",
    x: 580,
    y: 210,
    personality: "开朗、有同理心，关注真实需求，喜欢问清楚问题背后的原因。",
    greeting: "欢迎来到小镇！你心里最想实现的是什么？",
    ambient: "把需求写清楚，大家才能往同一个方向走。",
  },
  {
    id: "designer",
    name: "王五",
    role: "UI 设计师",
    color: "#ba9cc5",
    x: 420,
    y: 420,
    personality: "细腻而富有想象力，关注色彩、空间和易用性，喜欢分享设计灵感。",
    greeting: "你好呀，坐下来聊聊。今天发现什么好看的东西了吗？",
    ambient: "窗外的树影，很适合变成新的配色。",
  },
];

export function relationship(score) {
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  return n <= 20
    ? "陌生"
    : n <= 40
      ? "熟悉"
      : n <= 60
        ? "友好"
        : n <= 80
          ? "亲密"
          : "挚友";
}

export function recentHistory(history = [], now = Date.now()) {
  return history
    .filter((item) => now - item.at <= 120 * 60 * 1000 && item.at <= now)
    .slice(-10)
    .map(({ role, content }) => ({ role, content }));
}

function tokens(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  return new Set(
    Array.from({ length: Math.max(0, normalized.length - 1) }, (_, i) =>
      normalized.slice(i, i + 2),
    ),
  );
}

export function retrieveMemories(message, memories = [], now = Date.now()) {
  const query = tokens(message);
  return memories
    .filter((item) => item.at <= now)
    .map((item) => ({
      ...item,
      rank: [...tokens(item.text)].filter((t) => query.has(t)).length,
    }))
    .sort((a, b) => b.rank - a.rank || b.at - a.at)
    .slice(0, 5)
    .map(({ text, at }) => ({ text, at }));
}

export function demoReply(npc, message, memories = [], history = []) {
  const prior = [
    ...memories.map((m) => m.text),
    ...history.filter((m) => m.role === "user").map((m) => m.content),
  ].join("\n");
  const name = prior.match(/(?:我叫|我的名字是)([^，。！？\s]{1,12})/u)?.[1];
  const preference = prior.match(/我(?:最)?喜欢([^，。！？\n]{1,60})/u)?.[1];
  if (/记得|记住|名字|叫什么|喜欢什么/.test(message) && (name || preference)) {
    return `我记得${name ? `你叫${name}` : ""}${name && preference ? "，" : ""}${preference ? `你喜欢${preference}` : ""}。很高兴继续和你聊天。`;
  }
  if (/我叫|我的名字是/.test(message))
    return `很高兴认识你！我会把这次自我介绍记在我们的对话里。我是${npc.name}，负责${npc.role}的工作。`;
  if (/我(?:最)?喜欢/.test(message))
    return "记下你的喜好了。下次聊到这个话题，我们可以接着说。";
  if (/谢谢|感谢/.test(message))
    return "不客气，能帮到你我也很开心。我们下次继续聊！";
  if (/你好|早上好|晚上好/.test(message)) return npc.greeting;
  return {
    engineer:
      "我会先把这个问题拆成一个最小例子，再补上测试。你能说说具体遇到了什么现象吗？",
    product: "我们先想一想谁会用它，以及他最想解决什么问题。你最在意哪个结果？",
    designer:
      "我会从阅读顺序和空间留白开始。你更希望它给人安静的感觉，还是活泼一点？",
  }[npc.id];
}

export function sentiment(message) {
  if (/笨蛋|滚开|讨厌你|废物|垃圾/.test(message))
    return { delta: -3, reason: "不友善的表达让关系稍微疏远了。" };
  if (/谢谢|感谢|你好|辛苦|喜欢|请|很棒/.test(message))
    return { delta: 3, reason: "友善的交流增进了了解。" };
  return { delta: 1, reason: "一次平和的交流。" };
}
