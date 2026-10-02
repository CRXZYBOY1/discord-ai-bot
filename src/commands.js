import { MessageFlags } from 'discord.js';
import * as modelCommand from './commands/model.js';

// ลงทะเบียน slash command ให้ทุกเซิร์ฟเวอร์ที่บอทอยู่
// (แบบ per-guild เพื่อให้คำสั่งโผล่ทันที ไม่ต้องรอ propagation แบบ global)
export async function registerCommands(client) {
  const json = [modelCommand.data.toJSON()];
  let ok = 0;

  for (const guild of client.guilds.cache.values()) {
    try {
      await client.application.commands.set(json, guild.id);
      ok += 1;
    } catch (err) {
      console.error(`\n⚠️ ลงทะเบียนคำสั่ง /model ในเซิร์ฟเวอร์ ${guild.id} ไม่สำเร็จ: ${err.message}`);
      if (err.status === 403) {
        console.error('   เป็นเพราะบอทถูกเชิญโดยไม่มีสิทธิ์ applications.commands — วิธีแก้:');
        console.error('   ไปที่ OAuth2 > URL Generator ติ๊ก scope ทั้ง bot และ applications.commands แล้วเชิญบอทซ้ำ (ดู README.md ขั้นตอน 2)');
        console.error('   บอทยังตอบคำถามปกติทุกอย่าง มีแต่คำสั่ง /model ที่ยังใช้ไม่ได้\n');
      }
    }
  }

  if (ok > 0) {
    console.log(`   ลงทะเบียนคำสั่ง /model ใน ${ok} เซิร์ฟเวอร์เรียบร้อย`);
  }
}

export async function handleInteraction(interaction) {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === 'model') {
      return await modelCommand.autocomplete(interaction);
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'model') {
      return await modelCommand.execute(interaction);
    }
  } catch (err) {
    console.error('[คำสั่ง /model] เกิดข้อผิดพลาด:', err.message);

    if (interaction.isAutocomplete()) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    const payload = {
      content: '⚠️ เกิดข้อผิดพลาดกับคำสั่งนี้ ลองใหม่อีกครั้งนะครับ',
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}
