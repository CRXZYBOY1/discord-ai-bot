import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from './config.js';
import { createMessageHandler } from './messageHandler.js';
import { handleInteraction, registerCommands } from './commands.js';
import { getCachedModelIds, refreshModelIds } from './models.js';
import { log, paint } from './logger.js';
import { printStartupBanner } from './banner.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // MessageContent เป็น Privileged Intent — ต้องเปิดใน Discord Developer Portal ด้วย (ดู README.md)
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  printStartupBanner(c);

  await registerCommands(c);

  // ดึงรายชื่อ model ล่าสุดเบื้องหลัง — ไม่บล็อกการเริ่มทำงาน
  refreshModelIds()
    .then((ids) => log.success(`  📚  อัพเดตรายชื่อ model ล่าสุดจาก server แล้ว ${ids.length.toLocaleString('en-US')} ตัว`))
    .catch(() => {
      const cached = getCachedModelIds().length;
      log.warn(
        cached > 0
          ? `  ⚠️  AI server ไม่ตอบตอนนี้ — ใช้รายชื่อจากแคชเดิม ${cached.toLocaleString('en-US')} ตัวต่อไป`
          : '  ⚠️  ยังไม่มีรายชื่อ model (AI server ไม่ตอบ) — จะลองใหม่อัตโนมัติเมื่อมีคนใช้ /model'
      );
    });

  log.rule('━');
  log.success('  🎉  พร้อมใช้งาน! พิมพ์ข้อความในช่องที่กำหนดเพื่อถาม AI');
  log.dim('  ⌨️   คำสั่ง: /model set • /model show • /model reset');
  log.rule('━');
});

client.on(Events.MessageCreate, createMessageHandler());

client.on(Events.InteractionCreate, handleInteraction);

// เผื่อเอาบอทไปเพิ่มในเซิร์ฟเวอร์ใหม่ คำสั่ง /model ต้องลงทะเบียนด้วย
client.on(Events.GuildCreate, () => registerCommands(client));

client.on(Events.Error, (err) => {
  log.error(`  💥  [Discord] client error: ${err.message}`);
});

client.login(config.discordToken).catch((err) => {
  log.error('');
  log.error(`  ❌  ล็อกอิน Discord ไม่สำเร็จ: ${err.message}`);
  log.error('  ตรวจสอบว่า DISCORD_TOKEN ในไฟล์ .env ถูกต้อง และเปิด Message Content Intent แล้ว');
  log.error('');
  // รอให้ connection ที่ค้างปิดตัวก่อน ไม่งั้น libuv บน Windows จะ assert ตอนปิดโปรแกรม
  setTimeout(() => process.exit(1), 250);
});
