import config from './config.js';
import { reset as resetMemory } from './memory.js';
import { log } from './logger.js';

// ลบเธรดอัตโนมัติ: เธรดที่ไม่มีใครพิมพ์ต่อจนครบ THREAD_IDLE_DELETE_MINUTES นาที จะถูกลบทิ้ง
// พร้อมล้างความจำบทสนทนาของเธรดนั้นด้วย — ทุกข้อความของคนในเธรดจะเลื่อนเวลาลบออกไปใหม่
// ตั้ง THREAD_IDLE_DELETE_MINUTES=0 เพื่อปิดการลบเอง

const TIMER_MAX_MS = 2 ** 31 - 1; // เพดานของ setTimeout — เกินนี้ Node จะไฟร์ทันที
const timers = new Map(); // threadId -> Timeout

function scheduleDelete(thread, key, delayMs) {
  const existing = timers.get(thread.id);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(async () => {
    timers.delete(thread.id);
    try {
      // เธรดที่ถูก archive ไปก่อนแล้ว ต้องเปิดกลับมาถึงจะลบได้
      if (thread.archived) await thread.setArchived(false).catch(() => {});
      await thread.delete(`Discord AI Bot — ลบอัตโนมัติหลังไม่มีกิจกรรม ${config.threadIdleDeleteMinutes} นาที`);
      resetMemory(key);
      log.dim(`  🧹  ลบเธรด "${thread.name}" เพราะไม่มีกิจกรรม ${config.threadIdleDeleteMinutes} นาที`);
    } catch (err) {
      log.warn(`  ⚠️  ลบเธรด ${thread.id} ไม่สำเร็จ: ${err.message}`);
    }
  }, Math.min(delayMs, TIMER_MAX_MS));
  timeout.unref(); // ปิดบอทได้ทันที ไม่ต้องรอตัวจับเวลา
  timers.set(thread.id, timeout);
}

// เรียกทุกครั้งที่บอทสร้างเธรด หรือมีคนใช้งานในเธรด — เริ่มนับเวลาลบใหม่จากศูนย์
export function trackThreadActivity(thread, key) {
  if (config.threadIdleDeleteMinutes <= 0 || !thread?.isThread?.()) return;
  scheduleDelete(thread, key, config.threadIdleDeleteMinutes * 60 * 1000);
}

// ตัวจับเวลาอยู่แค่ในหน่วยความจำ รีสตาร์ทแล้วหายหมด — เดินหาเธรดที่ยังเปิดอยู่
// ในช่องที่กำหนด แล้วนับเวลาต่อจากข้อความล่าสุดของแต่ละเธรด
export async function restoreThreadTimers(client) {
  if (config.threadIdleDeleteMinutes <= 0) return;
  let restored = 0;

  for (const channelId of config.allowedChannelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased() || !channel.threads) continue;
      const { threads } = await channel.threads.fetchActive();

      for (const thread of threads.values()) {
        let lastActivity = thread.lastMessage?.createdTimestamp ?? 0;
        if (!lastActivity) {
          try {
            lastActivity =
              (await thread.messages.fetch({ limit: 1 })).first()?.createdTimestamp ?? thread.createdTimestamp;
          } catch {
            lastActivity = thread.createdTimestamp;
          }
        }
        const idleMs = Date.now() - lastActivity;
        const delayMs = Math.max(config.threadIdleDeleteMinutes * 60 * 1000 - idleMs, 5 * 1000);
        scheduleDelete(thread, `${thread.guildId}:${thread.id}`, delayMs);
        restored += 1;
      }
    } catch (err) {
      log.warn(`  ⚠️  ตั้งเวลาลบเธรดในช่อง ${channelId} ไม่สำเร็จ: ${err.message}`);
    }
  }

  if (restored > 0) log.dim(`  🧹  กลับมาจับเวลาลบเธรดที่ยังเปิดอยู่ ${restored} เธรด`);
}

// เธรดโดนลบเองก่อน (เช่น แอดมินลบมือ) — เคลียร์ตัวจับเวลาทิ้ง
export function forgetThread(threadId) {
  const timeout = timers.get(threadId);
  if (!timeout) return;
  clearTimeout(timeout);
  timers.delete(threadId);
}
