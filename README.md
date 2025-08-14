# Discord Crypto Trading Bot

An AI-powered Discord bot that provides crypto trading analysis, market insights, and trading recommendations.

## Features

- 🤖 AI-powered trading recommendations
- 📊 Technical analysis (RSI, MACD, Bollinger Bands)
- 📰 News sentiment analysis
- 🌍 Market conditions and geopolitical factors
- 💬 Interactive Discord commands
- 📈 Real-time market data

## Setup Instructions

### 1. Create Discord Bot Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Copy the bot token (keep this secret!)
5. Enable "Message Content Intent" under Privileged Gateway Intents

### 2. Configure Environment Variables

1. Copy your bot token
2. Open the `.env` file in the project root
3. Replace `your_bot_token_here` with your actual bot token:
   ```
   DISCORD_BOT_TOKEN=your_actual_bot_token_here
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Bot

You have several options:

**Option 1: Run bot and dashboard together**
```bash
npm run dev:all
```

**Option 2: Run bot only**
```bash
npm run bot
```

**Option 3: Run dashboard only**
```bash
npm run dev
```

### 5. Invite Bot to Your Server

1. Go to Discord Developer Portal > Your App > OAuth2 > URL Generator
2. Select scopes: `bot`
3. Select permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`
4. Copy the generated URL and open it to invite the bot

## Discord Commands

The bot uses Discord slash commands for better user experience:

- `/tradingidea` - Get AI-powered trading recommendations with real-time analysis
- `/market` - View current market overview and conditions
- `/crypto [symbol]` - Get technical analysis for specific cryptocurrency
- `/price [symbol]` - Get quick price information for any crypto
- `/news` - Latest crypto news with sentiment analysis
- `/test` - Test API connectivity and bot status
- `/help` - Show available commands and usage

### Setting Up Slash Commands

To enable slash commands, you need to add these environment variables to your `.env` file:

```env
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_GUILD_ID=your_server_guild_id_for_testing
```

**Finding your Discord IDs:**
1. **Client ID**: Go to [Discord Developer Portal](https://discord.com/developers/applications) → Your App → General Information → Application ID
2. **Guild ID**: Right-click your Discord server → Copy Server ID (requires Developer Mode enabled in Discord settings)

## Bot Features

### Market Analysis
- Real-time price data and 24h changes
- Technical indicators (RSI, MACD)
- Volume and market cap analysis
- Bollinger Bands calculations

### AI Recommendations
- Buy/Sell/Hold recommendations
- Confidence scores (0-100%)
- Target prices and stop losses
- Risk level assessment
- Detailed reasoning

### News & Sentiment
- Latest crypto news aggregation
- Sentiment analysis (Bullish/Bearish/Neutral)
- Impact assessment (High/Medium/Low)
- Source attribution

### Market Conditions
- Overall market sentiment
- Volatility assessment
- Fear & Greed Index
- Bitcoin dominance tracking

## Development

The project consists of two main parts:

1. **React Dashboard** (`src/`) - Web interface for viewing analysis
2. **Discord Bot** (`bot/`) - Discord integration and commands

### File Structure

```
├── src/                    # React dashboard
│   ├── components/         # UI components
│   ├── data/              # Mock data and types
│   └── types/             # TypeScript definitions
├── bot/                   # Discord bot
│   └── index.ts          # Bot logic and commands
├── .env                  # Environment variables
└── package.json          # Dependencies and scripts
```

### Adding New Commands

To add new Discord commands, edit `bot/index.ts` and add new message handlers in the `Events.MessageCreate` listener.

### Customizing Analysis

Modify the mock data in `src/data/mockData.ts` to customize the analysis results, or integrate with real APIs for live data.

## Security Notes

- Never commit your `.env` file to version control
- Keep your Discord bot token secret
- Use environment variables for all sensitive data
- Regularly rotate your bot token if compromised

## Troubleshooting

**Bot not responding:**
- Check if bot token is correct in `.env`
- Ensure bot has proper permissions in Discord server
- Check console for error messages

**Commands not working:**
- Verify bot can read messages (Message Content Intent enabled)
- Check if bot is online in Discord
- Try `!help` command first

**Development issues:**
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires Node 16+)
- Verify TypeScript compilation with `npm run build`