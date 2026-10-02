import config from './config.js';
import { askAI } from './ai.js';
import { getMessages, remember } from './memory.js';
import { getModel } from './settings.js';
import { log } from './logger.js';

// สร้าง handler สำหรับ event MessageCreate
export function createMessageHandler() {
  return async function handleMessage(message) {
    // ข้ามข้อความจากบอทด้วยกันเอง และข้อความนอกเซิร์ฟเวอร์ (DM)
    if (message.author.bot || !message.guild) return;

    // ตอบเฉพาะช่องที่กำหนดไว้ใน ALLOWED_CHANNEL_IDS
    if (!config.allowedChannelIds.has(message.channel.id)) return;

    const content = message.content.trim();
    if (!content) return;

    const key = `${message.guildId}:${message.channel.id}`;

    // ขึ้นสถานะ "กำลังพิมพ์..." ระหว่างรอ AI (ถ้า AI ใช้เวลานานกว่า ~10 วิ สถานะจะหายไปเอง ไม่กระทบการทำงาน)
    await message.channel.sendTyping().catch(() => {});

    try {
      const messages = [
        { role: 'system', content: config.systemPrompt },
        ...getMessages(key),
        { role: 'user', content },
      ];

      // ใช้ model ที่ตั้งผ่าน /model ของเซิร์ฟเวอร์นี้ ถ้าไม่มีใช้ค่าเริ่มต้นจาก .env
      const model = getModel(message.guildId) ?? config.aiModel;
      const reply = await askAI(messages, model);

      // บันทึกเฉพาะเมื่อได้คำตอบสำเร็จ เพื่อไม่ให้คำถามค้างอยู่ในประวัติ
      remember(key, 'user', content);
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
