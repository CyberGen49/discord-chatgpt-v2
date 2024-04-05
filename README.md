# discord-chatgpt-v2
A Discord bot allowing users to interact with OpenAI's large-language models.

This is a complete rewrite of my original [discord-chatgpt](https://github.com/CyberGen49/discord-chatgpt) bot, updated for efficiency and simplicity.

## Running the bot
1. [Download and install Node.js](https://nodejs.org/en/download/) if you don't have it
1. [Download and install SQLite](https://www.sqlite.org/download.html) if you don't have it
1. Clone (or download and unzip) the repository and `cd` into it with your terminal
1. Run `npm install`
1. [Generate an OpenAI secret key](https://platform.openai.com/account/api-keys) and paste it in the `credentials.openai_secret` config field
    * Note: Using OpenAI's APIs isn't free. See their [pricing](https://openai.com/pricing) for more info.
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