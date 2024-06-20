const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const config = require(fs.existsSync(`${__dirname}/../dev.config.json`) ? '../dev.config.json' : '../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('users')
        .setDescription('Control who can use the bot. Owner only.')
        .addSubcommand(subcommand => subcommand
            .setName('allow')
            .setDescription('Allow a user to use the bot.')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('The user to allow.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('block')
            .setDescription('Block a user from using the bot.')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('The user to block.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('unlist')
            .setDescription('Remove a user from the list, leaving their access up to `config.public_usage`.')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('The user to unlist.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('View a list of allowed and blocked users.')),
    // Handle usage
    handler: async interaction => {
        const owner = interaction.client.users.cache.get(config.bot.owner_id);
        console.log(interaction.user.id, owner.id)
        if (interaction.user.id != owner.id) {
            return interaction.reply({
                content: config.messages.error_owner_only,
                ephemeral: true
            });
        }
        const user = interaction.options.getUser('user');
        const db = sqlite3('storage.db');
        switch (interaction.options.getSubcommand()) {
            case 'allow':
                db.prepare(`INSERT OR REPLACE INTO users (user_id, is_allowed) VALUES (?, 1)`).run(user.id);
                await interaction.reply({
                    content: config.messages.users_user_allowed.replace('{user}', user.tag),
                    ephemeral: true
                });
                await user.send(config.messages.dm_user_allowed);
                break;
            case 'block':
                db.prepare(`INSERT OR REPLACE INTO users (user_id, is_allowed) VALUES (?, 0)`).run(user.id);
                await interaction.reply({
                    content: config.messages.users_user_blocked.replace('{user}', user.tag),
                    ephemeral: true
                });
                await user.send(config.messages.dm_user_blocked);
                break;
            case 'unlist':
                db.prepare(`DELETE FROM users WHERE user_id = ?`).run(user.id);
                await interaction.reply({
                    content: config.messages.users_user_unlisted.replace('{user}', user.tag),
                    ephemeral: true
                });
                break;
            case 'list':
                const users = db.prepare(`SELECT * FROM users`).all();
                const allowedList = [];
                const blockedList = [];
                for (const entry of users) {
                    const tag = `<@${entry.user_id}>`;
                    if (entry.is_allowed)
                        allowedList.push(tag);
                    else
                        blockedList.push(tag);
                }
                await interaction.reply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('Users')
                            .addFields({
                                name: 'Allowed',
                                value: allowedList.join(', ') || '*None*'
                            }, {
                                name: 'Blocked',
                                value: blockedList.join(', ') || '*None*'
                            })
                            .setColor('#83e6eb')
                    ],
                    ephemeral: true
                });
                break;
        }
        db.close();
    }
}