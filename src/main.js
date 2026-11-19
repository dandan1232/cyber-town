import "./style.css";
import { NPCS, relationship, retrieveMemories } from "../lib/world.js";
import { createWorld, nearestNPC, canMove } from "./world.js";
import {
  freshState,
  loadState,
  validateState,
  STORAGE_KEY,
} from "./storage.js";

document.querySelector("#app").innerHTML = `
<header class="topbar"><a class="brand" href="/" aria-label="赛博小镇首页"><span class="brand-mark">▥</span><span>赛博小镇<small>CYBER TOWN</small></span></a><div class="top-actions"><span id="mode" class="mode">正在连接…</span><button id="settings" class="quiet">设置与存档</button></div></header>
<main><section class="game-column"><div class="scene-heading"><div><span class="eyebrow">一个有记忆的小世界</span><h1>今天，和谁聊聊？</h1><p>走近一点，故事就开始了。</p></div><div class="room-label"><span class="live-dot"></span>共享办公室<small>ROOM 01 · 三位伙伴在这里</small></div></div>
<div class="game-frame"><div class="game-chrome"><span>小镇日常</span><span id="clock">09:00 AM</span><button id="pause" class="quiet" aria-pressed="false">暂停移动</button></div><canvas id="world" width="840" height="560" tabindex="0" aria-label="办公室游戏场景。使用WASD或方向键移动，靠近角色按E交谈。也可使用下方方向按钮。"></canvas><div class="scene-bottom"><span id="proximity">探索办公室，走近一位伙伴</span><button id="interact">开始交谈 <kbd>E</kbd></button></div></div>
<div class="under-scene"><p><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> 移动 <span>·</span> <kbd>E</kbd> 交谈 <span>·</span> <kbd>Esc</kbd> 结束对话</p><span>进度保存在此浏览器</span></div>
<div class="touch-pad" aria-label="移动控制"><button data-move="ArrowUp" aria-label="向上移动">↑</button><div><button data-move="ArrowLeft" aria-label="向左移动">←</button><button data-move="ArrowDown" aria-label="向下移动">↓</button><button data-move="ArrowRight" aria-label="向右移动">→</button></div></div>
<section class="journal"><div class="section-title"><h2>小镇动态</h2><button id="export-log" class="quiet">导出记录</button></div><div id="logs" role="log" aria-live="polite"></div></section></section>
<aside class="side-panel"><section id="residents-panel"><div class="section-title"><h2>办公室的伙伴</h2><span class="counter">03</span></div><p class="muted">每个人，都有自己的故事。</p><div id="residents"></div><div class="note"><span>小镇贴士</span><p>告诉伙伴你的名字、兴趣或今天的心情。下一次见面，他们会记得。</p><small>演示模式使用规则回复；AI 模式需要配置模型。</small></div></section>
<section id="conversation" hidden><div class="section-title"><div><span class="eyebrow">正在交谈</span><h2 id="chat-name"></h2></div><button id="close-chat" class="quiet" aria-label="结束对话">结束 ×</button></div><p id="chat-role" class="muted"></p><div class="relationship"><span id="relation-text"></span><progress id="affinity" max="100" value="0"></progress></div><div class="tabs" role="tablist" aria-label="角色信息"><button id="tab-chat" role="tab" aria-selected="true">对话</button><button id="tab-memory" role="tab" aria-selected="false">记忆</button></div><div id="messages" role="log" aria-live="polite"></div><div id="memories" hidden></div><form id="chat-form"><label for="message">说点什么吧</label><textarea id="message" placeholder="你好，很高兴认识你！" maxlength="1000" rows="3" required></textarea><div class="form-footer"><span id="send-status">Enter 发送 · Shift + Enter 换行</span><button id="send" type="submit">发送</button></div></form></section>
</aside></main><footer><span>CYBER TOWN <span class="muted">/</span> 每一次交谈，都留下点什么。</span><span>慢一点，认识一个新朋友。</span></footer><div id="toast" role="status" hidden></div>
<dialog id="settings-dialog"><div class="section-title"><h2>设置与存档</h2><button id="close-settings" class="quiet" aria-label="关闭设置">关闭 ×</button></div><p>对话、好感度与记忆保存在当前浏览器。清除浏览器数据会丢失进度，建议先导出存档。</p><div class="setting-row"><h3>我的小镇存档</h3><button id="export-save">导出存档</button><label class="file-label" for="import-save">导入存档</label><input id="import-save" type="file" accept="application/json,.json"><p id="import-status" aria-live="polite"></p></div><button id="reset" class="danger">重置此浏览器的小镇</button></dialog>`;

