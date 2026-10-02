import { PermissionFlagsBits } from 'discord.js';
import config from './config.js';
import { askAI, describeAIError } from './ai.js';
import { getMessages, remember } from './memory.js';
import { getModel } from './settings.js';
import { log } from './logger.js';
import { answerEmbeds, buildErrorEmbed } from './embed.js';
import { checkCooldown, isBusy, setBusy, clearBusy } from './cooldown.js';
import { recordUsage } from './usage.js';
import { collectDocuments } from './documents.js';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB ต่อรูป
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;
const DEFAULT_IMAGE_PROMPT = 'ช่วยดูรูปที่แนบมาให้หน่อยครับ มีอะไรอยู่ในรูป อธิบายให้เข้าใจง่าย';
const DEFAULT_DOC_PROMPT = 'ช่วยสรุปเนื้อหาสำคัญในเอกสารที่แนบมาให้หน่อยครับ';
const THREAD_ARCHIVE_MINUTES = 1440; // ซ่อนเธรดอัตโนมัติหลังไม่มีคนพิมพ์ 1 วัน
const NOTICE_INTERVAL_MS = 30 * 1000; // แจ้งเตือน anti-spam ไม่บ่อยกว่านี้
const MESSAGE_LINK = /https?:\/\/(?:[a-z]+\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/gi;

const lastNotice = new Map();

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

// เก็บบริบทเพิ่มจากข้อความที่ผู้ใช้ reply ถึง และลิงก์ข้อความ Discord ที่แปะมา
async function collectContext(message) {
  const parts = [];

  const ref = message.reference;
  if (ref?.messageId) {
    try {
      const target =
        ref.channelId && ref.channelId !== message.channel.id
          ? await message.guild.channels.fetch(ref.channelId).then((c) => c.messages.fetch(ref.messageId))
          : await message.channel.messages.fetch(ref.messageId);
      const content = target?.content?.trim().slice(0, 500);
      if (content) {
        parts.push(`[ผู้ใช้กำลังตอบกลับข้อความของ ${target.author.username}: "${content}"]`);
      }
    } catch {
      // ข้อความถูกลบ/ไม่มีสิทธิ์อ่าน — ข้ามไป
    }
  }

  let linked = 0;
  for (const match of message.content.matchAll(MESSAGE_LINK)) {
    if (linked >= 3) break;
    const [, , channelId, messageId] = match;
    try {
      const target =
        channelId === message.channel.id
          ? await message.channel.messages.fetch(messageId)
          : await message.guild.channels.fetch(channelId).then((c) => c.messages.fetch(messageId));
      const content = target?.content?.trim().slice(0, 500);
      if (content) {
        parts.push(`[ลิงก์ข้อความจาก ${target.author.username}: "${content}"]`);
        linked += 1;
      }
    } catch {
      // ลิงก์เสีย/ไม่มีสิทธิ์ — ข้ามไป
    }
  }

  return parts;
}

function noticeCooldown(message, waitSeconds) {
  const now = Date.now();
  const last = lastNotice.get(message.author.id) ?? 0;
  if (now - last < NOTICE_INTERVAL_MS) return; // แจ้งบ่อยเกินจะกลายเป็นสแปมเอง
  lastNotice.set(message.author.id, now);
  const text =
    waitSeconds > 0
      ? `⏳ ${message.author} ถามเร็วไปนิดนึง รออีก ${waitSeconds} วินาทีนะ`
      : `⏳ ${message.author} ยังรอคำตอบก่อนหน้าอยู่ ใจเย็น ๆ นะ`;
  message.reply(text).catch(() => {});
}

// สร้าง handler สำหรับ event MessageCreate
export function createMessageHandler() {
  return async function handleMessage(message) {
    // ข้ามข้อความจากบอทด้วยกันเอง และข้อความนอกเซิร์ฟเวอร์ (DM)
    if (message.author.bot || !message.guild) return;

    const channel = message.channel;
    const isThread = channel.isThread();
    const channelAllowed = config.allowedChannelIds.has(channel.id);
    const parentAllowed = isThread && config.allowedChannelIds.has(channel.parentId);

    // ตอบเฉพาะช่องที่กำหนด และเธรดที่ผูกกับช่องที่กำหนด
    if (isThread ? !parentAllowed && !channelAllowed : !channelAllowed) return;

    const text = message.content.trim();
    const images = await collectImages(message);
    const documents = await collectDocuments(message);
    if (!text && images.length === 0 && documents.length === 0) return;

    // กันสแปม (ผู้ดูแลเซิร์ฟเวอร์ไม่โดนจำกัด)
    const canBypass = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    if (!canBypass) {
      const wait = checkCooldown('message', message.author.id, config.cooldownSeconds);
      if (wait > 0) return noticeCooldown(message, wait);
      if (isBusy(message.author.id)) return noticeCooldown(message, 0);
    }

    // บริบทจาก reply / ลิงก์ข้อความ
    const contextParts = await collectContext(message);

    // โหมดเธรด: คำถามในช่องหลัก → เปิดเธรดใหม่แยกให้แต่ละคำถาม
    let target = channel;
    let key = `${message.guildId}:${channel.id}`;
    if (!isThread && config.threadMode && channelAllowed) {
      try {
        target = await message.startThread({
          name: (text || 'คำถามพร้อมรูปภาพ').slice(0, 80),
          autoArchiveDuration: THREAD_ARCHIVE_MINUTES,
          reason: 'Discord AI Bot — แยกคำถามเป็นเธรด',
        });
        key = `${message.guildId}:${target.id}`;
      } catch (err) {
        log.warn(`  ⚠️  สร้างเธรดไม่สำเร็จ (${err.message}) — ตอบในช่องเดิม`);
      }
    }

    // ขึ้นสถานะ "กำลังพิมพ์..." ระหว่างรอ AI (ถ้า AI ใช้เวลานานกว่า ~10 วิ สถานะจะหายไปเอง ไม่กระทบการทำงาน)
    await target.sendTyping().catch(() => {});

    // ใช้ model ที่ตั้งผ่าน /model ของเซิร์ฟเวอร์นี้ ถ้าไม่มีใช้ค่าเริ่มต้นจาก .env
    const model = getModel(message.guildId) ?? config.aiModel;

    try {
      setBusy(message.author.id);

      // ข้อความที่มีแต่รูป/เอกสาร ใช้คำถามดีฟอลต์แทน
      let userText = text || (images.length > 0 ? DEFAULT_IMAGE_PROMPT : DEFAULT_DOC_PROMPT);

      // ประกอบบริบทเสริม: ข้อความที่ reply/ลิงก์มา + เนื้อหาเอกสารแนบ
      const prefix = [];
      if (contextParts.length > 0) prefix.push(contextParts.join('\n'));
      if (documents.length > 0) {
        prefix.push(documents.map((d) => `[เอกสารแนบ: ${d.name}]\n${d.content}`).join('\n\n'));
      }
      if (prefix.length > 0) userText = `${prefix.join('\n\n')}\n\nคำถาม: ${userText}`;

      // ประวัติเก็บเฉพาะข้อความ ไม่เก็บ base64 รูป/เนื้อหาเอกสาร (กันหน่วยความจำบวม)
      const historyText = text || '[ผู้ใช้ส่งไฟล์แนบมาให้ดู]';

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
      const { reply, usage } = await askAI(messages, model);

      // บันทึกเฉพาะเมื่อได้คำตอบสำเร็จ เพื่อไม่ให้คำถามค้างอยู่ในประวัติ
      remember(key, 'user', historyText);
      remember(key, 'assistant', reply);
      recordUsage(message.guildId, message.author.id, model, usage);

      // ตอบเป็น embed ในเธรด/ช่องปลายทาง
      await target.send({ embeds: answerEmbeds(reply, model) });
    } catch (err) {
      log.error(`  ❌  [AI] ตอบช่อง ${channel.id} ไม่สำเร็จ: ${err.message}`);
      // แจ้งผู้ใช้ใน Discord พร้อมสาเหตุที่วิเคราะห์ได้
      await target
        .send({ embeds: [buildErrorEmbed(describeAIError(err), model)] })
        .catch((sendErr) => log.error(`  ❌  ส่งข้อความแจ้งเตือนไม่สำเร็จ: ${sendErr.message}`));
    } finally {
      clearBusy(message.author.id);
    }
  };
}
