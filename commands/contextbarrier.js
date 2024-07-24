const Discord = require('discord.js');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('contextbarrier')
        .setDescription('Create a context barrier, ignoring all previous messages.'),
    // Handle usage
    handler: async interaction => {
        await interaction.reply({
            content: config.messages.barrier
        });
    }
}