import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { askAI, describeAIError } from '../ai.js';
import { getCachedModelIds } from '../models.js';
import { getModel } from '../settings.js';
import { isModelHealthy, recordHealth } from '../model-health.js';
import { checkCooldown, clearBusy, isBusy, setBusy } from '../cooldown.js';
import { recordUsage } from '../usage.js';
import { log } from '../logger.js';

const FIELD_LIMIT = 1024; // Discord จำกัด field ละ 1,024 ตัวอักษร

export const data = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('ถามคำถามเดียวกันให้ 2 model ตอบ แล้ววางเทียบกัน')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt.setName('question').setDescription('คำถามที่จะให้ทั้งสอง model ตอบ').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('model_a').setDescription('model ที่ 1 (ค่าเริ่มต้น: model ปัจจุบันของเซิร์ฟเวอร์)').setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt.setName('model_b').setDescription('model ที่ 2 (ค่าเริ่มต้น: model ค่าเริ่มต้นจาก .env)').setAutocomplete(true)
  );

// ค้นหา model — ใช้แคชในเครื่องเหมือน /model และกรอง model ที่พังล่าสุดออก
export async function autocomplete(interaction) {
  const typed = interaction.options.getFocused().toLowerCase();
  let ids = getCachedModelIds().filter(isModelHealthy);
  const choices = ids
    .filter((id) => id.toLowerCase().includes(typed))
    .slice(0, 25)
    .map((id) => ({ name: id, value: id }));
  await interaction.respond(choices);
}

// เลือก model ประจำตำแหน่ง: ถ้าไม่ระบุ ใช้ปัจจุบัน/.env และกันกรณีซ้ำกัน
function resolveDefaults(guildId, modelA, modelB) {
  const a = modelA || getModel(guildId) || config.aiModel;
  let b = modelB || (config.aiModel !== a ? config.aiModel : null);

  if (!b) {
    // หา model ตัวอื่นจากแคชมาเทียบ — เอาตัวที่มีสุขภาพดีก่อน ถ้าไม่มีเลยค่อยใช้ตัวไหนก็ได้
    const pool = getCachedModelIds();
    b = pool.find((id) => id !== a && isModelHealthy(id)) ?? pool.find((id) => id !== a) ?? null;
  }
  if (!b || a === b) return null;
  return { a, b };
}

export async function execute(interaction) {
  const question = interaction.options.getString('question', true).trim();

  const wait = checkCooldown('compare', interaction.user.id, config.cooldownSeconds * 2);
  if (wait > 0) {
    return interaction.reply({
      content: `⏳ เพิ่งใช้ /compare ไปเมื่อกี้ ลองอีกครั้งในอีก ${wait} วินาที`,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (isBusy(interaction.user.id)) {
    return interaction.reply({
      content: '⏳ ยังรอคำตอบก่อนหน้าอยู่ รอแป๊บเดียวนะครับ',
      flags: MessageFlags.Ephemeral,
    });
  }

  const pair = resolveDefaults(
    interaction.guildId,
    interaction.options.getString('model_a'),
    interaction.options.getString('model_b')
  );
  if (!pair) {
    return interaction.reply({
      content: '❌ หา model สองตัวที่ต่างกันไม่ได้ ลองระบุ `model_a` และ `model_b` เองนะครับ',
      flags: MessageFlags.Ephemeral,
    });
  }
  const { a, b } = pair;

  await interaction.deferReply();
  setBusy(interaction.user.id);

  try {
    log.info(`  ⚔️  [/compare] ${interaction.user.username}: ${a} vs ${b}`);

    // ยิงสอง model พร้อมกัน ตัวไหนล้มก็ยังโชว์อีกตัวได้
    const [resultA, resultB] = await Promise.allSettled([
      askAI([{ role: 'system', content: config.systemPrompt }, { role: 'user', content: question }], a),
      askAI([{ role: 'system', content: config.systemPrompt }, { role: 'user', content: question }], b),
    ]);

    const embed = new EmbedBuilder()
      .setColor(Number.parseInt(config.embedColor, 16) || 0x5865f2)
      .setTitle('⚔️ เปรียบเทียบ Model')
      .setDescription(`**คำถาม:** ${question.slice(0, 1000)}`)
      .setTimestamp();

    const sides = [
      ['🅰️', a, resultA],
      ['🅱️', b, resultB],
    ];

    for (const [icon, model, result] of sides) {
      if (result.status === 'fulfilled') {
        const answer = result.value.reply;
        recordHealth(model, true);
        recordUsage(interaction.guildId, interaction.user.id, model, result.value.usage);
        embed.addFields({
          name: `${icon} \`${model}\``,
          value: answer.length > FIELD_LIMIT ? `${answer.slice(0, FIELD_LIMIT)}…` : answer || '(ตอบว่าง)',
        });
      } else {
        recordHealth(model, false, result.reason?.message);
        log.error(`  ❌  [/compare] ${model} ล้มเหลว: ${result.reason?.message?.slice(0, 120)}`);
        embed.addFields({
          name: `${icon} \`${model}\``,
          value: `⚠️ ตอบไม่สำเร็จ\n**สาเหตุ:** ${describeAIError(result.reason).slice(0, 200)}`,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error(`  ❌  [/compare] ${err.message}`);
    await interaction.editReply({
      content: '⚠️ เกิดข้อผิดพลาดกับคำสั่งนี้ ลองใหม่อีกครั้งนะครับ',
    });
  } finally {
    clearBusy(interaction.user.id);
  }
}
