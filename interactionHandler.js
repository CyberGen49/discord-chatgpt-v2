const fs = require('fs');
const clc = require('cli-color');
const config = require('./config.json');
const bot = require('./bot');

module.exports = async interaction => {
    if (interaction.isChatInputCommand()) {
        const file = `./commands/${interaction.commandName}.js`;
        if (fs.existsSync(file)) {
            const cmd = require(file);
            await cmd.handler(interaction);
            console.log(clc.green(`Handled ${interaction.user.tag}'s usage of /${interaction.commandName}`));
        } else {
            interaction.reply({
                content: `This command hasn't been implemented yet.`,
                ephemeral: true
            });
        }
    }
    if (interaction.isContextMenuCommand()) {
        const file = `./context-items/${interaction.commandName}.js`;
        if (fs.existsSync(file)) {
            const cmd = require(file);
            await cmd.handler(interaction);
            console.log(clc.green(`Handled ${interaction.user.tag}'s usage of context item "${interaction.commandName}"`));
        } else {
            interaction.reply({
                content: `This context menu item hasn't been implemented yet.`,
                ephemeral: true
            });
        }
    }
    if (interaction.isButton()) {
        const [ action, userId ] = interaction.customId.split('.');
        const user = userId ? bot.users.cache.get(userId) : null;
        switch (action) {
            case 'allow_user': {
                const access = JSON.parse(fs.readFileSync('access.json', 'utf8'));
                access.users[userId] = 1;
                fs.writeFileSync('access.json', JSON.stringify(access, null, 4));
                await user.send(config.messages.dm_user_allowed);
                await interaction.update({
                    content: config.messages.users_user_allowed.replace('{user}', user.tag),
                    components: []
                });
                break;
            }
            case 'block_user': {
                const access = JSON.parse(fs.readFileSync('access.json', 'utf8'));
                access.users[userId] = -1;
                fs.writeFileSync('access.json', JSON.stringify(access, null, 4));
                await interaction.update({
                    content: config.messages.users_user_blocked.replace('{user}', user.tag),
                    components: []
                });
                break;
            }
        }
    }
};