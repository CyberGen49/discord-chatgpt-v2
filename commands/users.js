const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const config = require('../config.json');
const editAccess = (cb) => {
    let data = JSON.parse(fs.readFileSync('access.json', 'utf8'));
    data = cb(data);
    fs.writeFileSync('access.json', JSON.stringify(data, null, 4));
    return data;
};
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
                editAccess(data => {
                    data.users[user.id] = 1;
                    return data;
                });
                await interaction.reply({
                    content: config.messages.users_user_allowed.replace('{user}', user.tag),
                    ephemeral: true
                });
                await user.send(config.messages.dm_user_allowed);
                break;
            case 'block':
                editAccess(data => {
                    data.users[user.id] = -1;
                    return data;
                });
                await interaction.reply({
                    content: config.messages.users_user_blocked.replace('{user}', user.tag),
                    ephemeral: true
                });
                await user.send(config.messages.dm_user_blocked);
                break;
            case 'unlist':
                editAccess(data => {
                    data.users[user.id] = 0;
                    return data;
                });
                await interaction.reply({
                    content: config.messages.users_user_unlisted.replace('{user}', user.tag),
                    ephemeral: true
                });
                break;
            case 'list':
                const users = require('../access.json').users;
                const allowedList = [];
                const blockedList = [];
                const unlisted = [];
                for (const key of Object.keys(users)) {
                    const value = users[key];
                    if (value == 1)
                        allowedList.push(key);
                    else if (value == -1)
                        blockedList.push(key);
                    else
                        unlisted.push(key);
                }
                await interaction.reply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('Users')
                            .addFields({
                                name: 'Explicitly allowed',
                                value: allowedList.join(', ') || '*None*'
                            }, {
                                name: 'Explicitly blocked',
                                value: blockedList.join(', ') || '*None*'
                            }, {
                                name: 'Other unlisted users',
                                value: unlisted.join(', ') || '*None*'
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