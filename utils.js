const fs = require('fs');
const Discord = require('discord.js');
const gptEncoder = require('gpt-3-encoder');
const OpenAI = require('openai');
const config = require('./config.json');

// Count the number of tokens in a string
const countStringTokens = str => {
    return gptEncoder.encode(str).length;
};

const adjustImageDimensions = (width, height) => {
    const maxLongSide = config.gpt.vision.resize.long_side;
    const maxShortSide = config.gpt.vision.resize.short_side;
    // Determine the longer and shorter dimensions
    let longSide = Math.max(width, height);
    let shortSide = Math.min(width, height);
    // Check if resizing is needed
    if (longSide <= maxLongSide && shortSide <= maxShortSide) {
        return { width, height }; // No resize needed
    }
    // Calculate aspect ratio
    const aspectRatio = longSide / shortSide;
    // Rescale
    if (longSide > maxLongSide) {
        longSide = maxLongSide;
        shortSide = longSide / aspectRatio;
    }
    if (shortSide > maxShortSide) {
        shortSide = maxShortSide;
        longSide = shortSide * aspectRatio;
    }
    // Return the resized dimensions, keeping width and height identifiers
    return width > height 
        ? { width: longSide, height: shortSide }
        : { width: shortSide, height: longSide };
};

const countImageTokens = (width, height) => {
    const dims = adjustImageDimensions(width, height);
    let tokenCount = config.gpt.vision.tokens_base;
    const widthTiles = Math.ceil(dims.width / config.gpt.vision.tile_size);
    const heightTiles = Math.ceil(dims.height / config.gpt.vision.tile_size);
    tokenCount += widthTiles * heightTiles * config.gpt.vision.tokens_per_tile;
    return tokenCount;
};

const imageDimensions = [];
const countTokensInContentEntry = contentEntry => {
    if (typeof contentEntry == 'string') {
        return countStringTokens(contentEntry);
    }
    if (contentEntry.type == 'text') {
        return countStringTokens(contentEntry.text);
    } else if (contentEntry.type == 'image_url') {
        const dims = imageDimensions[contentEntry.image_url.url];
        return countImageTokens(dims.width, dims.height);
    }
    return 0;
}

const replaceConfigPlaceholders = (text) => {
    for (const placeholder in config.gpt.replacements) {
        const replacement = config.gpt.replacements[placeholder];
        text = text.replace(new RegExp(placeholder.replace('\\', '\\\\'), 'g'), replacement);
    }
    return text;
}

// Determines if a received message is a valid AI prompt
const isValidInputMsg = msg => {
    const bot = require('./bot');
    // If the message isn't a normal text message, ignore it
    if (msg.type != Discord.MessageType.Default && msg.type != Discord.MessageType.Reply) return false;
    // If the message is from a bot, ignore it
    if (msg.author.bot) return false;
    // If the message doesn't mention the bot and this isn't in a DM, ignore it
    if (msg.guild && !msg.mentions.has(bot.user.id)) return false;
    // If vision is enabled
    if (config.gpt.vision.enabled) {
        // If the message has no content and no attachments, ignore it
        if (!msg.attachments.size && !msg.content) return false;
    } else {
        // If the message has no content, ignore it
        if (!msg.content) return false;
    }
    return true;
};

// Determines if a message is valid for context use
const isValidContextMsg = msg => {
    // If the message isn't a normal text message, ignore it
    if (msg.type != Discord.MessageType.Default && msg.type != Discord.MessageType.Reply) return false;
    // If vision is enabled
    if (config.gpt.vision.enabled) {
        // If the message has no content and no attachments, ignore it
        if (!msg.attachments.size && !msg.content) return false;
    } else {
        // If the message has no content, ignore it
        if (!msg.content) return false;
    }
    // If bots are configured to be ignored and it's a bot
    // that isn't outs, ignore it
    if (config.gpt.ignore_bots && msg.author.bot && msg.author.id != msg.client.user.id)
        return false;
    return true;
};

// Returns 1 for access granted, 0 for denied, and -1 for blocked
const getUserAccessStatus = id => {
    // Get access data
    const data = require('./access.json');
    let userStatus = data.users[id] || 0;
    data.users[id] = userStatus;
    if (id == config.bot.owner_id) data.users[id] = 1;
    // Write access data
    fs.writeFileSync('./access.json', JSON.stringify(data, null, 4));
    // Disallow blocked users
    if (userStatus == -1) return -1;
    // If the bot is private, disallow all users not explicitly allowed
    if (!data.public_usage) {
        if (userStatus != 1) return 0;
    }
    return 1;
};

// Get the nickname/name/username of the author of a message
const getMsgAuthorName = msg => {
    return msg.member?.nickname || msg.author.globalName || msg.author.username;
}

// Get the nickname/name/username of a user
const getUserName = (id, guild = null) => {
    const bot = require('./bot');
    const member = guild?.members.cache.get(id);
    const user = bot.users.cache.get(id);
    return member?.nickname || user?.globalName || user?.username || id;
}

// Get message content with user mentions replaced with their names
const getSanitizedContent = msg => {
    if (!msg.content) return '';
    return msg.content.replace(/<@!?(\d+)>/g, (match, id) => {
        return getUserName(id, msg.guild) || match;
    });
};

const streamChatCompletionOpts = {
    messages: [ {
        role: 'system',
        content: ''
    }, {
        role: 'assistant',
        content: [ {
            type: 'text', text: ''
        } ]
    }, {
        role: 'user',
        content: [ {
            type: 'image_url', 
            image_url: {
                url: '', detail: 'auto'
            }
        } ]
    } ],
    onChunk: (chunk = '') => {},
    onFinish: (response = '') => { return response },
    onError: (error) => { throw new Error(error) },
    model: config.gpt.model
};
const streamChatCompletion = async(opts = streamChatCompletionOpts) => {
    // Merge opts
    opts = Object.assign({}, streamChatCompletionOpts, opts);
    try {
        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: config.credentials.openai_secret
        });
        // Get response stream
        const stream = await openai.chat.completions.create({
            model: opts.model,
            messages: opts.messages,
            stream: true
        });
        let response = '';
        // Handle response chunks as they come in
        for await (const chunkData of stream) {
            const chunk = chunkData.choices[0].delta.content || '';
            response += chunk;
            opts.onChunk(chunk);
        }
        // Handle completion
        return opts.onFinish(response);
    } catch (error) {
        opts.onError(error);
        return null;
    }
}

module.exports = {
    countStringTokens,
    adjustImageDimensions,
    imageDimensions,
    countImageTokens,
    countTokensInContentEntry,
    replaceConfigPlaceholders,
    isValidInputMsg,
    isValidContextMsg,
    getUserAccessStatus,
    getMsgAuthorName,
    getUserName,
    getSanitizedContent,
    streamChatCompletion
}