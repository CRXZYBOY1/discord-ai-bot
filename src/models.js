// ดึงรายชื่อ model จาก AI server พร้อมแคชไว้ 5 นาที
// กันการยิง /models ทุกครั้งที่ผู้ใช้พิมพ์ค้นหาใน autocomplete
import config from './config.js';

const CACHE_TTL = 5 * 60 * 1000;
let cache = { ids: [], fetchedAt: 0 };

export async function getModelIds() {
  if (cache.ids.length > 0 && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.ids;
  }

  const res = await fetch(`${config.aiBaseUrl}/models`, {
    headers: { Authorization: `Bearer ${config.aiApiKey}` },
  });
  if (!res.ok) {
    throw new Error(`AI server ตอบด้วยสถานะ ${res.status}`);
  }

  const { data } = await res.json();
  cache = {
    ids: data.map((m) => m.id).sort((a, b) => a.localeCompare(b)),
    fetchedAt: Date.now(),
  };
  return cache.ids;
}
