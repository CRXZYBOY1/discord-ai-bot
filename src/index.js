import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from './config.js';
import { createMessageHandler } from './messageHandler.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // MessageContent เป็น Privileged Intent — ต้องเปิดใน Discord Developer Portal ด้วย (ดู README.md)
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ บอทออนไลน์แล้วในชื่อ ${c.user.tag}`);
  console.log(`   ตอบข้อความในช่อง: ${[...config.allowedChannelIds].join(', ')}`);
  console.log(`   โมเดล AI: ${config.aiModel} (${config.aiBaseUrl})`);
  console.log('   พิมพ์ข้อความในช่องที่กำหนดเพื่อถาม AI ได้เลย');
});

client.on(Events.MessageCreate, createMessageHandler());

client.on(Events.Error, (err) => {
  console.error('[Discord] client error:', err.message);
});

client.login(config.discordToken).catch((err) => {
  console.error(`\n❌ ล็อกอิน Discord ไม่สำเร็จ: ${err.message}`);
  console.error('   ตรวจสอบว่า DISCORD_TOKEN ในไฟล์ .env ถูกต้อง และเปิด Message Content Intent แล้ว\n');
  // รอให้ connection ที่ค้างปิดตัวก่อน ไม่งั้น libuv บน Windows จะ assert ตอนปิดโปรแกรม
  setTimeout(() => process.exit(1), 250);
});
