import config from './config.js';

// เก็บประวัติบทสนทนาแยกตามช่อง (in-memory — หายเมื่อรีสตาร์ทบอท)
const histories = new Map();

function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

// บันทึกข้อความของช่องนั้น โดยตัดข้อความเก่าทิ้งถ้าเกิน HISTORY_LIMIT
export function remember(key, role, content) {
  const history = getHistory(key);
  history.push({ role, content });
  while (history.length > config.historyLimit) {
    history.shift();
  }
}

export function getMessages(key) {
  return getHistory(key);
}

export function reset(key) {
  histories.delete(key);
}
