import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import config from '../config.js';
import { getCachedModelIds, isCacheStale, refreshModelIds } from '../models.js';
import { clearModel, getModel, setModel } from '../settings.js';

export const data = new SlashCommandBuilder()
  .setName('model')
  .setDescription('ดู/เปลี่ยน model AI ที่บอทใช้ตอบ (ต้องเป็นผู้ดูแลเซิร์ฟเวอร์)')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sc) =>
    sc
      .setName('set')
      .setDescription('เปลี่ยน model AI ของเซิร์ฟเวอร์นี้')
      .addStringOption((opt) =>
        opt
          .setName('model')
          .setDescription('พิมพ์เพื่อค้นหารายชื่อ model')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sc) => sc.setName('show').setDescription('ดู model ที่ใช้อยู่ตอนนี้'))
  .addSubcommand((sc) => sc.setName('reset').setDescription('กลับไปใช้ model ค่าเริ่มต้นจากไฟล์ .env'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const model = interaction.options.getString('model', true);
    setModel(interaction.guildId, model);
    await interaction.reply({
      content: `✅ เปลี่ยน model เป็น \`${model}\` แล้ว — ข้อความถัดไปในเซิร์ฟเวอร์นี้ใช้ model นี้ทันที`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === 'show') {
    const override = getModel(interaction.guildId);
    await interaction.reply({
      content: override
        ? `🔧 model ปัจจุบัน: \`${override}\` (ตั้งผ่านคำสั่ง /model set)`
        : `🔧 model ปัจจุบัน: \`${config.aiModel}\` (ค่าเริ่มต้นจากไฟล์ .env)`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === 'reset') {
    clearModel(interaction.guildId);
    await interaction.reply({
      content: `↩️ กลับไปใช้ model ค่าเริ่มต้น \`${config.aiModel}\` แล้ว`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ค้นหา model ตามที่ผู้ใช้พิมพ์ — Discord แสดงได้สูงสุด 25 รายการ
export async function autocomplete(interaction) {
  const typed = interaction.options.getFocused().toLowerCase();

  // ต้องตอบภายใน ~3 วินาที จึงใช้แคชในเครื่องเป็นหลัก
  // (server ล่ม/ช้าก็ยังตอบได้) แล้วรีเฟรชเบื้องหลังเมื่อข้อมูลเก่า
  let ids = getCachedModelIds();
  if (ids.length === 0) {
    ids = await refreshModelIds().catch(() => []);
  } else if (isCacheStale()) {
    refreshModelIds().catch(() => {});
  }

  const starts = ids.filter((id) => id.toLowerCase().startsWith(typed));
  const contains = typed
    ? ids.filter((id) => !id.toLowerCase().startsWith(typed) && id.toLowerCase().includes(typed))
    : [];
  const choices = [...starts, ...contains].slice(0, 25).map((id) => ({ name: id, value: id }));

  await interaction.respond(choices);
}
