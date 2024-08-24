const Discord = require('discord.js');
const utils = require('../utils');
const config = require('../config.json');
module.exports = {
    // Build context entry
    builder: new Discord.SlashCommandBuilder()
        .setName('gpt')
        .setDescription('Make isolated interactions with GPT.')
        .addStringOption(opt => opt
            .setName('prompt')
            .setDescription(`Your prompt.`)
            .setMaxLength(2000)
            .setRequired(true)
        ),
    // Handle usage
    handler: async interaction => {
        console.log(`Generating isolated response...`);
        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt');
        const res = await utils.streamChatCompletion({
            messages: [
                ...config.gpt.messages,
                { role: 'user', content: prompt }
            ]
        });
        await interaction.editReply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setDescription(res)
                    .setColor(config.bot.embed_color)
            ]
        });
        console.log(`Isolated response sent.`);
    }
}