const $ = (s) => document.querySelector(s);
let state;
let storageWarning = false;
try {
  state = loadState(localStorage);
} catch {
  state = freshState();
  storageWarning = true;
}
if (!canMove(state.player.x, state.player.y)) state.player = { x: 420, y: 310 };
let selected = null,
  busy = false,
  paused = false,
  mode = "connecting";
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5000);
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    toast("浏览器无法保存进度，请导出存档备份。");
    return false;
  }
}
function log(message) {
  state.logs.push({ text: message, at: Date.now() });
  state.logs = state.logs.slice(-100);
  renderLogs();
  return save();
}
function renderLogs() {
  $("#logs").replaceChildren();
  for (const l of state.logs.slice(-4).reverse()) {
    const row = document.createElement("p");
    const time = document.createElement("time");
    time.textContent = new Date(l.at).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    row.append(time, document.createTextNode(l.text));
    $("#logs").append(row);
  }
  if (!state.logs.length)
    $("#logs").textContent = "你来到了小镇。找到一位伙伴，打个招呼吧。";
}
function renderResidents() {
  $("#residents").replaceChildren();
  for (const n of NPCS) {
    const r = state.residents[n.id];
    const button = document.createElement("button");
    button.className = "resident";
    button.style.setProperty("--resident-color", n.color || "#86b5ae");
    button.innerHTML =
      '<span class="pixel-face" aria-hidden="true"></span><span class="resident-info"><strong></strong><small></small><span class="resident-relation"></span></span><span class="resident-action">交谈</span>';
    button.querySelector("strong").textContent = n.name;
    button.querySelector("small").textContent = n.role || n.profession;
    button.querySelector(".resident-relation").textContent =
      `${relationship(r.affinity)} · ${r.affinity}/100`;
    button.onclick = () => openChat(n);
    $("#residents").append(button);
  }
}
function renderChat() {
  if (!selected) return;
  const r = state.residents[selected.id];
  $("#chat-name").textContent = selected.name;
  $("#chat-role").textContent = selected.role || selected.profession;
  $("#relation-text").textContent =
    `${relationship(r.affinity)} · 好感度 ${r.affinity}/100`;
  $("#affinity").value = r.affinity;
  $("#messages").replaceChildren();
  if (!r.history.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = `你走到了${selected.name}身边。打个招呼，让对方认识你吧。`;
    $("#messages").append(p);
  }
  for (const m of r.history) {
    const p = document.createElement("div");
    p.className = `message ${m.role}`;
    const label = document.createElement("small");
    label.textContent = m.role === "user" ? "你" : selected.name;
    const content = document.createElement("p");
    content.textContent = m.content;
    p.append(label, content);
    $("#messages").append(p);
  }
  $("#messages").scrollTop = $("#messages").scrollHeight;
  $("#memories").replaceChildren();
  for (const m of [...r.memories].reverse()) {
    const p = document.createElement("p");
    p.className = "memory";
    p.textContent = m.text;
    $("#memories").append(p);
  }
  if (!r.memories.length)
    $("#memories").textContent = "还没有共同记忆。聊聊你的名字或兴趣吧。";
}
const world = createWorld($("#world"), NPCS, state.player, openChat, () => {});
function updateMovement() {
  world.setEnabled(!paused && !selected && !$("#settings-dialog").open);
}
function openChat(n) {
  if (!n) {
    toast("再靠近伙伴一点，就可以交谈。");
    return;
  }
  if (Math.hypot(n.x - state.player.x, n.y - state.player.y) >= 82) {
    world.focus(n.id);
    toast(`先走到${n.name}身边，再按 E 或点击交谈。`);
    return;
  }
  if (busy) return;
  selected = n;
  world.focus(n.id);
  $("#residents-panel").hidden = true;
  $("#conversation").hidden = false;
  showTab(false);
  renderChat();
  updateMovement();
  $("#message").focus();
}
function closeChat() {
  if (busy) {
    toast("伙伴正在回复，请稍等。");
    return;
  }
  selected = null;
  world.focus(null);
  $("#conversation").hidden = true;
  $("#residents-panel").hidden = false;
  updateMovement();
  $("#world").focus();
}
function showTab(memory) {
  $("#messages").hidden = memory;
  $("#memories").hidden = !memory;
  $("#chat-form").hidden = memory;
  $("#tab-chat").setAttribute("aria-selected", String(!memory));
  $("#tab-memory").setAttribute("aria-selected", String(memory));
}
$("#tab-chat").onclick = () => showTab(false);
$("#tab-memory").onclick = () => showTab(true);
$("#close-chat").onclick = closeChat;
$("#interact").onclick = () => openChat(nearestNPC(state.player, NPCS));
$("#pause").onclick = () => {
  paused = !paused;
  $("#pause").textContent = paused ? "继续移动" : "暂停移动";
  $("#pause").setAttribute("aria-pressed", String(paused));
  updateMovement();
};
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#settings-dialog").open && selected)
    closeChat();
});
for (const button of document.querySelectorAll("[data-move]")) {
  button.onpointerdown = (e) => {
    if (selected || paused) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    world.keys.add(button.dataset.move);
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, () =>
      world.keys.delete(button.dataset.move),
    );
}
async function api(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(29000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("服务接口暂不可用，请稍后重试。");
  }
  if (!response.ok) throw new Error(data.error || "服务暂不可用，请稍后重试。");
  return data;
}
async function connect() {
  try {
    const status = await api("status");
    mode = status.mode;
    $("#mode").textContent =
      mode === "ai" ? "AI 对话模式" : "演示模式 · 无需配置";
    $("#mode").title =
      mode === "ai" ? "对话由模型生成" : "规则回复，可体验移动、记忆和好感度";
    await refreshAmbient();
  } catch (error) {
    mode = "offline";
    $("#mode").textContent = "服务未连接";
    toast(error.message);
  }
}
async function refreshAmbient() {
  try {
    const data = await api("ambient", {});
    world.setAmbient(data.dialogues);
  } catch (error) {
    toast(error.message);
  }
}
$("#chat-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!selected || busy) return;
  const message = $("#message").value.trim();
  if (!message) return;
  const npc = selected,
    r = state.residents[npc.id];
  busy = true;
  $("#send").disabled = true;
  $("#message").disabled = true;
  $("#send-status").textContent = `${npc.name}正在想怎么回答…`;
  try {
    const result = await api("chat", {
      npcId: npc.id,
      message,
      history: r.history.slice(-10),
      memories: retrieveMemories(message, r.memories),
      affinity: r.affinity,
    });
    if (typeof result.reply !== "string" || !Number.isFinite(result.affinity))
      throw new Error("回复格式有误，请重试。");
    const now = Date.now();
    r.history.push(
      { role: "user", content: message, at: now },
      { role: "assistant", content: result.reply, at: now },
    );
    r.history = r.history.slice(-50);
    if (result.memory?.text) {
      r.memories.push(result.memory);
      r.memories = r.memories.slice(-200);
    }
    r.affinity = result.affinity;
    $("#message").value = "";
    const persisted = log(
      `你和${npc.name}聊了聊 · 好感度 ${result.delta >= 0 ? "+" : ""}${result.delta}（${result.reason}）`,
    );
    renderChat();
    renderResidents();
    $("#send-status").textContent =
      !persisted
        ? "回复成功，但进度未保存，请导出存档"
        : result.mode === "demo"
        ? "演示回复 · 进度已保存在本浏览器"
        : "AI 回复 · 进度已保存在本浏览器";
  } catch (error) {
    $("#send-status").textContent = "发送未成功，内容已保留，可再次发送。";
    toast(
      error.name === "TimeoutError"
        ? "回复超时了，请稍后重试。"
        : error.message,
    );
  } finally {
    busy = false;
    $("#send").disabled = false;
    $("#message").disabled = false;
    $("#message").focus();
  }
};
$("#message").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $("#chat-form").requestSubmit();
  }
};
$("#settings").onclick = () => {
  if (busy) {
    toast("请等待当前对话完成后打开设置。");
    return;
  }
  $("#settings-dialog").showModal();
  updateMovement();
};
$("#close-settings").onclick = () => $("#settings-dialog").close();
$("#settings-dialog").addEventListener("close", updateMovement);
function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#export-save").onclick = () => download("cyber-town-save.json", state);
$("#export-log").onclick = () =>
  download("cyber-town-journal.json", state.logs);
