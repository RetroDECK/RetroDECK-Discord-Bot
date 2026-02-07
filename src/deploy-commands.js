const { REST, Routes } = require('discord.js');
const { command } = require('./commands/claim-donation');

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID environment variables.');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');

    const clientId = Buffer.from(token.split('.')[0], 'base64').toString();

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [command.toJSON()],
    });

    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
