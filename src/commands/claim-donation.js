const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { verifyDonor } = require('../services/opencollective');

const MODAL_ID = 'claim-donation-modal';
const EMAIL_INPUT_ID = 'email-input';

const command = new SlashCommandBuilder()
  .setName('claim-donation')
  .setDescription('Claim your Donator role by verifying your OpenCollective donation');

async function handleCommand(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Verify Your Donation');

  const emailInput = new TextInputBuilder()
    .setCustomId(EMAIL_INPUT_ID)
    .setLabel('Email used on OpenCollective')
    .setPlaceholder('your-email@example.com')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(emailInput));

  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const donatorRoleId = process.env.DISCORD_DONATOR_ROLE_ID;
  const member = interaction.member;

  if (member.roles.cache.has(donatorRoleId)) {
    await interaction.reply({
      content: 'You already have the Donator role! Thank you for your support.',
      flags: 64,
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const email = interaction.fields.getTextInputValue(EMAIL_INPUT_ID).trim();

  try {
    const result = await verifyDonor(email);

    if (result.found) {
      await member.roles.add(donatorRoleId);
      await interaction.editReply({
        content:
          'Donation verified! You have been given the **Donator** role. Thank you for supporting RetroDECK!',
      });
    } else {
      await interaction.editReply({
        content:
          "Could not find a donation matching that email. Please double-check the email you used on OpenCollective.\n\n" +
          "If you donated as a guest or anonymously, automatic verification isn't possible. " +
          'Please contact a moderator for manual verification.',
      });
    }
  } catch (err) {
    console.error('Error verifying donation:', err);
    await interaction.editReply({
      content:
        'Something went wrong while verifying your donation. Please try again later or contact a moderator.',
    });
  }
}

module.exports = { command, handleCommand, handleModal, MODAL_ID };
