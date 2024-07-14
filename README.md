# discord-chatgpt-v2
A Discord bot allowing users to interact with OpenAI's large-language models.

![Sample](/sample.png)

This is a complete rewrite of my original [discord-chatgpt](https://github.com/CyberGen49/discord-chatgpt) bot, updated with better code quality, privacy, and features like split message responses and better conversational context.

## Running the bot
1. [Download and install Node.js](https://nodejs.org/en/download/) if you don't have it
1. Clone (or download and unzip) the repository and `cd` into it with your terminal
1. Run `npm install`
1. Rename `config-.json` to `config.json`
    * This prevents your config from being overwritten should you update your bot.
1. [Generate an OpenAI API key](https://platform.openai.com/account/api-keys) and paste it in the `credentials.openai_secret` config field
    * **Note:** Using OpenAI's APIs isn't free. See their [pricing](https://openai.com/pricing) for more info.
1. [Create a new Discord application](https://discord.com/developers/applications)
    1. Set its name, description (about me), and picture as you see fit
    1. Copy the Application ID and paste it in the `credentials.discord_application_id` config field
    1. Go to the "Bot" tab and create a new bot if it's not created already
    1. Copy the bot token and paste it in the `credentials.discord_bot_token` config field
    1. Scroll down and make sure "Message content intent" is enabled
1. Set your Discord user ID in the `bot.owner_id` config field. Get this by turning on developer mode in settings and right-clicking on your profile.
1. Make any other changes to the config file, then save it.
1. Register the bot's slash and context menu commands by running `node registerCommands.js`
1. Start the bot with `node bot.js`
    * Pro tip: Install [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run the bot with `pm2 start`.
1. Once the bot logs in, an invite URL will be logged. Open it and follow the instructions to add the bot to your server.
1. Try it out by DMing or pinging the bot!

### Configuration
The bot can be configured by editing the `config.json` file, as you did during setup. All config options are as follows:

- object `credentials`: Contains authentication settings
    - string `openai_secret`: Your OpenAI API key
    - string `discord_bot_token`: Your Discord bot's token
    - string `discord_application_id`: Your Discord application/client ID
- object `gpt`: Contains language model settings
    - string `model`: One of OpenAI's [models](https://platform.openai.com/docs/models/overview) (specifically the newer GPT models)
    - number `context_msg_count_max`: The maximum number of messages above the prompt message to use as context.
    - number `context_msg_count_min`: The minimum number of messages above the prompt message to use as context, regardless of token usage.
    - array `messages[]`: A list of messages to be inserted at the beginning of every API request. Note that a `system` message containing the date and time, bot name, and other basic instructions is added automatically, placed after this set of messages.
        - string `role`: Set to `system`, `assistant`, or `user`. `system` messages can be used to influence the model's behavior and give it information, `assistant` messages are those sent by the model, and `user` messages are those sent by the user.
        - string `content`: The message's text content
    - object `vision`: Contains settings for [Vision](https://platform.openai.com/docs/guides/vision)
        - boolean `enabled`: Set to `true` to allow supported models to process images.
        - boolean `low_resolution`: Set to `true` to use [low detail mode](https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding).
        - number `tokens_base`: The number of tokens used by every image regardless of resolution.
        - number `tile_size`: The length of one side of a high-res image tile.
        - number `tokens_per_tile`: The number of tokens used by each 512x tile of a high resolution image (after resizing). This doesn't apply when `low_resolution` is enabled.
        - object `resize`: Contains short and long side dimensions to calculate final high-res image dimensions. Resizing happens remotely.
            - number `short_side`: The short side length
            - number `long_side`: The long side length
- object `bot`: Contains settings for the Discord bot
    - string `owner_id`: The Discord user ID of the bot maintainer (you, most likely). Only this user can use admin commands like `/users`.
    - object `status`: Contains settings for the bot's activity status
        - string `type`: Set to `Playing`, `Watching`, or `Listening`, determines the part in bold at the beginning of the status. Set to `Custom` to remove the prefix and use `text` to set the entire status.
        - string `text`: The text following the activity type. `{messages_month}` is replaced with the number of messages sent to the bot this month, and `{messages_total}` is replaced with the number of messages sent to the bot in total.
    - boolean `split_responses`: Determines whether or not model responses are split and sent by paragraph. When this is `false`, the model's response will be sent as a single message instead of several smaller messages. Responses will still be split if they exceed Discord's character limit.
    - number `response_part_min_delay`: The minimum number of milliseconds of delay that should exist between sending message parts. This will not impact the speed at which the response is generated, only how fast it's sent. Low numbers for this option might lead to the bot hitting rate limits, causing uneven and extended delays.
- object `messages`: Contains settings for every user-facing message sent by the bot. These aren't be listed here. Use each key's name and existing value to determine its purpose.

### User access control
As the owner, you're always allowed to use the bot, but other users can be allowed or blocked by you by using the `/users` commands or by editing the `access.json` file.

`access.json` contains the following properties:

- boolean `public_usage`: When set to `true`, anyone except explicitly blocked users can use the bot. When set to `false`, only users explicitly allowed can use the bot.
- object `users`: Contains a property for each user ID that has used the bot so far. When a user invokes the bot, they are automatically added to this list with a value of `0`.
    - number `<user_id>`: This value can have one of three states: `1` explicitly allows the user, `0` means the user follows the `public_usage` setting, and `-1` explicitly blocks the user.

Edits made to `access.json` are applied immediately. Ensure that the file is properly JSON-formatted before saving to avoid errors and crashes.

The `/users` commands are as follows:

- `/users allow <user>`: Grants explicit usage access to a user.
- `/users block <user>`: Explicitly blocks a user.
- `/users unlist <user>`: "Unlists" a user so their access is determined by `access.public_usage`.
- `/users list`: Lists users sorted into allowed, blocked, and unlisted categories.