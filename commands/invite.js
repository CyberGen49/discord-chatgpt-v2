const Discord = require('discord.js');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get an invite link for the bot.'),
    // Handle usage
    handler: async interaction => {
        await interaction.reply({
            content: `Invite me to your server:\nhttps://discord.com/api/oauth2/authorize?client_id=${config.credentials.discord_application_id}&permissions=2048&scope=bot`,
            ephemeral: true
        });
    }
}