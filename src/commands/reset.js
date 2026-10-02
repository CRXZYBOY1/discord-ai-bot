import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { reset as resetMemory } from '../memory.js';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('ล้างความจำบทสนทนาของช่อง/เธรดนี้ (เริ่มคุยใหม่)')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  const channel = interaction.channel;
  const isThread = channel?.isThread() ?? false;
  const canManage = interaction.memberPermissions?.has('ManageGuild') ?? false;
  const isThreadOwner = isThread && channel.ownerId === interaction.user.id;

  // ผู้ดูแลเซิร์ฟเวอร์ล้างได้ทุกที่, สมาชิกทั่วไปล้างได้เฉพาะเธรดของตัวเอง
  if (!canManage && !isThreadOwner) {
    return interaction.reply({
      content: '❌ ต้องเป็นผู้ดูแลเซิร์ฟเวอร์ หรือเจ้าของเธรดถึงจะล้างความจำได้',
      flags: MessageFlags.Ephemeral,
    });
  }

  resetMemory(`${interaction.guildId}:${channel.id}`);
  await interaction.reply({
    content: '🧹 ล้างความจำบทสนทนาของช่องนี้เรียบร้อย เริ่มคุยใหม่ได้เลย!',
    flags: MessageFlags.Ephemeral,
  });
}
