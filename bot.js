const fs = require('fs');
const Discord = require('discord.js');
const sqlite3 = require('better-sqlite3');
const dayjs = require('dayjs');
const OpenAI = require('openai');

const config = require(fs.existsSync('./dev.config.json') ? './dev.config.json' : './config.json');

const openai = new OpenAI({
    apiKey: config.credentials.openai_secret
});

const busyUsers = {};

/**
 * This function creates a database connection, passes it to a callback, and closes it afterwards.
 * @param {function} cb A callback to receive the database object
 * @returns Whatever the callback returns
 */
const db = cb => {
    const db = sqlite3('storage.db');
    const res = cb(db);
    db.close();
    return res;
}

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
    const startOfMonth = dayjs().startOf('month').unix()*1000;
    const countMonth = db(db => db.prepare(`SELECT COUNT(*) FROM stats WHERE time_created > ?`).get(startOfMonth)['COUNT(*)']);
    const countTotal = db(db => db.prepare(`SELECT COUNT(*) FROM stats`).get()['COUNT(*)']);
    const placeholders = {
        '{messages_month}': countMonth,
        '{messages_total}': countTotal
    };
    let text = config.bot.status.text;
    for (const placeholder in placeholders) {
        text = text.replace(placeholder, placeholders[placeholder]);
    }
    bot.user.setActivity({
        name: text,
        type: Discord.ActivityType[config.bot.status.type]
    });
};

