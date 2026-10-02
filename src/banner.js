// หน้าจอสรุปสถานะที่พิมพ์ตอนบอทออนไลน์
import config from './config.js';
import { getCachedModelIds } from './models.js';
import { log, paint } from './logger.js';

export function printStartupBanner(client) {
  log.rule('━');
  log.info(paint('1;96', '  🤖  DISCORD AI BOT'));
  log.info(paint('90', '  บอทถาม-ตอบด้วย AI สำหรับเซิร์ฟเวอร์ Discord'));
  log.rule('━');
  log.item('🏷️', 'ชื่อบอท', paint('1', client.user.tag));
  log.item('💬', 'ตอบข้อความในช่อง', paint('96', [...config.allowedChannelIds].join(', ')));
  log.item('🧠', 'โมเดลเริ่มต้น', paint('95', config.aiModel));
  log.item('🌐', 'AI Server', paint('90', config.aiBaseUrl));
  log.item('📚', 'model ในแคช', `${getCachedModelIds().length.toLocaleString('en-US')} ตัว`);
  log.item('🧵', 'โหมดเธรด', config.threadMode ? 'เปิด (แยกเธรดต่อคำถาม)' : 'ปิด');
  log.item('⏱️', 'กันสแปม', `${config.cooldownSeconds} วิ/คำถาม • ${config.imageCooldownSeconds} วิ//draw`);
}
