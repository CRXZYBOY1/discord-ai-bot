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

const config = {
  discordToken: process.env.DISCORD_TOKEN.trim(),
  aiBaseUrl: process.env.AI_BASE_URL.trim().replace(/\/+$/, ''),
  aiApiKey: process.env.AI_API_KEY.trim(),
  aiModel: process.env.AI_MODEL.trim(),
  allowedChannelIds: new Set(allowedChannelIds),
  systemPrompt: process.env.SYSTEM_PROMPT?.trim() || 'คุณคือผู้ช่วย AI ที่ตอบคำถามเป็นภาษาไทยอย่างกระชับและถูกต้อง',
  historyLimit: Number.isFinite(historyLimit) && historyLimit > 0 ? historyLimit : 20,
};

export default config;
