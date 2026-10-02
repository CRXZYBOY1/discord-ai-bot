// เก็บ model ที่ตั้งผ่านคำสั่ง /model แยกตามเซิร์ฟเวอร์ โดยบันทึกลงไฟล์
// data/settings.json เพื่อให้ค่าที่ตั้งไว้ยังอยู่แม้รีสตาร์ทบอท
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../data/settings.json', import.meta.url));

let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  settings = {};
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2), 'utf8');
}

export function getModel(guildId) {
  return settings[guildId]?.model ?? null;
}

export function setModel(guildId, model) {
  settings[guildId] = { ...settings[guildId], model };
  save();
}

export function clearModel(guildId) {
  if (!settings[guildId]) return;
  delete settings[guildId].model;
  if (Object.keys(settings[guildId]).length === 0) delete settings[guildId];
  save();
}
