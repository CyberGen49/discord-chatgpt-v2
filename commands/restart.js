const Discord = require('discord.js');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restart the bot (must be running on a loop to restart).'),
    // Handle usage
    handler: async interaction => {
        const owner = interaction.client.users.cache.get(config.bot.owner_id);
        if (interaction.user.id != owner.id) {
            return interaction.reply({
                content: config.messages.error_owner_only,
                ephemeral: true
            });
        }
        await interaction.reply({
            content: config.messages.restart_confirm,
            ephemeral: true
        });
        setTimeout(() => {
            process.exit();
        }, 1000);
        console.log(`Restarting in just a sec...`);
    }
}