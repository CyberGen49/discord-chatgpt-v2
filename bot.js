const fs = require('fs');
const Discord = require('discord.js');
const clc = require('cli-color');

// Copy template (*-.json) files if needed
for (const name of [ 'config', 'access' ]) {
    if (!fs.existsSync(`${name}.json`) && fs.existsSync(`${name}-.json`))
        fs.copyFileSync(`${name}-.json`, `${name}.json`);
}

const config = require('./config.json');

const bot = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent
    ],
    partials: [
        Discord.Partials.User,
        Discord.Partials.Channel,
        Discord.Partials.Message
    ]
});

const updateStatus = () => {
    bot.user.setActivity({
        name: config.bot.status.text,
        type: Discord.ActivityType[config.bot.status.type]
    });
};

bot.on(Discord.Events.ClientReady, () => {
    console.log(`Logged in as ${bot.user.tag}`);
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${bot.user.id}&permissions=2048&scope=bot`;
    console.log(`Invite URL:`, clc.blueBright(inviteUrl));
    updateStatus();
    setInterval(updateStatus, 60*1000);
});

bot.on(Discord.Events.MessageCreate, require('./messageHandler'));

bot.on(Discord.Events.InteractionCreate, require('./interactionHandler'));

bot.login(config.credentials.discord_bot_token);

module.exports = bot;