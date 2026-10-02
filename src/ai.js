import config from './config.js';

// ส่งบทสนทนาไปถาม AI ผ่าน endpoint /chat/completions (มาตรฐานเดียวกับ OpenAI)
// ถ้าไม่ระบุ model จะใช้ค่าเริ่มต้นจาก .env
// คืนค่า { reply, usage } — usage อาจเป็น null ถ้า server ไม่ส่งมา
export async function askAI(messages, model = config.aiModel) {
  const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      // ขอ JSON ชุดเดียวจบ — server/proxy บางตัวตอบเป็น stream เป็นค่าเริ่มต้น
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    const err = new Error(`AI API ตอบกลับด้วยสถานะ ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }

  const text = await res.text();
  let reply = '';
  let usage = null;
  try {
    reply = extractReply(text);
    usage = extractUsage(text);
  } catch {
    reply = '';
  }

  if (!reply) {
    throw new Error(`AI API ไม่ส่งคำตอบกลับมาในรูปแบบที่คาดไว้ เนื้อหาที่ได้: ${text.slice(0, 200)}`);
  }
  return { reply, usage };
}

// แปล error จากการเรียก AI เป็นคำอธิบายสาเหตุภาษาไทย สำหรับแจ้งผู้ใช้ใน Discord
export function describeAIError(err) {
  // กรณี server ตอบกลับด้วยรหัส HTTP
  if (err?.status) {
    const statusMap = {
      400: 'คำขอไม่ถูกต้อง — ส่วนใหญ่เกิดจากชื่อ model ไม่มีอยู่จริง (ตรวจ `AI_MODEL` หรือเปลี่ยนผ่าน /model)',
      401: 'API key ไม่ถูกต้อง — ตรวจสอบ `AI_API_KEY` ในไฟล์ .env',
      403: 'ถูกปฏิเสธการเข้าถึง — API key อาจไม่มีสิทธิ์ใช้ model นี้',
      404: 'ไม่พบ endpoint หรือ model — ตรวจ `AI_BASE_URL` (ส่วนใหญ่ต้องลงท้ายด้วย /v1) หรือชื่อ model ไม่มีอยู่',
      408: 'AI server ตอบช้าเกินกำหนด (timeout) — ลองใหม่อีกครั้ง',
      429: 'โดนจำกัดการใช้งาน (rate limit) — AI server ยุ่งหรือใช้เกินโควตา รอสักครู่แล้วลองใหม่',
      500: 'AI server ขัดข้องภายใน (500) — รอสักครู่แล้วลองใหม่',
      502: 'AI server ขัดข้อง (502) — ตัวกลาง/ผู้ให้บริการมีปัญหา รอแล้วลองใหม่',
      503: 'AI server ไม่พร้อมใช้งาน (503) — อาจกำลังปิดปรับปรุงหรือ provider ล่ม รอแล้วลองใหม่',
    };
    return statusMap[err.status] ?? `AI server ตอบกลับด้วยสถานะ ${err.status}`;
  }

  // กรณีเชื่อมต่อไม่สำเร็จตั้งแต่ระดับเครือข่าย (fetch failed + cause code)
  const code = err?.cause?.code ?? '';
  const networkMap = {
    UND_ERR_CONNECT_TIMEOUT: 'เชื่อมต่อ AI server ไม่ได้ (หมดเวลา) — server อาจล่มหรือออฟไลน์อยู่',
    ETIMEDOUT: 'เชื่อมต่อ AI server ไม่ได้ (หมดเวลา) — server อาจล่มหรือเครือข่ายมีปัญหา',
    ECONNREFUSED: 'AI server ปฏิเสธการเชื่อมต่อ — ตรวจว่า IP:พอร์ต ใน `AI_BASE_URL` ถูกต้องและ server เปิดอยู่',
    ENOTFOUND: 'ไม่พบ host ที่ระบุ — ตรวจสอบที่อยู่ใน `AI_BASE_URL`',
    ECONNRESET: 'การเชื่อมต่อถูกตัดกลางคัน — server หรือเครือข่ายไม่เสถียร',
    EAI_AGAIN: 'แปลงชื่อ host ไม่สำเร็จ — ตรวจอินเทอร์เน็ตหรือ `AI_BASE_URL`',
    CERT_HAS_EXPIRED: 'ใบรับรอง (SSL) ของ AI server หมดอายุ',
  };
  if (code && networkMap[code]) return networkMap[code];

  if (/fetch failed/i.test(err?.message ?? '')) {
    return 'เชื่อมต่อ AI server ไม่ได้ — server อาจล่ม/ออฟไลน์ หรือ `AI_BASE_URL` ไม่ถูกต้อง';
  }

  return (err?.message ?? 'ข้อผิดพลาดไม่ทราบสาเหตุ').slice(0, 200);
}

// แยกคำตอบจาก response รองรับทั้ง JSON ปกติและ SSE (บาง server ตอบเป็น stream
// แบบ "data: {...}" ต่อกันหลายชิ้น แม้จะสั่ง stream: false ไปแล้ว)
function extractReply(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('data:')) {
    let full = '';
    for (const line of trimmed.split('\n')) {
      const payload = line.trim();
      if (!payload.startsWith('data:')) continue;
      const json = payload.slice(5).trim();
      if (json === '[DONE]') continue;
      try {
        const data = JSON.parse(json);
        const piece = data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? '';
        full += piece;
      } catch {
        // ข้ามบรรทัดที่ parse ไม่ได้
      }
    }
    return full.trim();
  }

  const data = JSON.parse(trimmed);
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ดึงข้อมูล usage (จำนวน token) — ไม่มีก็คืน null
function extractUsage(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('data:')) {
    for (const line of trimmed.split('\n').reverse()) {
      const payload = line.trim();
      if (!payload.startsWith('data:')) continue;
      const json = payload.slice(5).trim();
      if (json === '[DONE]') continue;
      try {
        const usage = JSON.parse(json)?.usage;
        if (usage) return usage;
      } catch {
        // ข้ามบรรทัดที่ parse ไม่ได้
      }
    }
    return null;
  }

  try {
    return JSON.parse(trimmed)?.usage ?? null;
  } catch {
    return null;
  }
}
