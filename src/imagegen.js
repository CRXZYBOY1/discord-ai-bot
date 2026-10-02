// สร้างรูปจากข้อความ (/draw) — รองรับ 2 วิธีตามที่ server รองรับ:
// 1) image model ผ่าน /chat/completions → รูปกลับมาเป็น markdown (URL หรือ base64 ในตัว)
// 2) endpoint /images/generations มาตรฐาน OpenAI (สำหรับ server ที่เปิดใช้)
import config from './config.js';
import { askAI } from './ai.js';
import { recordHealth } from './model-health.js';

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)/;

// คืน { buffer, model } — buffer พร้อมนำไปส่งเป็นไฟล์ใน Discord
export async function generateImage(prompt, model = config.imageModel) {
  const errors = [];

  // วิธีที่ 1: image model ผ่าน chat
  try {
    const { reply } = await askAI([{ role: 'user', content: prompt }], model);
    recordHealth(model, true);
    const match = MARKDOWN_IMAGE.exec(reply);
    if (match) {
      return await toImageBuffer(match[1], model);
    }
    errors.push(`model ตอบกลับแต่ไม่มีรูป ("${reply.slice(0, 80)}…")`);
  } catch (err) {
    recordHealth(model, false, err.message);
    errors.push(err.message.slice(0, 150));
  }

  // วิธีที่ 2: endpoint /images/generations
  try {
    const res = await fetch(`${config.aiBaseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.aiApiKey}` },
      body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024' }),
    });
    if (res.ok) {
      const data = await res.json();
      const item = data?.data?.[0];
      if (item?.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), model };
      if (item?.url) return await toImageBuffer(item.url, model);
      errors.push('images/generations ตอบกลับแต่ไม่มีรูป');
    } else {
      errors.push(`images/generations สถานะ ${res.status}`);
    }
  } catch (err) {
    errors.push(err.message.slice(0, 150));
  }

  throw new Error(`สร้างรูปไม่สำเร็จ — ${errors.join(' | ')}`);
}

async function toImageBuffer(source, model) {
  if (source.startsWith('data:')) {
    const base64 = source.slice(source.indexOf(',') + 1);
    return { buffer: Buffer.from(base64, 'base64'), model };
  }

  const res = await fetch(source);
  if (!res.ok) throw new Error(`ดาวน์โหลดรูปไม่สำเร็จ (สถานะ ${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), model };
}

// เดานามสกุลไฟล์จาก magic bytes เพื่อตั้งชื่อไฟล์ใน Discord ให้ถูกประเภท
export function imageExtension(buffer) {
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer.length > 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF') return 'webp';
  return 'png';
}
