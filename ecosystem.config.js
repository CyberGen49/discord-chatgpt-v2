module.exports = {
    apps: [{
        name: 'discord-chatgpt-v2',
        script: './bot.js',
        watch: [
            'bot.js',
            'config.json',
            './commands/*',
            './contextItems/*'
        ]
    }]
};