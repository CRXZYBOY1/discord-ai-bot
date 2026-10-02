// สถิติการใช้งานต่อวัน/ต่อเซิร์ฟเวอร์ บันทึกลงไฟล์ data/usage.json
// เก็บ: จำนวนคำถาม, ผู้ใช้, token (ถ้า API ส่งมา), model ที่ใช้
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../data/usage.json', import.meta.url));

let data = {};
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  data = {};
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dayEntry(date, guildId) {
  data[date] ??= {};
  data[date][guildId] ??= { questions: 0, users: {}, promptTokens: 0, completionTokens: 0, models: {} };
  return data[date][guildId];
}

export function recordUsage(guildId, userId, model, usage) {
  const entry = dayEntry(today(), guildId);
  entry.questions += 1;
  entry.users[userId] = (entry.users[userId] ?? 0) + 1;
  entry.promptTokens += usage?.prompt_tokens ?? 0;
  entry.completionTokens += usage?.completion_tokens ?? 0;
  entry.models[model] = (entry.models[model] ?? 0) + 1;
  save();
}

function sumFor(guildId, dateFilter) {
  const summary = { questions: 0, users: new Set(), promptTokens: 0, completionTokens: 0, models: {} };

  for (const [date, guilds] of Object.entries(data)) {
    if (dateFilter && date !== dateFilter) continue;
    const g = guilds[guildId];
    if (!g) continue;
    summary.questions += g.questions;
    summary.promptTokens += g.promptTokens;
    summary.completionTokens += g.completionTokens;
    for (const id of Object.keys(g.users)) summary.users.add(id);
    for (const [model, count] of Object.entries(g.models)) {
      summary.models[model] = (summary.models[model] ?? 0) + count;
    }
  }

  return { ...summary, userCount: summary.users.size, users: undefined };
}

// สรุปสถิติของเซิร์ฟเวอร์: วันนี้ + ทั้งหมด
export function getSummary(guildId) {
  return { today: sumFor(guildId, today()), allTime: sumFor(guildId) };
}
