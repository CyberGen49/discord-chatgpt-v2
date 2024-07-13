# discord-chatgpt-v2
A Discord bot allowing users to interact with OpenAI's large-language models.

![Sample](/sample.png)

This is a complete rewrite of my original [discord-chatgpt](https://github.com/CyberGen49/discord-chatgpt) bot, updated for simplicity with some additional features requested by users.

## Running the bot
1. [Download and install Node.js](https://nodejs.org/en/download/) if you don't have it
1. [Download and install SQLite](https://www.sqlite.org/download.html) if you don't have it
1. Clone (or download and unzip) the repository and `cd` into it with your terminal
1. Run `npm install`
1. [Generate an OpenAI API key](https://platform.openai.com/account/api-keys) and paste it in the `credentials.openai_secret` config field
    * **Note:** Using OpenAI's APIs isn't free. See their [pricing](https://openai.com/pricing) for more info.
1. [Create a new Discord application](https://discord.com/developers/applications)
    1. Set its name, description, and picture
    1. Copy the Application ID and paste it in the `credentials.discord_application_id` config field
    1. Go to the "Bot" tab and create a new bot
    1. Copy the bot token and paste it in the `credentials.discord_bot_token` config field
    1. Scroll down and make sure "Message content intent" is on
1. Set your Discord user ID in the `bot.owner_id` config field. Get this by turning on developer mode in settings and right-clicking on your profile.
1. Make any other changes to the config file, then save it.
1. Create the message database by running `sqlite3 storage.db ".read schema.sql"`.
1. Register the bot's slash and context menu commands by running `node registerCommands.js`
1. Start the bot with `node bot.js`
    * Pro tip: Install [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run the bot with `pm2 start`.
1. Once the bot logs in, an invite URL will be logged. Open it and follow the instructions to add the bot to your server.
1. Try it out by DMing or pinging the bot with a question!

As the owner, you're always allowed to use the bot, but with `config.bot.public_usage` disabled, nobody else will be able to. If a disallowed user tries using the bot, you'll get a DM with a button to allow them. You can also manage users manually with the `/users allow`, `/users block`, and `/users unlist` commands.

### Configuration
The bot can be configured by editing the `config.json` file, as you did during setup. All config options are as follows:

- object `credentials`: Contains authentication settings
    - string `openai_secret`: Your OpenAI API key
    - string `discord_bot_token`: Your Discord bot's token
    - string `discord_application_id`: Your Discord application/client ID
- object `gpt`: Contains language model settings
    - string `model`: One of OpenAI's [models](https://platform.openai.com/docs/models/overview) (specifically the newer GPT models)
    - object `price`: Contains model price information
        - number `input_token`: The calculated price for a single input token
        - number `output_token`: The calculated price for a single output token
    - number `max_tokens`: The maximum number of tokens (used as the `max_tokens` API parameter)
    - array `messages[]`: A list of messages to be inserted at the beginning of every API request
        - string `role`: Set to `system`, `assistant`, or `user`. `system` messages can be used to influence the model's behavior and give it information, `assistant` messages are those sent by the model, and `user` messages are those sent by the user.
        - string `content`: The message's text content
- object `bot`: Contains settings for the Discord bot
    - boolean `public_usage`: Determines whether or not anyone can use the bot. When this is `true`, everyone but people blocked with `/users block` can use the bot. When this is `false`, only people allowed with `/users allow` can use the bot.
    - string `owner_id`: The Discord user ID of the bot maintainer (you, most likely). Only this user can use admin commands like `/users`.
    - object `status`: Contains settings for the bot's activity status
        - string `type`: Set to `Playing`, `Watching`, or `Listening`, determines the part in bold at the beginning of the status. Set to `Custom` to remove the prefix and use `text` to set the entire status.
        - string `text`: The text following the activity type. `{messages_month}` is replaced with the number of messages sent to the bot this month, and `{messages_total}` is replaced with the number of messages sent to the bot in total.
    - boolean `split_responses`: Determines whether or not model responses are split and sent by paragraph. When this is `false`, the model's response will be sent as a single message instead of several smaller messages. Responses will still be split if they exceed Discord's character limit.
    - number `response_part_min_delay`: The minimum number of milliseconds of delay that should exist between sending message parts. This will not impact the speed at which the response is generated, only how fast it's sent. Low numbers for this option might lead to the bot hitting rate limits, causing uneven and extended delays.
- object `database`: Contains settings related to the storage database
    - number `message_lifetime_hours`: The maximum age a stored user-bot interaction will be stored before being deleted from the database. Setting this to a false value will disable interaction auto-deletion.
- object `messages`: Contains settings for every user-facing message sent by the bot. These aren't be listed here. Use each key's name and existing value to determine its purpose.