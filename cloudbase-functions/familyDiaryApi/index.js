const cloudbase = require("@cloudbase/node-sdk");
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const collection = db.collection("reflections");
const MEMBERS = new Set(["爸爸", "妈妈", "我"]);
const PERIODS = new Set(["midday", "evening"]);
const MAX_FIELD_CHARS = 20000;
const FAMILY_PIN = process.env.FAMILY_PIN;

exports.main = async (event) => {
  if (event.httpMethod === "OPTIONS") return output(event, {});
  const input = parseEvent(event);
  try {
    if (!FAMILY_PIN) return output(event, { error: "服务未配置访问码" }, 503);
    if (String(input.pin || "") !== FAMILY_PIN) return output(event, { error: "家庭密码不正确" }, 403);
    if (input.action === "listDate") {
      const result = await collection.where({ date: String(input.date || "") }).limit(100).get();
      return output(event, { entries: result.data.map(clean) });
    }
    if (input.action === "listMonth") {
      const month = String(input.month || "");
      const next = nextMonth(month);
      const _ = db.command;
      const result = await collection.where({ date: _.gte(`${month}-01`).and(_.lt(next)) }).limit(1000).get();
      return output(event, { entries: result.data.map(clean) });
    }
    if (input.action === "save") {
      if (!MEMBERS.has(input.member) || !PERIODS.has(input.period) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || "")) return output(event, { error: "记录格式不正确" }, 400);
      const id = `${input.date}-${input.member}-${input.period}`;
      const accomplished = list(input.accomplished);
      const plan = list(input.plan);
      const note = String(input.note || "");
      if (characters(accomplished) > MAX_FIELD_CHARS || characters(plan) > MAX_FIELD_CHARS || note.length > MAX_FIELD_CHARS) {
        return output(event, { error: "单个输入框最多可填写2万字" }, 400);
      }
      const value = { member: input.member, date: input.date, period: input.period, accomplished, plan, note, updatedAt: new Date() };
      await collection.doc(id).set(value);
      const saved = await collection.doc(id).get();
      if (!saved.data || saved.data.length === 0) throw new Error("记录写入后未能读取");
      return output(event, { ok: true, entry: clean(saved.data[0]) });
    }
    return output(event, { error: "未知操作" }, 400);
  } catch (error) { console.error(error); return output(event, { error: "服务暂时不可用，请稍后再试" }, 500); }
};

function parseEvent(event) {
  if (typeof event.body === "string") {
    try { return JSON.parse(event.body); } catch { return {}; }
  }
  if (event.body && typeof event.body === "object") return event.body;
  return event || {};
}
function isHttp(event) { return event && (event.httpMethod || event.requestContext || event.headers); }
function output(event, body, statusCode = 200) {
  if (!isHttp(event)) return body;
  return {
    statusCode,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}
function list(value) { return Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function characters(value) { return value.reduce((total, item) => total + item.length, 0); }
function clean(value) { const { _id, ...entry } = value; return entry; }
function nextMonth(month) { const [year, value] = month.split("-").map(Number); const next = new Date(year, value, 1); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`; }
