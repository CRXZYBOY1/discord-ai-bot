// กล่องคำตอบแบบ embed ของ Discord พร้อมตัดข้อความยาวเป็นหลายกล่อง
import { EmbedBuilder } from 'discord.js';
import config from './config.js';

const MAX_EMBED_TEXT = 4000; // Discord จำกัด 4,096 — เผื่อมาร์จิ้นไว้
const MAX_EMBEDS = 10; // Discord จำกัด 10 embeds ต่อ 1 ข้อความ

export function buildAnswerEmbed(text, model, partNote) {
  return new EmbedBuilder()
    .setColor(Number.parseInt(config.embedColor, 16) || 0x5865f2)
    .setDescription(text)
    .setFooter({ text: partNote ? `🧠 ${model} • ${partNote}` : `🧠 ${model}` })
    .setTimestamp();
}

export function answerEmbeds(text, model) {
  const chunks = splitAnswer(text);
  return chunks.map((chunk, i) =>
    buildAnswerEmbed(chunk, model, chunks.length > 1 ? `ส่วนที่ ${i + 1}/${chunks.length}` : undefined)
  );
}

// กล่องแดงแจ้งว่าเชื่อมต่อ AI ไม่ได้ พร้อมสาเหตุที่วิเคราะห์ได้
export function buildErrorEmbed(reason, model) {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⚠️ เชื่อมต่อ AI ไม่สำเร็จ')
    .setDescription(`**สาเหตุที่พบ:** ${reason}\n\nกรุณาลองอีกครั้งภายหลัง หากยังมีปัญหาให้ตรวจสอบการตั้งค่า AI หรือแจ้งผู้ดูแลเซิร์ฟเวอร์`)
    .setTimestamp();

  if (model) embed.setFooter({ text: `🧠 model: ${model}` });
  return embed;
}

// ตัดที่ขึ้นบรรทัดใหม่ก่อนเสมอ เพื่อไม่ให้ข้อความ/โค้ดขาดกลางคำมากที่สุด
export function splitAnswer(text) {
  if (text.length <= MAX_EMBED_TEXT) return [text];

  const chunks = [];
  let rest = text;
  while (rest.length > MAX_EMBED_TEXT && chunks.length < MAX_EMBEDS) {
    let cut = rest.lastIndexOf('\n', MAX_EMBED_TEXT);
    if (cut < MAX_EMBED_TEXT / 2) cut = MAX_EMBED_TEXT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (chunks.length >= MAX_EMBEDS) {
    chunks.push(`${rest}\n… (ข้อความยาวมาก แสดงได้สุด ${MAX_EMBEDS} ส่วน)`);
  } else if (rest) {
    chunks.push(rest);
  }
  return chunks;
}
