const Discord = require('discord.js');
const dayjs = require('dayjs');
const clc = require('cli-color');
const axios = require('axios');
const fs = require('fs');
const utils = require('./utils');
const config = require('./config.json');

const busyUsers = {};
const channelActivity = {};

module.exports = async msg => {
    const bot = msg.client;
    // Update channel activity timestamp
    if (msg.author.id != bot.user.id)
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
                content: `The current date and time is ${dayjs().format()}. Your name is "${utils.getUserName(bot.user.id, msg.guild)}" and you are chatting as a Discord bot running the ${config.gpt.model} model provided by ${config.gpt.provider}. User messages include prefixes to indicate who sent them. Never, under any circumstances, should you prepend these to your own messages. Also never address previous messages in the conversation unless you are directed to reference them. Each paragraph of your response will be sent as a distinct message to the user.`
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
            // Process message attachments
                for (const attachment of entry.attachments.values()) {
                    const fileExtension = attachment.name.split('.').pop();
                    const imageExtensions = [ 'png', 'jpg', 'jpeg' ];
                    const textExtensions = config.gpt.text_files.extensions;
                    const fileUrlHash = utils.md5sum(attachment.url);
                    const cachedFilePath = `./cache/${fileUrlHash}`;
                    const isFileCached = fs.existsSync(cachedFilePath);
                    // Add image attachments if vision is enabled
                    if (config.gpt.vision.enabled && imageExtensions.includes(fileExtension)) {
                        if (attachment.size > 1024*1024*16) {
                            console.log(`Skipping too large image attachment`);
                            continue;
                        }
                        let imageDataUrl;
                        try {
                            // Check if image is cached
                            if (isFileCached) {
                                console.log(`Using cached image from ${attachment.url}...`)
                                imageDataUrl = `data:${attachment.contentType};base64,${fs.readFileSync(cachedFilePath).toString('base64')}`;
                            } else {
                                // Download image and save data url
                                console.log(`Downloading image from ${attachment.url}...`)
                                const res = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                                imageDataUrl = `data:${attachment.contentType};base64,${Buffer.from(res.data, 'binary').toString('base64')}`;
                                // Cache image file
                                fs.mkdirSync('./cache', { recursive: true });
                                fs.writeFileSync(cachedFilePath, res.data);
                            }
                        } catch (error) {
                            console.log(`Image download failed`, error);
                            continue;
                        }
                        const imgHash = utils.md5sum(imageDataUrl);
                        const dims = {
                            width: attachment.width,
                            height: attachment.height
                        }
                        if (attachment.contentType.startsWith('image/')) {
                            inputEntry.content.push({
                                type: 'image_url',
                                image_url: {
                                    url: imageDataUrl,
                                    detail: config.gpt.vision.low_resolution ? 'low' : 'auto'
                                }
                            });
                            utils.imageDimensions[imgHash] = dims;
                        }
                    // Read and attach text files if enabled
                    } else if (config.gpt.text_files.enabled && textExtensions.includes(fileExtension)) {
                        if (attachment.size > config.gpt.text_files.max_bytes) {
                            console.log(`Skipping too large text file attachment`);
                            continue;
                        }
                        let textContent;
                        try {
                            // Check if text file is cached
                            if (isFileCached) {
                                console.log(`Using cached text file from ${attachment.url}...`);
                                textContent = fs.readFileSync(cachedFilePath, 'utf8');
                            } else {
                                // Download file
                                console.log(`Downloading text file from ${attachment.url}...`);
                                const res = await axios.get(attachment.url);
                                textContent = res.data;
                            }
                        } catch (error) {
                            console.log(`Text file download failed`, error);
                            continue;
                        }
                        if (textContent) {
                            inputEntry.content.push({
                                type: 'text',
                                text: `Contents of attached file "${attachment.name}":\n\n${textContent}`
                            });
                        }
                    } else {
                        console.log(`Skipping invalid attachment with extension ${fileExtension}`);
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
        let sentMsgIds = [];
        let msgSendInterval = setInterval(() => {
            if (msgSendQueue.length == 0) return;
            msgSendQueue.shift()();
        }, config.bot.response_part_min_delay);
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
                lastMsgSendTime = Date.now();
                sentMsgIds.push(responseMsg.id);
                lastMsgId = responseMsg.id;
                console.log(clc.greenBright(`Sent response chunk in channel`), clc.green(msg.channel.id));
                // Check if we're done
                if (isGenerationFinished && msgSendQueue.length == 0) {
                    clearInterval(msgSendInterval);
                    isSendingFinished = true;
                    return;
                }
                // If we aren't, keep typing
                if (typing) await msg.channel.sendTyping();
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
                        // Sanitize response
                        let response = doubleNewlineSplit.shift().trim();
                        response = utils.replaceConfigPlaceholders(response);
                        pendingResponse = doubleNewlineSplit.filter(Boolean).join('\n\n');
                        queueMsgSend(response, true);
                        return;
                    }
                }
            });
            // Stop typing indicator interval
            clearInterval(typingInterval);
            // Queue leftover response
            if (pendingResponse.trim()) queueMsgSend(utils.replaceConfigPlaceholders(pendingResponse.trim()));
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
        // Save interaction to file
        const interaction = [
            ...input, {
                role: 'assistant',
                content: [
                    { type: 'text', text: response }
                ]
            }
        ];
        const filePath = `./interactions/${msg.id}.json`;
        fs.writeFileSync(filePath, JSON.stringify(interaction));
        const interactions = JSON.parse(fs.readFileSync('./interactions.json'));
        for (const msgId of [ msg.id, ...sentMsgIds ]) {
            interactions.msg_to_file[msgId] = filePath;
        }
        fs.writeFileSync('./interactions.json', JSON.stringify(interactions, null, 4));
        console.log(clc.greenBright(`Saved interaction to file`), clc.green(filePath));
    } catch (error) {
        console.error(error);
        clearInterval(typingInterval);
        const owner = bot.users.cache.get(config.bot.owner_id);
        owner.send(config.messages.error_interaction_owner.replace(/\{error\}/g, error.stack || error.toString()));
        msg.channel.send(config.messages.error_interaction_user);
    }
    busyUsers[msg.author.id] = false;
};