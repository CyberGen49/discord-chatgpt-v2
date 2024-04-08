const fs = require('fs');
const Discord = require('discord.js');
const config = require(fs.existsSync('./dev.config.json') ? './dev.config.json' : './config.json');
async function main() {
    // Build commands
    const builders = [];
    for (const file of fs.readdirSync('./commands')) {
        if (!file.match(/\.js$/)) continue;
        const cmd = require(`./commands/${file}`);
        builders.push(cmd.builder);
    }
    for (const file of fs.readdirSync('./context-items')) {
        if (!file.match(/\.js$/)) continue;
        const cmd = require(`./context-items/${file}`);
        builders.push(cmd.builder);
    }
    // Register slash commands with Discord
    const api = new Discord.REST().setToken(config.credentials.discord_bot_token);
    await api.put(Discord.Routes.applicationCommands(config.credentials.discord_application_id), {
        body: builders
    });
    console.log(`Registered slash commands`);
}
main();