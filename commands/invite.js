const Discord = require('discord.js');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get an invite link for the bot.'),
    // Handle usage
    handler: async interaction => {
        const url = `https://discord.com/api/oauth2/authorize?client_id=${config.credentials.discord_application_id}&permissions=2048&scope=bot`;
        await interaction.reply({
            content: config.messages.invite.replace('{url}', url),
            ephemeral: true
        });
    }
}