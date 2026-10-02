// สุขภาพของ model: เรียนรู้จากการใช้งานจริงและการทดสอบ แล้วบันทึกลง data/model-health.json
// ใช้กรอง model ที่พังออกจากการค้นหา และแสดงสถานะตอนเปลี่ยน model
// หมายเหตุ: ไม่ probe ทั้งพัน model เพราะจะยิง AI server หนักโดยใช่เรื่อง
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../data/model-health.json', import.meta.url));
// model ที่พังจะถูกมองว่ากลับมาใช้ได้ไหม หลังผ่านไปเท่านี้ (router สถานะเปลี่ยนบ่อย)
export const FAIL_WINDOW_MS = 30 * 60 * 1000;

let data = {};
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  data = {};
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// บันทึกผลการใช้งาน/ทดสอบของ model หนึ่งตัว
export function recordHealth(model, ok, reason = null) {
  if (!model) return;
  data[model] = {
    status: ok ? 'ok' : 'fail',
    checkedAt: Date.now(),
    reason: ok ? null : String(reason ?? '').slice(0, 200),
  };
  save();
}

// model ถือว่า "น่าใช้" ถ้าไม่มีประวัติพังล่าสุดภายในช่วงเวลาที่กำหนด
export function isModelHealthy(model) {
  const h = data[model];
  if (!h || h.status === 'ok') return true;
  return Date.now() - h.checkedAt > FAIL_WINDOW_MS;
}

export function getHealth(model) {
  return data[model] ?? null;
}

// อธิบายสถานะเป็นข้อความสั้น ๆ สำหรับแสดงใน /model show
export function describeHealth(model) {
  const h = getHealth(model);
  if (!h) return '⚪ ยังไม่มีข้อมูลทดสอบ/ใช้งานล่าสุด';
  const minutes = Math.max(0, Math.round((Date.now() - h.checkedAt) / 60000));
  return h.status === 'ok'
    ? `✅ ใช้ได้ (ตรวจล่าสุด ${minutes} นาทีก่อน)`
    : `❌ พังล่าสุด ${minutes} นาทีก่อน — ${h.reason ?? 'ไม่ทราบสาเหตุ'}`;
}
