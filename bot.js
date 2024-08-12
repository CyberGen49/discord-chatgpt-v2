const fs = require('fs');
const Discord = require('discord.js');
const dayjs = require('dayjs');
const OpenAI = require('openai');
const clc = require('cli-color');
const utils = require('./utils');

// Copy template (*-.json) files if needed
for (const name of [ 'config', 'access' ]) {
    if (!fs.existsSync(`${name}.json`) && fs.existsSync(`${name}-.json`))
        fs.copyFileSync(`${name}-.json`, `${name}.json`);
}

const config = require('./config.json');

const busyUsers = {};
const channelActivity = {};

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

bot.on(Discord.Events.MessageCreate, async msg => {
    // Update channel activity timestamp
    channelActivity[msg.channel.id] = msg.createdAt.getTime();
    const getLastActivityTime = () => {
        return channelActivity[msg.channel.id] || 0;
    };
    if (!utils.isValidInputMsg(msg)) return;
    console.log(`Handling message from ${msg.author.tag} in channel ${msg.channel.id}...`);
    // If the user already has an interaction in progress, stop here
    if (busyUsers[msg.author.id]) {
        return msg.react('❌').catch(() => null);
    }
    // Check user access
    const accessStatus = utils.getUserAccessStatus(msg.author.id);
    if (accessStatus == -1) {
        return msg.channel.send(config.messages.error_user_blocked);
    }
    if (accessStatus == 0) {
        const owner = bot.users.cache.get(config.bot.owner_id);
        await owner.send({
            content: config.messages.dm_owner_new_user.replace(/\{user\}/g, msg.author.tag),
            components: [
                new Discord.ActionRowBuilder().addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId(`allow_user.${msg.author.id}`)
                        .setLabel(`Allow ${msg.author.tag}`)
                        .setStyle(Discord.ButtonStyle.Success),
                    new Discord.ButtonBuilder()
                        .setCustomId(`block_user.${msg.author.id}`)
                        .setLabel(`Block ${msg.author.tag}`)
                        .setStyle(Discord.ButtonStyle.Danger),
                )
            ]
        });
        return msg.channel.send(config.messages.error_user_unlisted);
    }
    let typingInterval;
    try {
        busyUsers[msg.author.id] = true;
        // Build messages object
        const input = [
            ...config.gpt.messages,
            {
                role: 'system',
                content: `The current date and time is ${dayjs().format()}. Your name is "${utils.getUserName(bot.user.id, msg.guild)}" and you are chatting on Discord. User messages include prefixes to indicate who sent them. Never prepend these to your own messages.`
            }
        ];
        const isReply = msg.type == Discord.MessageType.Reply;
        const replyToId = isReply ? msg.reference?.messageId : null;
        // Get messages preceding the current one
        // Sort newest to oldest
        const fetchedMsgs = config.gpt.context_msg_count_max > 0
        ? await msg.channel.messages.fetch({
            limit: Math.min(config.gpt.context_msg_count_max, 100),
            before: msg.id
        })
        : [];
        const msgs = [...fetchedMsgs.sort((a, b) => a.id - b.id)];
        msgs.push(msg);
        // Remove messages before the latest context barrier
        let contextBarrierIndex = -1;
        let i = 0;
        for (const data of msgs) {
            const msg = data[1] || data;
            if (msg.type == Discord.MessageType.ChatInputCommand && msg.author.id == bot.user.id && msg.interaction.commandName == 'contextbarrier') {
                contextBarrierIndex = i;
                console.log(`Encountered context barrier at index ${contextBarrierIndex}`);
            }
            i++;
        }
        if (contextBarrierIndex > -1) {
            msgs.splice(0, contextBarrierIndex);
        }
        // Add reply-to message to start of messages if it's not in there
        let isReplyAtStart = false;
        if (replyToId && !msgs.find(m => m.id == replyToId)) {
            const replyToMsg = await msg.channel.messages.fetch(replyToId);
            msgs.shift();
            if (replyToMsg) {
                msgs.unshift(replyToMsg);
                isReplyAtStart = true;
            }
        }
        // Loop through and build messages array
        let pendingInput = [];
        const idsToIndexes = [];
        i = 1;
        for (const data of msgs) {
            const entry = data[1] || data;
            if (!utils.isValidContextMsg(entry)) continue;
            // Add meta line
            const replyToIndex = entry.reference ? idsToIndexes[entry.reference?.messageId] || undefined : undefined;
            const isAssistant = entry.author.id == bot.user.id;
            const meta = `[${i}] from ${utils.getMsgAuthorName(entry)}: ${replyToIndex ? `\nReplying to [${replyToIndex}]}`:''}`;
            const textContent = isAssistant ? utils.getSanitizedContent(entry) : `${meta}\n${utils.getSanitizedContent(entry)}`;
            const inputEntry = {
                role: isAssistant ? 'assistant' : 'user',
                content: [
                    { type: 'text', text: textContent }
                ]
            };
            // Add image attachments if vision is enabled
            if (config.gpt.vision.enabled) {
                for (const attachment of entry.attachments.values()) {
                    if (!attachment.contentType.startsWith('image/')) continue;
                    if (attachment.size > 1024*1024*16) continue; // 16 MiB
                    const dims = {
                        width: attachment.width,
                        height: attachment.height
                    }
                    const url = attachment.url;
                    if (attachment.contentType.startsWith('image/')) {
                        inputEntry.content.push({
                            type: 'image_url',
                            image_url: {
                                url,
                                detail: config.gpt.vision.low_resolution ? 'low' : 'auto'
                            }
                        });
                        utils.imageDimensions[attachment.url] = dims;
                    }
                }
            }
            idsToIndexes[entry.id] = i;
            if (isAssistant) {
                pendingInput.push({ 
                    role: 'system', content: [ { type: 'text', text: meta } ]
                });
            }
            pendingInput.push(inputEntry);
            i++;
        }
        // Loop through new pending input and remove messages
        // after the token limit or context barrier
        const pendingInputFinal = [];
        let totalTokens = 0;
        for (let i = pendingInput.length-1; i >= 0; i--) {
            const inverseIndex = pendingInput.length - i+1;
            const entry = pendingInput[i];
            let tokenCount = 0;
            for (const contentEntry of entry.content) {
                tokenCount += utils.countTokensInContentEntry(contentEntry);
            }
            const force = (isReplyAtStart && i <= 1) || (inverseIndex < config.gpt.context_msg_count_min);
            if (totalTokens < config.gpt.context_tokens_max || force) {
                pendingInputFinal.unshift(entry);
                totalTokens += tokenCount;
            }
        }
        input.push(...pendingInputFinal);
        // Recount total tokens using complete input
        totalTokens = 0;
        for (const entry of input) {
            for (const contentEntry of entry.content) {
                totalTokens += utils.countTokensInContentEntry(contentEntry);
            }
        }
        if (false) console.log((() => {
            const lines = JSON.stringify(input, null, 2).split('\n');
            const newLines = [];
            for (const line of lines) newLines.push(clc.white(line));
            return newLines.join('\n');
        })());
        let counts = {
            user: 0,
            assistant: 0,
            system: 0
        };
        for (const entry of input) {
            counts[entry.role]++;
        }
        console.log(`Prepared ${input.length}`, clc.white(`(${counts.system} system, ${counts.assistant} assistant, ${counts.user} user - estimated ${totalTokens} tokens)`), 'input messages for new interaction');
        // Handle sending and saving messages
        let msgSendQueue = [];
        let lastMsgId = msg.id;
        let lastMsgSendTime = 0;
        let isGenerationFinished = false;
        let isSendingFinished = false;
        let msgSendInterval = setInterval(() => {
            if (isGenerationFinished && msgSendQueue.length == 0) {
                clearInterval(msgSendInterval);
                isSendingFinished = true;
                return;
            }
            if (msgSendQueue.length == 0) {
                return;
            }
            if ((Date.now()-lastMsgSendTime) < config.bot.response_part_min_delay) {
                return;
            }
            lastMsgSendTime = Date.now();
            msgSendQueue.shift()();
        }, 100);
        const queueMsgSend = (content, typing) => {
            // Remove generated meta from content if this is the first chunk
            if (lastMsgSendTime == 0) {
                content = content.replace(/^\[\d{1,3}\].+\n/gi, '');
            }
            msgSendQueue.push(async() => {
                if (!content) return;
                // Send message
                const args = { content, allowedMentions: { parse: [] } };
                const lastMsg = await msg.channel.messages.fetch(lastMsgId).catch(() => null);
                let responseMsg;
                if (lastMsg && (getLastActivityTime() > lastMsg.createdAt.getTime())) {
                    responseMsg = await lastMsg.reply(args);
                } else {
                    responseMsg = await msg.channel.send(args);
                }
                lastMsgId = responseMsg.id;
                if (typing) await msg.channel.sendTyping();
                console.log(clc.greenBright(`Sent response chunk in channel`), clc.green(msg.channel.id));
            });
            console.log(clc.cyanBright(`Response chunk queued for sending`));
        };
        // Stream and queue sending of model response
        let response = '';
        const generate = async() => {
            // Send typing indicator until we stop it
            await msg.channel.sendTyping();
            typingInterval = setInterval(() => {
                msg.channel.sendTyping();
            }, 5000);
            // Stream response
            let pendingResponse = '';
            response = await utils.streamChatCompletion({
                messages: input,
                // Handle response chunks as they come in
                onChunk: chunk => {
                    response += chunk;
                    pendingResponse += chunk;
                    // Queue if response is too long
                    if (pendingResponse.length > 1900) {
                        const response = pendingResponse.slice(0, 1900).trim();
                        pendingResponse = pendingResponse.slice(1900);
                        queueMsgSend(response, true);
                        return;
                    }
                    // Don't do any splitting if disabled
                    if (!config.bot.split_responses) return;
                    // Queue code block responses
                    const singleNewlineSplit = pendingResponse.split('\n');
                    let tripleBacktickCount = 0;
                    const codeBlockLines = [];
                    let shouldReturn = false;
                    while (singleNewlineSplit.length) {
                        const line = singleNewlineSplit.shift();
                        codeBlockLines.push(line);
                        if (line.includes('```')) {
                            tripleBacktickCount++;
                            if (tripleBacktickCount % 2 == 0) {
                                const response = codeBlockLines.join('\n');
                                pendingResponse = singleNewlineSplit.join('\n');
                                queueMsgSend(response, true);
                            }
                            shouldReturn = true;
                        }
                    }
                    if (shouldReturn) return;
                    // Queue paragraph responses
                    const doubleNewlineSplit = pendingResponse.split('\n\n');
                    if (doubleNewlineSplit.length > 1) {
                        const response = doubleNewlineSplit.shift().trim();
                        pendingResponse = doubleNewlineSplit.filter(Boolean).join('\n\n');
                        queueMsgSend(response, true);
                        return;
                    }
                }
            });
            // Stop typing indicator interval
            clearInterval(typingInterval);
            // Queue leftover response
            if (pendingResponse) queueMsgSend(pendingResponse.trim());
        };
        await generate();
        isGenerationFinished = true;
        // Wait for sending to finish
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (isSendingFinished) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    } catch (error) {
        console.error(error);
        clearInterval(typingInterval);
        const owner = bot.users.cache.get(config.bot.owner_id);
        owner.send(config.messages.error_interaction_owner.replace(/\{error\}/g, error.stack || error.toString()));
        msg.channel.send(config.messages.error_interaction_user);
    }
    busyUsers[msg.author.id] = false;
});

bot.login(config.credentials.discord_bot_token);

bot.on(Discord.Events.InteractionCreate, async interaction => {
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
});

module.exports = bot;