$("#import-save").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error("存档超过2MB，无法导入。");
    const imported = validateState(JSON.parse(await file.text()));
    if (!confirm("导入会替换当前浏览器的进度，确定继续吗？")) return;
    const previous = state;
    state = imported;
    if (!save()) {
      state = previous;
      throw new Error("浏览器未能保存导入内容，原有进度已保留。");
    }
    location.reload();
  } catch (error) {
    $("#import-status").textContent = `导入失败：${error.message}`;
  } finally {
    e.target.value = "";
  }
};
$("#reset").onclick = () => {
  if (confirm("确定清除本浏览器的所有对话、记忆和好感度吗？建议先导出存档。")) {
    const previous = state;
    state = freshState();
    if (!save()) {
      state = previous;
      toast("重置未成功：浏览器无法写入存档，原有进度已保留。");
      return;
    }
    location.reload();
  }
};
setInterval(() => {
  const n = nearestNPC(state.player, NPCS);
  $("#proximity").textContent = selected
    ? `正在与${selected.name}交谈`
    : n
      ? `${n.name}就在身边，打个招呼吧`
      : "探索办公室，走近一位伙伴";
  $("#interact").disabled = !!selected || !n;
  $("#clock").textContent = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}, 300);
setInterval(save, 5000);
setInterval(() => {
  if (!document.hidden && mode !== "offline") refreshAmbient();
}, 300000);
addEventListener("pagehide", save);
renderResidents();
renderLogs();
connect();
if (storageWarning)
  toast("已有存档无法读取，已使用新进度。请检查浏览器存储权限。");
