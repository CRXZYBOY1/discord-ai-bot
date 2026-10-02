// กันสแปม: จำกัดความถี่การใช้งานต่อคน แยกตามประเภท (message/ask/draw)
// และตรวจว่าคนนั้นกำลังรอคำตอบค้างอยู่ไหม กันส่งคำถามซ้อนกัน
const lastUsed = new Map();
const busy = new Set();

// คืนจำนวนวินาทีที่ต้องรอ (0 = ใช้ได้) และจดบันทึกเวลาทันทีถ้าใช้ได้
export function checkCooldown(kind, userId, seconds) {
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const remainMs = (lastUsed.get(key) ?? 0) + seconds * 1000 - now;
  if (remainMs > 0) return Math.ceil(remainMs / 1000);
  lastUsed.set(key, now);
  return 0;
}

export function isBusy(userId) {
  return busy.has(userId);
}

export function setBusy(userId) {
  busy.add(userId);
}

export function clearBusy(userId) {
  busy.delete(userId);
}