bot.on(Discord.Events.ClientReady, () => {
    console.log(`Logged in as ${bot.user.tag}`);
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${bot.user.id}&permissions=2048&scope=bot`;
    console.log(`Invite URL: ${inviteUrl}`);
    updateStatus();
});

const channelActivity = {};

bot.on(Discord.Events.MessageCreate, async msg => {
    // Update channel activity timestamp
    channelActivity[msg.channel.id] = msg.createdAt.getTime();
    const getLastActivityTime = () => {
        return channelActivity[msg.channel.id] || 0;
    };
    // If the message isn't a normal text message, ignore it
    if (msg.type != Discord.MessageType.Default && msg.type != Discord.MessageType.Reply) return;
    // If the message is from a bot, ignore it
    if (msg.author.bot) return;
    // If the message doesn't mention the bot and this isn't in a DM, ignore it
    if (msg.guild && !msg.mentions.has(bot.user.id)) return;
    // If the message is empty, ignore it
    msg.content = msg.content.replace(`<@${bot.user.id}>`, '').trim();
    if (!msg.content) return;
    console.log(`Handling message from ${msg.author.tag}`);
    // If the user already has an interaction in progress, stop here
    if (busyUsers[msg.author.id]) {
        msg.react('❌').catch(() => null);
        return; // Disabled for now, gets annoying
        return msg.channel.send(config.messages.error_user_busy);
    }
    // Handle allowed/blocked users
    const userEntry = db(db => db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(msg.author.id));
    if (msg.author.id != config.bot.owner_id && userEntry && !userEntry.is_allowed) {
        return msg.channel.send(config.messages.error_user_blocked);
    }
    if (msg.author.id != config.bot.owner_id && !config.bot.public_usage) {
        if (!userEntry) {
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
            await msg.channel.send(config.messages.error_user_unlisted);
            return;
        } else if (!userEntry.is_allowed) {
            return msg.channel.send(config.messages.error_user_blocked);
        }
    }
    let typingInterval;
    try {
        busyUsers[msg.author.id] = true;
        // Build messages object
        const userName = msg.member?.nickname || msg.author.globalName || msg.author.username;
        const messages = [
            ...config.gpt.messages,
            {
                role: 'system',
                content: `The current date and time is ${dayjs().format()}. Your name is ${bot.user.globalName || bot.user.username} and you are chatting with a user named ${userName}.`
            }
        ];
        // If the message is a reply, use the referenced message as context
        let inputPrefix = '';
        if (msg.type == Discord.MessageType.Reply) {
            // Attempt to find the message in the database
            const referenceMsgEntry = db(db => db.prepare(`SELECT * FROM response_messages WHERE msg_id = ?`).get(msg.reference.messageId));
            const partsCount = db(db => db.prepare(`SELECT COUNT(*) FROM response_messages WHERE input_msg_id = ?`).get(referenceMsgEntry?.input_msg_id)['COUNT(*)']);
            const interaction = db(db => db.prepare(`SELECT * FROM interactions WHERE input_msg_id = ?`).get(referenceMsgEntry?.input_msg_id));
            // If we found something, use both input and output as context
            if (interaction) {
                // Set input prefix if message has multiple parts
                if (partsCount > 1) {
                    inputPrefix = `"${referenceMsgEntry.content.length > 250 ? referenceMsgEntry.content.substring(0, 250) + '...' : referenceMsgEntry.content}"\n\n`;
                }
                const interactionData = JSON.parse(interaction.data);
                const output = interactionData.pop();
                const input = interactionData.pop();
                if (output?.content && input?.content) {
                    messages.push({
                        role: 'user',
                        content: input.content
                    }, {
                        role: 'assistant',
                        content: output.content
                    });
                    console.log(`Loaded referenced interaction for context`);
                }
            // Otherwise just use the referenced message as context
            } else {
                const inputMsg = await msg.channel.messages.fetch(msg.reference.messageId);
                if (inputMsg) {
                    const content = [
                        { type: 'text', text: inputMsg.content }
                    ];
                    // Add attached images if this is a vision model
                    if (config.gpt.vision) {
                        for (const attachment of inputMsg.attachments.values()) {
                            if (attachment.contentType.startsWith('image/')) {
                                content.push({ type: 'image_url', image_url: { url: attachment.url } });
                                console.log(`Adding image attachment to context`);
                            }
                        }
                    }
                    messages.push({
                        role: 'user', content
                    });
                    console.log(`Loaded referenced message content for context`);
                }
            }
        } else if (!msg.guild) {
            // Use previous DM interaction as context
            const interaction = db(db => db.prepare(`SELECT * FROM interactions WHERE user_id = ? AND channel_id = ? ORDER BY time_created DESC LIMIT 1`).get(msg.author.id, msg.channel.id));
            if (interaction) {
                const interactionData = JSON.parse(interaction.data);
                const output = interactionData.pop();
                const input = interactionData.pop();
                if (output?.content && input?.content) {
                    // Remove outdated images
                    for (let i = 0; i < input.content.length; i++) {
                        const segment = input.content[i];
                        if (segment.type == 'image_url') {
                            const url = segment.image_url.url;
                            const res = await fetch(url, {
                                method: 'HEAD'
                            });
                            if (!res.ok) {
                                console.log(`Removing expired image attachment from context`);
                                input.content.splice(i, 1);
                                i--;
                            }
                        }
                    }
                    // Push context
                    messages.push({
                        role: 'user',
                        content: input.content
                    }, {
                        role: 'assistant',
                        content: output.content
                    });
                }
                console.log(`Loaded DM interaction for context`);
            }
        }
        // Add input
        const inputContent = [
            { type: 'text', text: inputPrefix + msg.content }
        ];
        // Add attached images if this is a vision model
        if (config.gpt.vision) {
            for (const attachment of msg.attachments.values()) {
                if (attachment.contentType.startsWith('image/')) {
                    inputContent.push({ type: 'image_url', image_url: { url: attachment.url } });
                    console.log(`Adding image attachment to input`);
                }
            }
        }
        messages.push({
            role: 'user',
            content: inputContent
        });
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
                // Save message
                db(db => db.prepare(`INSERT INTO response_messages (input_msg_id, msg_id, content) VALUES (?, ?, ?)`).run(msg.id, responseMsg.id, content));
                console.log(`Sent and saved response chunk to database`);
            });
            console.log(`Response chunk queued for sending`);
        };
        // Stream and queue sending of model response
        let response = '';
        const generate = async() => {
            // Send typing indicator until we stop it
            await msg.channel.sendTyping();
            typingInterval = setInterval(() => {
                msg.channel.sendTyping();
            }, 5000);
            // Get response stream
            const stream = await openai.chat.completions.create({
                model: config.gpt.model,
                max_tokens: config.gpt.max_tokens,
                messages,
                stream: true
            });
            let pendingResponse = '';
            // Handle response chunks as they come in
            for await (const chunkData of stream) {
                const chunk = chunkData.choices[0].delta.content || '';
                response += chunk;
                pendingResponse += chunk;
                // Queue if response is too long
                if (pendingResponse.length > 1900) {
                    const response = pendingResponse.slice(0, 1900).trim();
                    pendingResponse = pendingResponse.slice(1900);
                    queueMsgSend(response, true);
                    continue;
                }
                // Don't do any splitting if disabled
                if (!config.bot.split_responses) continue;
                // Queue code block responses
                const singleNewlineSplit = pendingResponse.split('\n');
                let tripleBacktickCount = 0;
                const codeBlockLines = [];
                let shouldContinue = false;
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
                        shouldContinue = true;
                    }
                }
                if (shouldContinue) continue;
                // Queue paragraph responses
                const doubleNewlineSplit = pendingResponse.split('\n\n');
                if (doubleNewlineSplit.length > 1) {
                    const response = doubleNewlineSplit.shift().trim();
                    pendingResponse = doubleNewlineSplit.filter(Boolean).join('\n\n');
                    queueMsgSend(response, true);
                    continue;
                }
            }
            // Stop typing indicator
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
        // Save interaction to database
        messages.push({
            role: 'assistant',
            content: response
        });
        db(db => db.prepare(`INSERT INTO interactions (time_created, user_id, channel_id, input_msg_id, data) VALUES (?, ?, ?, ?, ?)`).run(Date.now(), msg.author.id, msg.channel.id, msg.id, JSON.stringify(messages)));
        console.log(`Saved interaction to database`);
        // Save stat entry
        db(db => db.prepare(`INSERT INTO stats (time_created, user_id, type) VALUES (?, ?, ?)`).run(Date.now(), msg.author.id, 'message'));
        updateStatus();
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
            console.log(`Handled ${interaction.user.tag}'s usage of /${interaction.commandName}`);
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
            console.log(`Handled ${interaction.user.tag}'s usage of context item "${interaction.commandName}"`);
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
                db(db => db.prepare(`INSERT OR REPLACE INTO users (user_id, is_allowed) VALUES (?, 1)`).run(userId));
                await user.send(config.messages.dm_user_allowed);
                await interaction.update({
                    content: config.messages.users_user_allowed.replace('{user}', user.tag),
                    components: []
                });
                break;
            }
            case 'block_user': {
                db(db => db.prepare(`INSERT OR REPLACE INTO users (user_id, is_allowed) VALUES (?, 0)`).run(userId));
                await interaction.update({
                    content: config.messages.users_user_blocked.replace('{user}', user.tag),
                    components: []
                });
                break;
            }
        }
    }
});

// Periodically delete interactions older than config.database.message_lifetime_hours
if (config.database.message_lifetime_hours) {
    console.log(`Interaction auto-delete is enabled for entries older than ${config.database.message_lifetime_hours}`);
    setInterval(() => {
        db(db => db.prepare(`DELETE FROM interactions WHERE time_created < ?`).run(Date.now()-(config.database.message_lifetime_hours*60*60*1000)));
    }, 60*1000);
} else {
    console.log(`Interaction auto-delete is disabled`);
}