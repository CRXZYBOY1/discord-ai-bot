import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import config from '../config.js';
import { askAI, describeAIError } from '../ai.js';
import { getMessages, remember } from '../memory.js';
import { getModel } from '../settings.js';
import { checkCooldown, clearBusy, isBusy, setBusy } from '../cooldown.js';
import { recordUsage } from '../usage.js';
import { answerEmbeds, buildErrorEmbed } from '../embed.js';
import { log } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('ถาม AI ได้ในทุกช่อง')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt.setName('question').setDescription('คำถามที่จะถาม AI').setRequired(true)
  );

export async function execute(interaction) {
  const question = interaction.options.getString('question', true).trim();

  const wait = checkCooldown('ask', interaction.user.id, config.cooldownSeconds);
  if (wait > 0) {
    return interaction.reply({
      content: `⏳ คุณถามเร็วเกินไป ลองอีกครั้งในอีก ${wait} วินาที`,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (isBusy(interaction.user.id)) {
    return interaction.reply({
      content: '⏳ ยังรอคำตอบก่อนหน้าอยู่ รอแป๊บเดียวนะครับ',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();
  setBusy(interaction.user.id);

  const model = getModel(interaction.guildId) ?? config.aiModel;

  try {
    const key = `${interaction.guildId}:${interaction.channelId}`;
    const messages = [
      { role: 'system', content: config.systemPrompt },
      ...getMessages(key),
      { role: 'user', content: question },
    ];

    const { reply, usage } = await askAI(messages, model);
    remember(key, 'user', question);
    remember(key, 'assistant', reply);
    recordUsage(interaction.guildId, interaction.user.id, model, usage);

    await interaction.editReply({ embeds: answerEmbeds(reply, model) });
  } catch (err) {
    log.error(`  ❌  [/ask] ${err.message}`);
    await interaction.editReply({ embeds: [buildErrorEmbed(describeAIError(err), model)] });
  } finally {
    clearBusy(interaction.user.id);
  }
}
