const Discord = require('discord.js');
const fs = require('fs');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('info')
        .setDescription('Learn about the bot and how to use it.'),
    // Handle usage
    handler: async interaction => {
        await interaction.reply({
            content: fs.readFileSync(`${__dirname}/info.md`, 'utf-8'),
            ephemeral: true
        });
    }
}