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
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    const err = new Error(`AI API ตอบกลับด้วยสถานะ ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error('AI API ไม่ส่งคำตอบกลับมา (โครงสร้าง response ไม่ตรงรูปแบบที่คาดไว้)');
  }
  return reply;
}
