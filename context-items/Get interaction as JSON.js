const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    // Build context entry
    builder: new Discord.ContextMenuCommandBuilder()
        .setType(Discord.ApplicationCommandType.Message)
        .setName('Get interaction as JSON')
        .setDMPermission(true),
    // Handle usage
    handler: async interaction => {
        const msg = interaction.options.getMessage('message');
        const interactions = JSON.parse(fs.readFileSync('./interactions.json', 'utf8'));
        const filePath = interactions.msg_to_file[msg.id];
        if (!filePath || !fs.existsSync(filePath)) {
            return interaction.reply({
                content: `A save file for this interaction doesn't exist.`,
                ephemeral: true
            });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        const content = JSON.stringify(JSON.parse(raw), null, 2);
        const attachment = new Discord.AttachmentBuilder(Buffer.from(content), {
            name: `interaction-${msg.id}.json`
        });
        interaction.reply({
            files: [ attachment ]
        });
    }
}