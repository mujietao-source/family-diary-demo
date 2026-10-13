type Entry = {
  member: string;
  date: string;
  period: string;
  accomplished: string[];
  plan: string[];
  note: string;
};

const STORAGE_KEY = "family-diary-demo-entries";

function readEntries(): Entry[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function demoCallDiary(data: Record<string, unknown>) {
  const entries = readEntries();
  if (data.action === "listDate") {
    return { entries: entries.filter((item) => item.date === data.date) };
  }
  if (data.action === "listMonth") {
    return { entries: entries.filter((item) => item.date.startsWith(String(data.month || "") + "-")) };
  }
  if (data.action === "save") {
    const entry: Entry = {
      member: String(data.member || ""),
      date: String(data.date || ""),
      period: String(data.period || ""),
      accomplished: Array.isArray(data.accomplished) ? data.accomplished.map(String) : [],
      plan: Array.isArray(data.plan) ? data.plan.map(String) : [],
      note: String(data.note || ""),
    };
    const next = entries.filter((item) => !(item.member === entry.member && item.date === entry.date && item.period === entry.period));
    next.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true, entry };
  }
  return { error: "未知操作" };
}
