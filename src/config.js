import 'dotenv/config';
import { log } from './logger.js';

// ตรวจว่าค่าที่จำเป็นครบ ถ้าไม่ครบแจ้งเป็นภาษาไทยแล้วออกจากโปรแกรมทันที
const REQUIRED = [
  ['DISCORD_TOKEN', 'โทเคนบอท จาก Discord Developer Portal > Bot > Reset Token'],
  ['AI_BASE_URL', 'ที่อยู่ AI API แบบ OpenAI-compatible เช่น https://api.openai.com/v1'],
  ['AI_API_KEY', 'กุญแจ API ของผู้ให้บริการ AI'],
  ['AI_MODEL', 'ชื่อโมเดล เช่น gpt-4o-mini'],
  ['ALLOWED_CHANNEL_IDS', 'Channel ID ของช่องที่บอทจะตอบ (เปิด Developer Mode แล้วคลิกขวาที่ช่อง > Copy Channel ID)'],
];

for (const [name, hint] of REQUIRED) {
  if (!process.env[name]?.trim()) {
    log.error('');
    log.error(`  ❌  ขาดค่าที่จำเป็นในไฟล์ .env: ${name}`);
    log.error(`  วิธีหาค่า: ${hint}`);
    log.error('');
    process.exit(1);
  }
}

const allowedChannelIds = process.env.ALLOWED_CHANNEL_IDS.split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const invalidIds = allowedChannelIds.filter((id) => !/^\d+$/.test(id));
if (allowedChannelIds.length === 0 || invalidIds.length > 0) {
  log.error('');
  log.error('  ❌  ALLOWED_CHANNEL_IDS ไม่ถูกต้อง ต้องเป็น Channel ID (ตัวเลข) คั่นด้วยเครื่องหมาย ,');
  if (invalidIds.length > 0) log.error(`  ค่าที่ผิด: ${invalidIds.join(', ')}`);
  log.error('');
  process.exit(1);
}

const historyLimit = Number.parseInt(process.env.HISTORY_LIMIT ?? '20', 10);
const cooldownSeconds = Number.parseInt(process.env.COOLDOWN_SECONDS ?? '10', 10);
const imageCooldownSeconds = Number.parseInt(process.env.IMAGE_COOLDOWN_SECONDS ?? '30', 10);
const threadIdleDeleteMinutes = Number.parseInt(process.env.THREAD_IDLE_DELETE_MINUTES ?? '60', 10);

const config = {
  discordToken: process.env.DISCORD_TOKEN.trim(),
  aiBaseUrl: process.env.AI_BASE_URL.trim().replace(/\/+$/, ''),
  aiApiKey: process.env.AI_API_KEY.trim(),
  aiModel: process.env.AI_MODEL.trim(),
  allowedChannelIds: new Set(allowedChannelIds),
  systemPrompt: process.env.SYSTEM_PROMPT?.trim() || 'คุณคือผู้ช่วย AI ที่ตอบคำถามเป็นภาษาไทยอย่างกระชับและถูกต้อง',
  historyLimit: Number.isFinite(historyLimit) && historyLimit > 0 ? historyLimit : 20,
  // โหมดเธรด: เปิดเธรดใหม่ให้แต่ละคำถามในช่องที่กำหนด (ปิดด้วย THREAD_MODE=false)
  threadMode: (process.env.THREAD_MODE ?? 'true').trim().toLowerCase() !== 'false',
  // ลบเธรดอัตโนมัติหลังไม่มีใครพิมพ์ต่อ (นาที) — 0 = ปิดการลบเอง
  threadIdleDeleteMinutes: Number.isFinite(threadIdleDeleteMinutes) && threadIdleDeleteMinutes >= 0 ? threadIdleDeleteMinutes : 60,
  // กันสแปม: วินาทีขั้นต่ำระหว่างการถามของคนเดียวกัน
  cooldownSeconds: Number.isFinite(cooldownSeconds) && cooldownSeconds >= 0 ? cooldownSeconds : 10,
  imageCooldownSeconds: Number.isFinite(imageCooldownSeconds) && imageCooldownSeconds >= 0 ? imageCooldownSeconds : 30,
  // model สำหรับ /draw (image model)
  imageModel: process.env.IMAGE_MODEL?.trim() || 'ag/gemini-3.1-flash-image',
  // สีกล่อง embed (เลขฐาน 16)
  embedColor: process.env.EMBED_COLOR?.trim() || '5865F2',
  // search model สำหรับคำถามข้อมูลสด (ถ้าว่าง จะค้นเว็บเองผ่าน DuckDuckGo แล้วฉีดผลให้ model ปกติ)
  searchModel: process.env.SEARCH_MODEL?.trim() || null,
};

export default config;
