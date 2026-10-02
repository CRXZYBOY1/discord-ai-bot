import { MessageFlags } from 'discord.js';
import * as modelCommand from './commands/model.js';
import * as resetCommand from './commands/reset.js';
import * as askCommand from './commands/ask.js';
import * as usageCommand from './commands/usage.js';
import * as drawCommand from './commands/draw.js';
import { log } from './logger.js';

// ทะเบียนคำสั่ง slash ทั้งหมดของบอท
const COMMANDS = [modelCommand, resetCommand, askCommand, usageCommand, drawCommand];

// ลงทะเบียน slash command ให้ทุกเซิร์ฟเวอร์ที่บอทอยู่
// (แบบ per-guild เพื่อให้คำสั่งโผล่ทันที ไม่ต้องรอ propagation แบบ global)
export async function registerCommands(client) {
  const json = COMMANDS.map((cmd) => cmd.data.toJSON());
  let ok = 0;

  for (const guild of client.guilds.cache.values()) {
    try {
      await client.application.commands.set(json, guild.id);
      ok += 1;
    } catch (err) {
      log.error(`  ❌  ลงทะเบียนคำสั่งในเซิร์ฟเวอร์ ${guild.id} ไม่สำเร็จ: ${err.message}`);
      if (err.status === 403) {
        log.warn('     เป็นเพราะบอทถูกเชิญโดยไม่มีสิทธิ์ applications.commands — วิธีแก้:');
        log.warn('     ไปที่ OAuth2 > URL Generator ติ๊ก scope ทั้ง bot และ applications.commands แล้วเชิญบอทซ้ำ (ดู README.md ขั้นตอน 2)');
        log.warn('     บอทยังตอบคำถามปกติทุกอย่าง มีแต่คำสั่ง slash ที่ยังใช้ไม่ได้');
      }
    }
  }

  if (ok > 0) {
    log.success(`  ⚡  ลงทะเบียนคำสั่ง /${COMMANDS.map((c) => c.data.name).join(' • /')} แล้ว (${ok} เซิร์ฟเวอร์)`);
  }
}

export async function handleInteraction(interaction) {
  try {
    if (interaction.isAutocomplete()) {
      const command = COMMANDS.find((c) => c.data.name === interaction.commandName);
      if (command?.autocomplete) return await command.autocomplete(interaction);
      return await interaction.respond([]).catch(() => {});
    }

    if (interaction.isChatInputCommand()) {
      const command = COMMANDS.find((c) => c.data.name === interaction.commandName);
      if (command) return await command.execute(interaction);
    }
  } catch (err) {
    log.error(`  ❌  [คำสั่ง ${interaction.commandName}] เกิดข้อผิดพลาด: ${err.message}`);

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
