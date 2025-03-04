# discord-chatgpt-v2
A Discord bot allowing users to interact with large-language models from OpenAI, DeepSeek, or Google.

![Sample](/sample.png)

This is a complete rewrite of my original [discord-chatgpt](https://github.com/CyberGen49/discord-chatgpt) bot, updated with better code quality, privacy, and features like split message responses, multiple model providers, and better conversational context.

## Running the bot
1. [Download and install Node.js](https://nodejs.org/en/download/) if you don't have it
2. Clone (or download and unzip) the repository and `cd` into it with your terminal
3. Run `npm install`
4. Rename `config-.json` to `config.json`
    * This prevents your config from being overwritten should you update your bot.
5. [Create a new Discord application](https://discord.com/developers/applications)
    1. Set its name, description (about me), and picture as you see fit
    2. Copy the Application ID and paste it in the `credentials.discord_application_id` config field
    3. Go to the "Bot" tab and create a new bot if it's not created already
    4. Copy the bot token and paste it in the `credentials.discord_bot_token` config field
    5. Scroll down and make sure "Message content intent" is enabled
6. Set your Discord user ID in the `bot.owner_id` config field. Get this by turning on developer mode in settings and right-clicking on your profile.
7. Configure an API key for your AI provider of choice:
    * OpenAI: [Get your API key](https://platform.openai.com/account/api-keys) and paste it into the `credentials.openai_secret` config field
    * DeepSeek: [Get your API key](https://platform.deepseek.com/api_keys) and paste it into the `credentials.deepseek_secret` config field
    * Google: [Get your API key](https://aistudio.google.com/apikey) and paste it into the `credentials.google_secret` config field
    * **Note:** Using these APIs isn't free. See their respective pricing resources for details.
8. Configure your AI provider and chosen model by updating the `gpt.provider` and `gpt.model` config fields:
    * OpenAI: Set `provider` to `openai` and `model` according to their [models reference](https://platform.openai.com/docs/models)  
      Recommended model(s): `gpt-4o-mini`, `gpt-4o`
    * DeepSeek: Set `provider` to `deepseek` and `model` according to their [models reference](https://api-docs.deepseek.com/quick_start/pricing)  
      Recommended model(s): `deepseek-chat`
    * Google: Set `provider` to `google` and `model` according to their [models reference](https://ai.google.dev/gemini-api/docs/models/gemini)  
      Recommended model(s): `gemini-2.0-flash`, `gemini-2.0-flash-lite`
9.  Make any other optional changes to the config file, then save it.
10. Register the bot's slash commands and Apps menu items by running `node registerCommands.js`
11. Start the bot with `node bot.js`
    * Pro tip: Install [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run the bot with `pm2 start`.
12. Once the bot logs in, an invite URL will be logged. Open it and follow the instructions to add the bot to your server.
13. Try it out by DMing or pinging the bot!

### Configuration
The bot can be configured by editing the `config.json` file, as you did during setup. All config options are as follows:

- object `credentials`: Contains authentication settings
    - string `openai_secret`: Your OpenAI API key
    - string `deepseek_secret`: Your Deepseek API key
    - string `google_secret`: Your Google AI Studio API key
    - string `discord_bot_token`: Your Discord bot's token
    - string `discord_application_id`: Your Discord application/client ID
- object `gpt`: Contains language model settings
    - string `provider`: One of `openai`, `deepseek`, or `google`
    - string `model`: A model from your provider. See the guide above for reference.
    - number `temperature`: The model's [temperature](https://platform.openai.com/docs/api-reference/audio/createTranscription#audio-createtranscription-temperature) value, ranging from `0` to `2`.
    - boolean `should_stream`: Whether or not the response should be streamed. If true, responses will be faster as they will be processed and sent by the bot while still being generated. This may not be supported with all models.
    - object[] `messages`: An array of message objects to be inserted at the beginning of every API request. Note that a `system` message containing the date and time, bot name, and other basic instructions is added automatically, placed after this set of messages.
        - string `role`: Set to `system`, `assistant`, or `user`. `system` messages can be used to influence the model's behavior and give it information, `assistant` messages are those sent by the model, and `user` messages are those sent by the user.
        - string `content`: The message's text content
    - number `context_msg_count_max`: The maximum number of messages above the prompt message to use as context.
    - number `context_msg_count_min`: The minimum number of messages above the prompt message to use as context, regardless of token usage.
    - number `context_tokens_max`: The minimum number of input tokens that context should use.
    - object `text_files`: Contains settings related to user-sent text files
        - boolean `enabled`: Whether or not user-sent text files should be read and processed by the model
        - string[] `extensions`: An array of attachment file extensions to treat as text files
        - number `max_bytes`: The max size that text files should be in order to be processed
    - object `vision`: Contains settings for [Vision](https://platform.openai.com/docs/guides/vision) - supported by most `openai` and `google` models
        - boolean `enabled`: Set to `true` to allow supported models to process images.
        - boolean `low_resolution`: Set to `true` to use [low detail mode](https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding).
        - number `tokens_base`: The number of tokens used by every image regardless of resolution. Update this value to match your model's specifications.
        - number `tokens_per_tile`: The number of tokens used by each `tile_size`x tile of a high resolution image (after resizing). This doesn't apply when `low_resolution` is enabled. Update this value to match your model's specifications.
        - object `resize`: Contains short and long side dimensions to calculate final high-res image dimensions. Resizing happens remotely.
            - number `short_side`: The short side length
            - number `long_side`: The long side length
        - number `tile_size`: The length of one side of a high-res image tile.
    - object `replacements`: Contains key-value pairs for strings to replace with other strings in model responses, where the key is the target string and the value is the replacement string. By default, this is used to replace common LaTeX control strings with their respective Unicode characters.
    - boolean `ignore_bots`: Whether or not bot messages (not from this bot) should be excluded from context provided to the model.
- object `bot`: Contains settings for the Discord bot
    - string `owner_id`: The Discord user ID of the bot maintainer (you, most likely). Only this user can use admin commands like `/users`.
    - object `status`: Contains settings for the bot's activity status
        - string `type`: Set to `Playing`, `Watching`, or `Listening`, determines the part in bold at the beginning of the status. Set to `Custom` to remove the prefix and use `text` to set the entire status.
        - string `text`: The text following the activity type. `{messages_month}` is replaced with the number of messages sent to the bot this month, and `{messages_total}` is replaced with the number of messages sent to the bot in total.
    - boolean `split_responses`: Determines whether or not model responses are split and sent by paragraph. When this is `false`, the model's response will be sent as a single message instead of several smaller messages. Responses will still be split if they exceed Discord's character limit.
    - number `response_part_min_delay`: The minimum number of milliseconds of delay that should exist between sending message parts. This will not impact the speed at which the response is generated, only how fast it's sent. Low numbers for this option might lead to the bot hitting rate limits, causing uneven and extended delays.
    - string|number `embed_color`: The accent color to use on slash command embeds. Should be in hexadecimal format, including the leading `#`, or a decimal number.
    - number `interaction_max_age_hours`: The maximum age (in hours) of saved interaction JSON files before automatic deletion
- object `messages`: Contains settings for every user-facing message sent by the bot. These aren't be listed here. Use each key's name and existing value to guestimate its purpose.

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

### Context management
Sometimes language models can produce unexpected or unwanted results. If this happens during a conversation, use the `/contextbarrier` command to ignore all previous messages. Replying to a message before the barrier will still include it as context, but otherwise context barriers give you a fresh start.

### Saving/removing responses
Interactions are saved as JSON files in the `interactions` folder for the duration of time set in `config.bot.interaction_max_age_hours`.

If the model's output isn't formatted correctly in Discord and you want to remove it or view it as raw text, or to get the raw text output for any other reason, right click on any sub-message produced by the bot and enter the Apps menu for download and removal options.

* **Delete response message**: Deletes the immediate response sub-message
* **Get response text**: Replies with a text file containing the complete response as raw text/markdown

The latter option only works if the interaction JSON file is still available (hasn't been deleted).