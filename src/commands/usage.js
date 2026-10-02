import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { getSummary } from '../usage.js';

export const data = new SlashCommandBuilder()
  .setName('usage')
  .setDescription('ดูสถิติการใช้งานบอทในเซิร์ฟเวอร์นี้')
  .setContexts(InteractionContextType.Guild);

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

export async function execute(interaction) {
  const { today, allTime } = getSummary(interaction.guildId);

  const topModels = Object.entries(allTime.models)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([model, count]) => `\`${model}\` × ${count}`)
    .join('\n') || '—';

  const embed = new EmbedBuilder()
    .setColor(Number.parseInt(config.embedColor, 16) || 0x5865f2)
    .setTitle('📊 สถิติการใช้งาน')
    .addFields(
      {
        name: '📅 วันนี้',
        value: `คำถาม ${formatNumber(today.questions)} ครั้ง • ผู้ใช้ ${formatNumber(today.userCount)} คน`,
        inline: false,
      },
      {
        name: '🗂️ ทั้งหมด',
        value: `คำถาม ${formatNumber(allTime.questions)} ครั้ง • ผู้ใช้ ${formatNumber(allTime.userCount)} คน`,
        inline: false,
      },
      {
        name: '🔢 Token (ทั้งหมด)',
        value: `คำถาม: ${formatNumber(allTime.promptTokens)}\nคำตอบ: ${formatNumber(allTime.completionTokens)}`,
        inline: false,
      },
      { name: '🧠 Model ที่ใช้บ่อย', value: topModels, inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
