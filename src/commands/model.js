import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import config from '../config.js';
import { askAI, describeAIError } from '../ai.js';
import { getCachedModelIds, isCacheStale, refreshModelIds } from '../models.js';
import { clearModel, getModel, setModel } from '../settings.js';
import { describeHealth, isModelHealthy, recordHealth } from '../model-health.js';

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

    // ทดสอบ model ก่อนเปลี่ยนจริง — ยิงคำถามเล็ก ๆ ให้ model นั้นตอบ
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { reply } = await askAI([{ role: 'user', content: 'ตอบแค่คำว่า ok' }], model);
      recordHealth(model, true);
      setModel(interaction.guildId, model);
      await interaction.editReply({
        content: `✅ ทดสอบ model \`${model}\` ผ่าน (ตอบกลับมา: "${reply.slice(0, 40)}")\nเปลี่ยนเป็น model ของเซิร์ฟเวอร์แล้ว — ข้อความถัดไปใช้ model นี้ทันที`,
      });
    } catch (err) {
      recordHealth(model, false, err.message);
      await interaction.editReply({
        content: `❌ ทดสอบ model \`${model}\` ไม่ผ่าน — **ไม่ได้เปลี่ยน model**\n**สาเหตุ:** ${describeAIError(err)}`,
      });
    }
  } else if (sub === 'show') {
    const override = getModel(interaction.guildId);
    const current = override ?? config.aiModel;
    await interaction.reply({
      content: `🔧 model ปัจจุบัน: \`${current}\`\n   ${override ? '(ตั้งผ่านคำสั่ง /model set)' : '(ค่าเริ่มต้นจากไฟล์ .env)'}\n🩺 สถานะ: ${describeHealth(current)}`,
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

function filterChoices(pool, typed) {
  const starts = pool.filter((id) => id.toLowerCase().startsWith(typed));
  const contains = typed
    ? pool.filter((id) => !id.toLowerCase().startsWith(typed) && id.toLowerCase().includes(typed))
    : [];
  return [...starts, ...contains].slice(0, 25).map((id) => ({ name: id, value: id }));
}

// ค้นหา model ตามที่ผู้ใช้พิมพ์ — Discord แสดงได้สูงสุด 25 รายการ
// กรอง model ที่พังล่าสุด (30 นาที) ออกก่อน ยกเว้นพิมพ์แล้วไม่เจออะไรเลย
// เพื่อให้ยังบังคับเลือกตัวเดิมได้ถ้าต้องการ
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

  let choices = filterChoices(ids.filter(isModelHealthy), typed);
  if (choices.length === 0 && typed) {
    choices = filterChoices(ids, typed);
  }

  await interaction.respond(choices);
}
