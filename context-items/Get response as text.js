const Discord = require('discord.js');
const fs = require('fs');

module.exports = {
    // Build context entry
    builder: new Discord.ContextMenuCommandBuilder()
        .setType(Discord.ApplicationCommandType.Message)
        .setName('Get response as text')
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
        const data = JSON.parse(raw);
        const responseObject = data.pop();
        const content = responseObject.content[0].text;
        const attachment = new Discord.AttachmentBuilder(Buffer.from(content), {
            name: `response-${msg.id}.md`
        });
        interaction.reply({
            files: [ attachment ]
        });
    }
}