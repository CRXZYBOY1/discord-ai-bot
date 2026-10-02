import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from './config.js';
import { createMessageHandler } from './messageHandler.js';
import { handleInteraction, registerCommands } from './commands.js';
import { getModelIds } from './models.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // MessageContent เป็น Privileged Intent — ต้องเปิดใน Discord Developer Portal ด้วย (ดู README.md)
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ บอทออนไลน์แล้วในชื่อ ${c.user.tag}`);
  console.log(`   ตอบข้อความในช่อง: ${[...config.allowedChannelIds].join(', ')}`);
  console.log(`   โมเดล AI (ค่าเริ่มต้น): ${config.aiModel} (${config.aiBaseUrl})`);
  console.log('   พิมพ์ข้อความในช่องที่กำหนดเพื่อถาม AI หรือใช้คำสั่ง /model เพื่อเปลี่ยน model');

  // โหลดรายชื่อ model ไว้ล่วงหน้า ให้การค้นหาใน /model ตอบไวตั้งแต่ครั้งแรก
  getModelIds()
    .then((n) => console.log(`   พร้อมรายชื่อ model ${n} ตัวสำหรับคำสั่ง /model`))
    .catch((err) => console.log(`   ⚠️ ยังดึงรายชื่อ model ไม่ได้ (${err.message}) — จะลองใหม่เองเมื่อมีคนใช้คำสั่ง`));

  await registerCommands(client);
});

client.on(Events.MessageCreate, createMessageHandler());

client.on(Events.InteractionCreate, handleInteraction);

// เผื่อเอาบอทไปเพิ่มในเซิร์ฟเวอร์ใหม่ คำสั่ง /model ต้องลงทะเบียนด้วย
client.on(Events.GuildCreate, () => registerCommands(client));

client.on(Events.Error, (err) => {
  console.error('[Discord] client error:', err.message);
});

client.login(config.discordToken).catch((err) => {
  console.error(`\n❌ ล็อกอิน Discord ไม่สำเร็จ: ${err.message}`);
  console.error('   ตรวจสอบว่า DISCORD_TOKEN ในไฟล์ .env ถูกต้อง และเปิด Message Content Intent แล้ว\n');
  // รอให้ connection ที่ค้างปิดตัวก่อน ไม่งั้น libuv บน Windows จะ assert ตอนปิดโปรแกรม
  setTimeout(() => process.exit(1), 250);
});
