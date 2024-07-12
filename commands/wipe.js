const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('wipe')
        .setDescription('Delete your saved interactions from the database.'),
    // Handle usage
    handler: async interaction => {
        await interaction.deferReply({ ephemeral: true })
        const db = sqlite3('storage.db');
        const interactions = db.prepare(`SELECT * FROM interactions WHERE user_id = ?`).all(interaction.user.id);
        for (const entry of interactions) {
            // Delete parts then delete entry
            db.prepare(`DELETE FROM response_messages WHERE input_msg_id = ?`).run(entry.input_msg_id);
            db.prepare(`DELETE FROM interactions WHERE input_msg_id = ?`).run(entry.input_msg_id);
        }
        db.close();
        await interaction.editReply({
            content: `${interactions.length} interactions have been deleted.`,
            ephemeral: true
        });
    }
}