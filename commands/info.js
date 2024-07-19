const Discord = require('discord.js');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('info')
        .setDescription('Get info about this bot.'),
    // Handle usage
    handler: async interaction => {
        await interaction.reply({
            content: [
                `Hi there! I'm an AI chatbot powered by OpenAI's \`${config.gpt.model}\` language model, the same one found in ChatGPT and similar services, but my behavior/personality may have been customized. Feel free to ping me in a server or send me a DM to start chatting!`,
                ``,
                `When you invoke this bot with a DM or ping, it is configured to scan the previous ${config.gpt.context_msg_count_max} messages to use as context, passing text${config.gpt.vision.enabled ? ' and image':''} content to the model for processing. If you reply to an existing message when invoking the bot, that message will also be scanned. This data is not stored and only persists for the duration of the interaction. To learn more about how OpenAI handles this data, see [this page](https://openai.com/enterprise-privacy/).`,
                ``,
                `If you're interested in how this bot ticks or wanna make it better, check out the [CyberGen49/discord-chatgpt-v2](<https://github.com/CyberGen49/discord-chatgpt-v2>) GitHub repo!`
            ].join('\n'),
            ephemeral: true
        });
    }
}