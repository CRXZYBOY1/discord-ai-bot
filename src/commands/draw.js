import {
  AttachmentBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import config from '../config.js';
import { generateImage, imageExtension } from '../imagegen.js';
import { checkCooldown, clearBusy, isBusy, setBusy } from '../cooldown.js';
import { log } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('draw')
  .setDescription('ให้ AI วาดรูปจากคำอธิบาย')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt.setName('prompt').setDescription('อธิบายรูปที่ต้องการ (ไทย/อังกฤษได้)').setRequired(true)
  );

export async function execute(interaction) {
  const prompt = interaction.options.getString('prompt', true).trim();

  const wait = checkCooldown('draw', interaction.user.id, config.imageCooldownSeconds);
  if (wait > 0) {
    return interaction.reply({
      content: `⏳ เพิ่งวาดรูปไปเมื่อกี้ ลองอีกครั้งในอีก ${wait} วินาที`,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (isBusy(interaction.user.id)) {
    return interaction.reply({
      content: '⏳ ยังรอรูปก่อนหน้าอยู่ รอแป๊บเดียวนะครับ',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();
  setBusy(interaction.user.id);

  try {
    log.info(`  🎨  [/draw] ${interaction.user.username}: ${prompt.slice(0, 60)}`);
    const { buffer, model } = await generateImage(prompt);
    const file = new AttachmentBuilder(buffer, { name: `draw.${imageExtension(buffer)}` });

    const embed = new EmbedBuilder()
      .setColor(Number.parseInt(config.embedColor, 16) || 0x5865f2)
      .setAuthor({ name: `🎨 ผลงาน AI สำหรับ ${interaction.user.username}` })
      .setDescription(prompt.slice(0, 1000))
      .setFooter({ text: `🧠 ${model}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], files: [file] });
  } catch (err) {
    log.error(`  ❌  [/draw] ${err.message}`);
    await interaction.editReply({
      content: `⚠️ สร้างรูปไม่สำเร็จครับ — ${err.message.slice(0, 180)}\nลองเปลี่ยน \`IMAGE_MODEL\` ใน .env หรือลองใหม่ภายหลังนะครับ`,
    });
  } finally {
    clearBusy(interaction.user.id);
  }
}
