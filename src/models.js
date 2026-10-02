// รายชื่อ model ถูกแคชไว้ทั้งในหน่วยความจำและไฟล์ data/models-cache.json
// เพราะ Discord จำกัด autocomplete ให้ตอบภายใน ~3 วินาที การไปดึงจาก AI server
// สด ๆ ทุกครั้งจะช้าเกินกำหนดเมื่อ server ล้าหรือล่ม จึงตอบจากแคชทันที
// แล้วค่อยรีเฟรชเบื้องหลังเมื่อ server ตอบได้
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';

const CACHE_FILE = fileURLToPath(new URL('../data/models-cache.json', import.meta.url));
const STALE_TTL = 10 * 60 * 1000;

let memoryIds = null;
let fetchedAt = 0;
let inflight = null;

function readDiskCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Array.isArray(parsed.ids) && parsed.ids.length > 0) {
      return { ids: parsed.ids, fetchedAt: parsed.fetchedAt ?? 0 };
    }
  } catch {
    // ยังไม่มีไฟล์แคช หรือไฟล์เสียหาย — ถือว่าไม่มีข้อมูล
  }
  return { ids: [], fetchedAt: 0 };
}

function saveToDisk(ids, timestamp) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: timestamp, ids }, null, 2), 'utf8');
}

// รายชื่อที่ตอบได้ทันทีโดยไม่ต้องรอเน็ต (หน่วยความจำ → ไฟล์)
export function getCachedModelIds() {
  if (memoryIds === null) {
    const disk = readDiskCache();
    memoryIds = disk.ids;
    fetchedAt = disk.fetchedAt;
  }
  return memoryIds;
}

export function isCacheStale() {
  getCachedModelIds();
  return memoryIds.length === 0 || Date.now() - fetchedAt > STALE_TTL;
}

// ดึงรายชื่อใหม่จาก AI server — ใช้เวลาได้ ห้าม await ใน autocomplete
// (single-flight: ถ้ามีคนเรียกค้างอยู่ รอใช้ผลเดียวกัน ไม่ยิงซ้อน)
export async function refreshModelIds() {
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(`${config.aiBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
    });
    if (!res.ok) {
      throw new Error(`AI server ตอบด้วยสถานะ ${res.status}`);
    }
    const { data } = await res.json();
    memoryIds = data.map((m) => m.id).sort((a, b) => a.localeCompare(b));
    fetchedAt = Date.now();
    saveToDisk(memoryIds, fetchedAt);
    return memoryIds;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
