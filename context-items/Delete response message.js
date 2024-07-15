const Discord = require('discord.js');
module.exports = {
    // Build context entry
    builder: new Discord.ContextMenuCommandBuilder()
        .setType(Discord.ApplicationCommandType.Message)
        .setName('Delete response message')
        .setDMPermission(true),
    // Handle usage
    handler: async interaction => {
        const msg = interaction.options.getMessage('message');
        if (msg.author.id != interaction.client.user.id) {
            return interaction.reply({
                content: 'That message wasn\'t sent by me.',
                ephemeral: true
            });
        }
        await interaction.deferReply({ ephemeral: true })
        await msg.delete();
        interaction.editReply({
            content: 'Response message deleted.',
            ephemeral: true
        });
    }
}