import config from './config.js';
import { askAI } from './ai.js';
import { getMessages, remember } from './memory.js';
import { getModel } from './settings.js';
import { log } from './logger.js';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB ต่อรูป
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;
const DEFAULT_IMAGE_PROMPT = 'ช่วยดูรูปที่แนบมาให้หน่อยครับ มีอะไรอยู่ในรูป อธิบายให้เข้าใจง่าย';

function isImageAttachment(attachment) {
  return (
    attachment.contentType?.startsWith('image/') ||
    IMAGE_EXTENSIONS.test(attachment.name ?? '')
  );
}

// ดาวน์โหลดรูปที่แนบมากับข้อความ แล้วแปลงเป็น data URI (base64)
// เพื่อแนบให้ AI แบบ multimodal — รองรับหลายรูปต่อข้อความ
export async function collectImages(message) {
  const imageAttachments = [...message.attachments.values()]
    .filter(isImageAttachment)
    .slice(0, MAX_IMAGES);

  const dataUris = [];

  for (const attachment of imageAttachments) {
    if (attachment.size > MAX_IMAGE_BYTES) {
      log.warn(`  ⚠️  ข้ามรูป ${attachment.name ?? attachment.id} (ใหญ่กว่า 8MB)`);
      continue;
    }
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`สถานะ ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const type = attachment.contentType || 'image/png';
      dataUris.push(`data:${type};base64,${buffer.toString('base64')}`);
    } catch (err) {
      log.warn(`  ⚠️  ดาวน์โหลดรูป ${attachment.name ?? attachment.id} ไม่สำเร็จ: ${err.message}`);
    }
  }

  return dataUris;
}

// สร้าง handler สำหรับ event MessageCreate
export function createMessageHandler() {
  return async function handleMessage(message) {
    // ข้ามข้อความจากบอทด้วยกันเอง และข้อความนอกเซิร์ฟเวอร์ (DM)
    if (message.author.bot || !message.guild) return;

    // ตอบเฉพาะช่องที่กำหนดไว้ใน ALLOWED_CHANNEL_IDS
    if (!config.allowedChannelIds.has(message.channel.id)) return;

    const text = message.content.trim();
    const images = await collectImages(message);

    // ไม่มีทั้งข้อความและรูป → ไม่ต้องตอบ
    if (!text && images.length === 0) return;

    const key = `${message.guildId}:${message.channel.id}`;

    // ขึ้นสถานะ "กำลังพิมพ์..." ระหว่างรอ AI (ถ้า AI ใช้เวลานานกว่า ~10 วิ สถานะจะหายไปเอง ไม่กระทบการทำงาน)
    await message.channel.sendTyping().catch(() => {});

    try {
      // ข้อความที่มีแต่รูป ใช้คำถามดีฟอลต์แทน
      const userText = text || DEFAULT_IMAGE_PROMPT;
      // ประวัติเก็บเฉพาะข้อความ ไม่เก็บ base64 รูป (กันหน่วยความจำบวม)
      const historyText = text || '[ผู้ใช้ส่งรูปภาพมาให้ดู]';

      const userContent =
        images.length > 0
          ? [
              { type: 'text', text: userText },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ]
          : userText;

      const messages = [
        { role: 'system', content: config.systemPrompt },
        ...getMessages(key),
        { role: 'user', content: userContent },
      ];

      // ใช้ model ที่ตั้งผ่าน /model ของเซิร์ฟเวอร์นี้ ถ้าไม่มีใช้ค่าเริ่มต้นจาก .env
      const model = getModel(message.guildId) ?? config.aiModel;
      const reply = await askAI(messages, model);

      // บันทึกเฉพาะเมื่อได้คำตอบสำเร็จ เพื่อไม่ให้คำถามค้างอยู่ในประวัติ
      remember(key, 'user', historyText);
      remember(key, 'assistant', reply);

      // split: true ช่วยแบงข้อความยาวเกิน 2,000 ตัวอักษรเป็นหลายข้อความให้อัตโนมัติ
      await message.channel.send({ content: reply, split: true });
    } catch (err) {
      log.error(`  ❌  [AI] ตอบช่อง ${message.channel.id} ไม่สำเร็จ: ${err.message}`);
      await message.channel
        .send('⚠️ ขออภัยครับ เกิดปัญหาในการเชื่อมต่อกับ AI ตอนนี้ ลองถามใหม่อีกครั้งนะครับ')
        .catch((sendErr) => log.error(`  ❌  ส่งข้อความแจ้งเตือนไม่สำเร็จ: ${sendErr.message}`));
    }
  };
}
