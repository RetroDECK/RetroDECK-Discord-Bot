# RetroDECK Donation Bot

A Discord bot that automatically assigns a **Donator** role to users who have donated to the [RetroDECK OpenCollective](https://opencollective.com/retrodeck). The bot verifies donations by cross-referencing the user's email against the OpenCollective GraphQL API.

## How It Works

1. A user runs the `/claim-donation` slash command in any channel.
2. A private modal (form) opens, prompting them to enter the email they used on OpenCollective.
3. The bot queries the OpenCollective API to check if that email belongs to a backer of the collective.
4. If a match is found, the bot assigns the Donator role and confirms.
5. If no match is found, the bot suggests checking the email or contacting a moderator.

All interactions are **ephemeral** (only visible to the user), so the email address is never exposed to other members.

## Project Structure

```
retrodeck-donation-bot/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
├── data/
│   └── oc-token.json              # OAuth token (created by setup script, git-ignored)
├── src/
│   ├── index.js                   # Bot entry point, client setup, event routing
│   ├── deploy-commands.js         # Script to register slash commands with Discord
│   ├── setup-oauth.js             # One-time OAuth setup script
│   ├── commands/
│   │   └── claim-donation.js      # Slash command definition, modal, and verification logic
│   └── services/
│       ├── opencollective.js      # OpenCollective GraphQL API query logic
│       └── token-store.js         # OAuth token file read/write
```

## Prerequisites

- **Node.js** 20 or later
- **Docker** and **Docker Compose** (for containerized deployment)
- A **Discord bot application** with the required permissions
- An **OpenCollective OAuth application** with admin access to the collective

## Setup

### 1. Create a Discord Bot Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Navigate to **Bot** and generate a bot token. Save it for later.
3. Under **Privileged Gateway Intents**, enable **Server Members Intent** (required to assign roles).
4. Copy your **Application ID** from the **General Information** page.
5. Invite the bot to your server by opening this URL in your browser (replace `YOUR_APP_ID`):
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=268435456
   ```
   This requests the `bot` and `applications.commands` scopes with the `Manage Roles` permission (`268435456`).

### 2. Create an OpenCollective OAuth Application

1. Log in to [OpenCollective](https://opencollective.com/) as an admin of the collective.
2. Go to `https://opencollective.com/{your-org}/admin/for-developers`.
3. Create a new OAuth application.
4. Set the callback URL to `http://localhost:3000/callback`.
5. Note the **Client ID** and **Client Secret**.

### 3. Identify the Donator Role

1. In your Discord server, create a role called "Donator" (or use an existing one).
2. Make sure the bot's role is **above** the Donator role in the role hierarchy (Server Settings > Roles), otherwise it won't be able to assign it.
3. Enable **Developer Mode** in Discord (Settings > Advanced) and right-click the role to copy its ID.

### 4. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | The bot token from the Discord Developer Portal |
| `DISCORD_GUILD_ID` | Your Discord server ID (right-click server name > Copy Server ID) |
| `DISCORD_DONATOR_ROLE_ID` | The role ID for the Donator role |
| `OC_CLIENT_ID` | OpenCollective OAuth app client ID |
| `OC_CLIENT_SECRET` | OpenCollective OAuth app client secret |
| `OC_REDIRECT_URI` | OAuth redirect URI (default: `http://localhost:3000/callback`) |
| `OC_COLLECTIVE_SLUG` | The OpenCollective collective slug (e.g. `retrodeck`) |

### 5. Authenticate with OpenCollective

Run the OAuth setup script to obtain an access token:

```bash
npm install
npm run setup-oauth
```

A browser window will open asking you to authorize the app on OpenCollective with `email` and `account` scopes. After approval, the token is saved to `data/oc-token.json`. This only needs to be done once. If the token expires, re-run the command.

### 6. Register the Slash Command

Register the `/claim-donation` slash command with Discord:

```bash
npm run deploy-commands
```

This registers the command as a **guild-specific** command for fast updates. You only need to re-run this if you change the command definition.

### 7. Start the Bot

#### With Docker (recommended)

```bash
docker compose up -d
```

To view logs:

```bash
docker compose logs -f donation-bot
```

To rebuild after code changes:

```bash
docker compose up -d --build
```

#### Without Docker

```bash
npm start
```

## OpenCollective API Details

The bot uses the [OpenCollective GraphQL API v2](https://docs.opencollective.com/help/contributing/development/api) to verify donations, authenticating with an OAuth Bearer token.

**Primary strategy:** Query the collective's members (backers) and match the provided email against each member's `emails` field. The query paginates through all members automatically.

**Fallback strategy:** If the members query fails (e.g. due to permissions), the bot falls back to querying credit transactions and matching against the `fromAccount.emails` field.

Both strategies perform **case-insensitive** email matching.

The OAuth app requires the `email` and `account` scopes.

## Edge Cases

| Scenario | Behavior |
|---|---|
| User already has the Donator role | Skips the API call and tells the user they already have it |
| Email not found | Suggests double-checking the email or contacting a moderator |
| Guest/anonymous donation | Cannot be verified automatically; the bot mentions this possibility |
| OpenCollective API error | Responds with a generic error and logs the details to the console |
| OAuth token expired/invalid | Bot logs a clear error; re-run `npm run setup-oauth` to re-authenticate |
| No token file present | Bot refuses to start with instructions to run `npm run setup-oauth` |
| Discord rate limits | Handled automatically by Discord.js |

## License

This project is licensed under the [MIT License](LICENSE).
