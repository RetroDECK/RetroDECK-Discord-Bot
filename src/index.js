require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { handleCommand, handleModal, MODAL_ID } = require('./commands/claim-donation');
const { getAccessToken, TOKEN_PATH } = require('./services/token-store');

const ocToken = getAccessToken();
if (!ocToken) {
  console.error(
    `No OpenCollective OAuth token found at ${TOKEN_PATH}.\n` +
    'Run "npm run setup-oauth" to authenticate with OpenCollective before starting the bot.'
  );
  process.exit(1);
}
console.log('OpenCollective OAuth token loaded.');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'claim-donation') {
      await handleCommand(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
    const reply = {
      content: 'An unexpected error occurred. Please try again later.',
      flags: 64,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
