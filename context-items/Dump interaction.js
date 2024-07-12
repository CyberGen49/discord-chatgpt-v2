const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
module.exports = {
    // Build context entry
    builder: new Discord.ContextMenuCommandBuilder()
        .setType(Discord.ApplicationCommandType.Message)
        .setName('Dump interaction')
        .setDMPermission(true),
    // Handle usage
    handler: async interaction => {
        // Attempt to find the interaction in the database
        const db = sqlite3('storage.db');
        let entry = db.prepare(`SELECT * FROM interactions WHERE input_msg_id = ?`).get(interaction.targetId);
        if (!entry) {
            const part = db.prepare(`SELECT * FROM response_messages WHERE msg_id = ?`).get(interaction.targetId);
            entry = db.prepare(`SELECT * FROM interactions WHERE input_msg_id = ?`).get(part.input_msg_id);
        }
        // If it doesn't exist, give up
        if (!entry) {
            await interaction.reply({
                content: `That message isn't associated with an interaction.`,
                ephemeral: true
            });
        }
        // Get interaction response parts
        entry.response_msgs = db.prepare(`SELECT msg_id, content FROM response_messages WHERE input_msg_id = ?`).all(entry.input_msg_id);
        db.close();
        // Convert stored data to JSON
        entry.data = JSON.parse(entry.data);
        // Respond with JSON file
        const attachment = new Discord.AttachmentBuilder()
            .setFile(Buffer.from(JSON.stringify(entry, null, 2), 'utf-8'))
            .setName('interaction.json')
            .setDescription(`JSON dump of interaction with input message ID ${entry.input_msg_id}`)
        await interaction.reply({
            files: [ attachment ]
        });
    }
}