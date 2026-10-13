"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { demoCallDiary } from "./mockApi";

const API_URL = import.meta.env.VITE_DIARY_API_URL || "";

async function callDiary(data: Record<string, unknown>) {
  if (!API_URL) return await demoCallDiary(data) as { ok?: boolean; entry?: Reflection; entries?: Reflection[]; error?: string };
  const response = await fetch(API_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`);
  return result as { ok?: boolean; entry?: Reflection; entries?: Reflection[]; error?: string };
}

type Member = "爸爸" | "妈妈" | "我";
type Period = "midday" | "evening";
type View = "record" | "family" | "calendar";
type Reflection = { member: Member; date: string; period: Period; accomplished: string[]; plan: string[]; note: string };

const members: { name: Member; emoji: string; color: string }[] = [
  { name: "爸爸", emoji: "爸", color: "blue" },
  { name: "妈妈", emoji: "妈", color: "rose" },
  { name: "我", emoji: "我", color: "amber" },
];
const periodCopy = {
  midday: { title: "中午记录", done: "上午做了什么？", plan: "下午准备做什么？", greeting: "中午好", icon: "☀" },
  evening: { title: "晚上记录", done: "下午做了什么？", plan: "明天准备做什么？", greeting: "晚上好", icon: "月" },
};
const chinaDate = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const MAX_FIELD_CHARS = 20000;
const splitItems = (value: string) => value.split(/[\n，,；;]+/).map((item) => item.trim()).filter(Boolean);
const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const detail = error as { message?: unknown; code?: unknown; requestId?: unknown; original?: unknown };
    const parts = [detail.message, detail.code, detail.requestId].filter(Boolean).map(String);
    if (parts.length) return parts.join(" / ");
    try { return JSON.stringify(error); } catch { return "未知错误"; }
  }
  return "未知错误";
};

export default function Home() {
  const [member, setMember] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [view, setView] = useState<View>("record");
  const [period, setPeriod] = useState<Period>(new Date().getHours() < 17 ? "midday" : "evening");
  const [selectedDate, setSelectedDate] = useState(chinaDate());
  const [calendarMonth, setCalendarMonth] = useState(chinaDate().slice(0, 7));
  const [accomplished, setAccomplished] = useState("");
  const [plan, setPlan] = useState("");
  const [note, setNote] = useState("");
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [monthReflections, setMonthReflections] = useState<Reflection[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const drafts = useRef<Record<Period, { accomplished: string; plan: string; note: string } | null>>({ midday: null, evening: null });
  const today = useMemo(chinaDate, []);

  useEffect(() => {
    const savedMember = localStorage.getItem("family-member") as Member | null;
    if (members.some((item) => item.name === savedMember)) setMember(savedMember);
  }, []);

  async function fetchReflections(query: string, nextPin = pin) {
    if (nextPin.length !== 4) return [];
    const params = new URLSearchParams(query);
    const result = await callDiary({ action: params.has("month") ? "listMonth" : "listDate", pin: nextPin, date: params.get("date"), month: params.get("month") });
    if (result.error) throw new Error(result.error);
    return result.entries || [];
  }

  async function loadDate(date = selectedDate, nextPin = pin) {
    if (nextPin.length !== 4) return;
    setLoading(true);
    try {
      const items = await fetchReflections(`date=${date}`, nextPin);
      setReflections(items);
      const localDraft = drafts.current[period];
      const mine = items.find((entry) => entry.member === member && entry.period === period);
      setAccomplished(localDraft?.accomplished ?? mine?.accomplished.join("\n") ?? "");
      setPlan(localDraft?.plan ?? mine?.plan.join("\n") ?? "");
      setNote(localDraft?.note ?? mine?.note ?? "");
      setStatus("");
    } catch (error) { setStatus(`读取失败：${describeError(error)}`); }
    finally { setLoading(false); }
  }

  async function loadMonth(month = calendarMonth) {
    if (pin.length !== 4) return;
    setLoading(true);
    try { setMonthReflections(await fetchReflections(`month=${month}`)); setStatus(""); }
    catch (error) { setStatus(`读取失败：${describeError(error)}`); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (member && pin.length === 4) loadDate(selectedDate, pin); }, [member, pin, period, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseMember(name: Member) { setMember(name); localStorage.setItem("family-member", name); }
  function choosePeriod(next: Period) {
    if (next === period) return;
    drafts.current[period] = { accomplished, plan, note };
    const nextDraft = drafts.current[next];
    setAccomplished(nextDraft?.accomplished || "");
    setPlan(nextDraft?.plan || "");
    setNote(nextDraft?.note || "");
    setStatus("");
    setPeriod(next);
  }
  function selectView(next: View) {
    setView(next);
    if (next === "family") loadDate();
    if (next === "calendar") loadMonth();
  }
  function chooseCalendarDate(date: string) { setSelectedDate(date); setView("family"); loadDate(date); }

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!member) return;
    if (pin.length !== 4) { setStatus("请先输入4位家庭密码"); return; }
    setLoading(true); setStatus("");
    try {
      const result = await callDiary({ action: "save", pin, member, date: today, period, accomplished: splitItems(accomplished), plan: splitItems(plan), note: note.trim() });
      if (!result.ok) throw new Error(result.error || "云函数没有返回成功结果");
      drafts.current[period] = { accomplished, plan, note };
      setSelectedDate(today);
      await loadDate(today, pin);
      setStatus(`${periodCopy[period].title}已保存 😊`);
    } catch (error) { setStatus(`保存失败：${describeError(error)}`); }
    finally { setLoading(false); }
  }

  if (!member) return <Welcome chooseMember={chooseMember} />;
  const copy = periodCopy[period];

  return (
    <main className="app-shell">
      <header className="topbar"><div><p>{today.replaceAll("-", ".")}</p><h1>{copy.greeting}，{member}</h1></div><button className="avatar" aria-label="切换填写人" onClick={() => setMember(null)}>{member.slice(0, 1)}</button></header>
      <nav className="tabs three" aria-label="主要页面">
        <button className={view === "record" ? "active" : ""} onClick={() => selectView("record")}>写记录</button>
        <button className={view === "family" ? "active" : ""} onClick={() => selectView("family")}>家庭日报</button>
        <button className={view === "calendar" ? "active" : ""} onClick={() => selectView("calendar")}>日历</button>
      </nav>

      {view === "record" && <form className="record-form" onSubmit={saveEntry}>
        <div className="period-switch"><button type="button" className={period === "midday" ? "active midday" : ""} onClick={() => choosePeriod("midday")}><span>☀</span>中午记录<small>上午总结 · 下午计划</small></button><button type="button" className={period === "evening" ? "active evening" : ""} onClick={() => choosePeriod("evening")}><span>月</span>晚上记录<small>下午总结 · 明日计划</small></button></div>
        <label className="pin-field"><span>{API_URL ? "家庭密码" : "演示访问码"}</span><input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder={API_URL ? "4位数字" : "任意4位数字"} /></label>
        <section className="field-card done"><div className="field-heading"><span>✓</span><div><label htmlFor="accomplished">{copy.done}</label><small>一句一行，也可以用逗号隔开</small></div></div><textarea id="accomplished" maxLength={MAX_FIELD_CHARS} value={accomplished} onChange={(e) => setAccomplished(e.target.value)} placeholder={period === "midday" ? "例如：完成工作汇报，散步20分钟" : "例如：去超市买菜，整理了房间"} /></section>
        <section className="field-card plan"><div className="field-heading"><span>→</span><div><label htmlFor="plan">{copy.plan}</label><small>写下最重要的一两件事</small></div></div><textarea id="plan" maxLength={MAX_FIELD_CHARS} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder={period === "midday" ? "例如：处理文件，陪家人吃饭" : "例如：上午去医院取药"} /></section>
        <label className="note-field" htmlFor="note">反思或想对家人说的话 <small>选填</small></label><textarea className="note-input" id="note" maxLength={MAX_FIELD_CHARS} value={note} onChange={(e) => setNote(e.target.value)} placeholder="今天有什么感受？" />
        {status && <p className="status" role="status">{status}</p>}<button className="save-button" disabled={loading}>{loading ? "正在保存…" : `保存${copy.title}`}</button>
      </form>}

      {view === "family" && <FamilyDiary date={selectedDate} entries={reflections} status={status} />}
      {view === "calendar" && <Calendar month={calendarMonth} setMonth={(month) => { setCalendarMonth(month); setTimeout(() => loadMonth(month), 0); }} entries={monthReflections} onSelect={chooseCalendarDate} today={today} status={status} />}
    </main>
  );
}

function Welcome({ chooseMember }: { chooseMember: (member: Member) => void }) {
  return <main className="app-shell welcome"><div className="brand-mark">省</div><p className="eyebrow">我们三个人的反思与规划</p><h1>家庭小日记</h1><p className="welcome-copy">中午回顾上午，晚上整理一天。每天两次，让家人知道彼此过得怎么样。</p><section className="identity-card"><h2>你是谁？</h2><p>选择后，下次会自动记住</p><div className="member-grid">{members.map((item) => <button key={item.name} className={`member-button ${item.color}`} onClick={() => chooseMember(item.name)}><span>{item.emoji}</span>{item.name}</button>)}</div></section><p className="privacy-note">{API_URL ? "🔒 只有知道家庭密码的人才能查看" : "演示模式：记录仅保存在当前浏览器"}</p></main>;
}

function FamilyDiary({ date, entries, status }: { date: string; entries: Reflection[]; status: string }) {
  return <section className="family-view"><div className="daily-intro"><p>{date === chinaDate() ? "今日反思与规划" : "历史反思与规划"}</p><h2>{formatChineseDate(date)}</h2></div>{members.map((item) => {
    const midday = entries.find((entry) => entry.member === item.name && entry.period === "midday");
    const evening = entries.find((entry) => entry.member === item.name && entry.period === "evening");
    return <article className={`family-card ${item.color}`} key={item.name}><div className="family-head"><span>{item.emoji}</span><div><h3>{item.name}</h3><p>{midday || evening ? `${Number(Boolean(midday)) + Number(Boolean(evening))}/2 次记录` : "还没有记录"}</p></div></div>{midday || evening ? <div className="entry-content"><SessionBlock title="中午" icon="☀" entry={midday} done="上午完成" plan="下午计划" /><SessionBlock title="晚上" icon="月" entry={evening} done="下午完成" plan="明日计划" /></div> : <p className="empty-message">这一天还没有留下记录。</p>}</article>;
  })}<div className="family-summary">🌿 <strong>一天两次，轻轻回望。</strong><br />完成的值得开心，没完成的可以重新安排。</div>{status && <p className="status">{status}</p>}</section>;
}

function SessionBlock({ title, icon, entry, done, plan }: { title: string; icon: string; entry?: Reflection; done: string; plan: string }) {
  return <div className="session-block"><h4><span>{icon}</span>{title}</h4>{entry ? <><EntryList label={done} items={entry.accomplished} /><EntryList label={plan} items={entry.plan} />{entry.note && <blockquote>“{entry.note}”</blockquote>}</> : <p className="session-empty">未记录</p>}</div>;
}

function EntryList({ label, items }: { label: string; items: string[] }) { return <div className="entry-list"><strong>{label}</strong>{items.length ? <ul>{items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul> : <p>没有填写</p>}</div>; }

function Calendar({ month, setMonth, entries, onSelect, today, status }: { month: string; setMonth: (month: string) => void; entries: Reflection[]; onSelect: (date: string) => void; today: string; status: string }) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const days = new Date(year, monthNumber, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  function shift(delta: number) { const next = new Date(year, monthNumber - 1 + delta, 1); setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`); }
  return <section className="calendar-view"><div className="calendar-header"><button onClick={() => shift(-1)} aria-label="上个月">‹</button><div><p>反思与规划日历</p><h2>{year}年{monthNumber}月</h2></div><button onClick={() => shift(1)} aria-label="下个月">›</button></div><div className="week-row">{"日一二三四五六".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => {
    if (!day) return <span key={`empty-${index}`} />;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dayEntries = entries.filter((entry) => entry.date === date);
    const people = new Set(dayEntries.map((entry) => entry.member)).size;
    return <button key={date} className={`${date === today ? "today" : ""} ${dayEntries.length ? "has-entry" : ""}`} onClick={() => onSelect(date)}><strong>{day}</strong>{dayEntries.length > 0 && <span className="record-dots">{members.map((m) => <i key={m.name} className={dayEntries.some((e) => e.member === m.name) ? m.color : ""} />)}</span>}<small>{people ? `${people}人` : ""}</small></button>;
  })}</div><div className="calendar-tip">点选有标记的日期，查看当天三个人的记录</div>{status && <p className="status">{status}</p>}</section>;
}

function formatChineseDate(value: string) { const [y, m, d] = value.split("-").map(Number); return `${y}年${m}月${d}日`; }
