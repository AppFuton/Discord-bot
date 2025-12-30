# Discord GitHub Feed Bot

A small Discord bot that receives GitHub webhooks and forwards events into configured channels.

Features
- Slash commands to set a **feed** channel (commits, PRs, issues, actions, etc.) and a **release** channel (releases + prereleases)
- Verifies GitHub webhook signatures
- Simple JSON storage for server configuration (single-server-focused)

Setup
1. Copy `.env.example` to `.env` and fill values:
   - `DISCORD_TOKEN` - your bot token
   - `CLIENT_ID` - the Application ID of your bot
   - `GUILD_ID` - (recommended) the guild ID to register guild-only commands
   - `GITHUB_WEBHOOK_SECRET` - secret used when creating GitHub webhook
   - `PORT` - port for webhook server (default 3000)

2. Install dependencies:

   npm install

3. Run the bot:

   npm run dev

4. Expose your dev server with a public URL (e.g., using ngrok) and add a webhook on the GitHub repository settings:
   - Payload URL: `https://<your-host>/github-webhook`
   - Content type: `application/json`
   - Secret: same value as `GITHUB_WEBHOOK_SECRET`
   - Select events: "Let me select individual events" and choose: Pushes, Pull requests, Issues, Workflow runs, Releases (only releases will go to the release channel)

5. Use slash commands in your server:
   - `/set-feed-channel channel:#channel` — sets the channel for commits, PRs, issues, actions
   - `/set-release-channel channel:#channel` — sets the channel for release notifications
   - `/show-github-channels` — display current configuration

Notes
- The bot sends release events only to the release channel and all other events to the feed channel.
- This is intentionally simple and focused for single-server use. Improve storage or multi-server behavior as needed.

Security
- Make sure to set `GITHUB_WEBHOOK_SECRET` and use it in GitHub webhook settings.

License: MIT
