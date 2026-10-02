import config from './config.js';

// ส่งบทสนทนาไปถาม AI ผ่าน endpoint /chat/completions (มาตรฐานเดียวกับ OpenAI)
export async function askAI(messages) {
  const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel,
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

  let reply = '';
  const text = await res.text();
  try {
    reply = extractReply(text);
  } catch {
    reply = '';
  }

  if (!reply) {
    throw new Error(`AI API ไม่ส่งคำตอบกลับมาในรูปแบบที่คาดไว้ เนื้อหาที่ได้: ${text.slice(0, 200)}`);
  }
  return reply;
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
