const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
module.exports = {
    // Build context entry
    builder: new Discord.ContextMenuCommandBuilder()
        .setType(Discord.ApplicationCommandType.Message)
        .setName('Get response as text')
        .setDMPermission(true),
    // Handle usage
    handler: async interaction => {
        // Attempt to find the interaction in the database
        const db = sqlite3('storage.db');
        const part = db.prepare(`SELECT * FROM response_messages WHERE msg_id = ?`).get(interaction.targetId);
        const entry = db.prepare(`SELECT * FROM interactions WHERE input_msg_id = ?`).get(part.input_msg_id);
        db.close();
        // If it doesn't exist, give up
        if (!entry) {
            await interaction.reply({
                content: `That message isn't a model response.`,
                ephemeral: true
            });
        }
        // Convert stored data to JSON
        entry.data = JSON.parse(entry.data);
        const response = entry.data.pop().content;
        // Respond with JSON file
        const attachment = new Discord.AttachmentBuilder()
            .setFile(Buffer.from(response, 'utf-8'))
            .setName('response.md')
            .setDescription(`Markdown file of response to input message ID ${entry.input_msg_id}`)
        await interaction.reply({
            files: [ attachment ]
        });
    }
}