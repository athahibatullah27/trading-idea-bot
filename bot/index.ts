import { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { 
  mockCryptoData, 
  mockNews, 
  mockRecommendations, 
  mockMarketConditions,
  mockGeopoliticalFactors 
} from '../src/data/mockData.js';
import { TradingRecommendation, CryptoData, NewsItem } from '../src/types/trading.js';

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Discord bot is ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Bot is serving ${readyClient.guilds.cache.size} servers`);
  
  // Set bot status
  client.user?.setActivity('crypto markets 📈', { type: 3 }); // 3 = Watching
});

// Helper function to create market overview embed
function createMarketOverviewEmbed() {
  const embed = new EmbedBuilder()
    .setColor(mockMarketConditions.overall === 'bullish' ? 0x00ff00 : 
             mockMarketConditions.overall === 'bearish' ? 0xff0000 : 0xffff00)
    .setTitle('📊 Market Overview')
    .setDescription('Current crypto market conditions')
    .addFields(
      { 
        name: '📈 Market Sentiment', 
        value: `${mockMarketConditions.overall.toUpperCase()}`, 
        inline: true 
      },
      { 
        name: '⚡ Volatility', 
        value: `${mockMarketConditions.volatility.toUpperCase()}`, 
        inline: true 
      },
      { 
        name: '😱 Fear & Greed Index', 
        value: `${mockMarketConditions.fearGreedIndex}/100`, 
        inline: true 
      },
      { 
        name: '₿ BTC Dominance', 
        value: `${mockMarketConditions.dominance.btc}%`, 
        inline: true 
      },
      { 
        name: '⟠ ETH Dominance', 
        value: `${mockMarketConditions.dominance.eth}%`, 
        inline: true 
      }
    )
    .setTimestamp()
    .setFooter({ text: 'CryptoTrader Bot • Market data updated' });

  return embed;
}

// Helper function to create crypto analysis embed
function createCryptoAnalysisEmbed(crypto: CryptoData) {
  const isPositive = crypto.change24h > 0;
  const rsiStatus = crypto.rsi >= 70 ? 'Overbought 🔴' : 
                   crypto.rsi <= 30 ? 'Oversold 🟢' : 'Neutral 🟡';
  
  const embed = new EmbedBuilder()
    .setColor(isPositive ? 0x00ff00 : 0xff0000)
    .setTitle(`${crypto.name} (${crypto.symbol})`)
    .setDescription('Technical Analysis & Market Data')
    .addFields(
      { 
        name: '💰 Current Price', 
        value: `$${crypto.price.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '📊 24h Change', 
        value: `${crypto.change24h > 0 ? '+' : ''}${crypto.change24h.toFixed(2)}%`, 
        inline: true 
      },
      { 
        name: '📈 Volume (24h)', 
        value: `$${(crypto.volume / 1e9).toFixed(1)}B`, 
        inline: true 
      },
      { 
        name: '🎯 RSI (14)', 
        value: `${crypto.rsi.toFixed(1)} - ${rsiStatus}`, 
        inline: true 
      },
      { 
        name: '📉 MACD', 
        value: `${crypto.macd > 0 ? '+' : ''}${crypto.macd.toFixed(1)}`, 
        inline: true 
      },
      { 
        name: '💎 Market Cap', 
        value: `$${(crypto.marketCap / 1e9).toFixed(1)}B`, 
        inline: true 
      }
    )
    .setTimestamp()
    .setFooter({ text: 'CryptoTrader Bot • Technical Analysis' });

  return embed;
}

// Helper function to create trading recommendation embed
function createRecommendationEmbed(recommendation: TradingRecommendation) {
  const actionEmoji = recommendation.action === 'buy' ? '🟢' : 
                     recommendation.action === 'sell' ? '🔴' : '🟡';
  const riskEmoji = recommendation.riskLevel === 'low' ? '🟢' : 
                   recommendation.riskLevel === 'high' ? '🔴' : '🟡';
  
  const embed = new EmbedBuilder()
    .setColor(recommendation.action === 'buy' ? 0x00ff00 : 
             recommendation.action === 'sell' ? 0xff0000 : 0xffff00)
    .setTitle(`${actionEmoji} ${recommendation.action.toUpperCase()} ${recommendation.crypto}`)
    .setDescription(`AI Trading Recommendation • ${recommendation.confidence}% Confidence`)
    .addFields(
      { 
        name: '🎯 Target Price', 
        value: `$${recommendation.targetPrice.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '🛡️ Stop Loss', 
        value: `$${recommendation.stopLoss.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '⏰ Timeframe', 
        value: recommendation.timeframe, 
        inline: true 
      },
      { 
        name: '⚠️ Risk Level', 
        value: `${riskEmoji} ${recommendation.riskLevel.toUpperCase()}`, 
        inline: true 
      },
      { 
        name: '🤖 AI Analysis', 
        value: recommendation.reasoning.map(reason => `• ${reason}`).join('\n'), 
        inline: false 
      }
    )
    .setTimestamp()
    .setFooter({ text: 'CryptoTrader Bot • AI-Powered Analysis' });

  return embed;
}

// Helper function to create news embed
function createNewsEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('📰 Latest Crypto News & Sentiment')
    .setDescription('Recent market-moving news with sentiment analysis')
    .setTimestamp()
    .setFooter({ text: 'CryptoTrader Bot • News Analysis' });

  mockNews.slice(0, 5).forEach((news: NewsItem, index: number) => {
    const sentimentEmoji = news.sentiment === 'bullish' ? '🟢' : 
                          news.sentiment === 'bearish' ? '🔴' : '🟡';
    const impactEmoji = news.impact === 'high' ? '🔥' : 
                       news.impact === 'medium' ? '⚡' : '💫';
    
    embed.addFields({
      name: `${sentimentEmoji} ${news.title}`,
      value: `${impactEmoji} ${news.impact.toUpperCase()} impact • ${news.source} • ${news.timestamp}`,
      inline: false
    });
  });

  return embed;
}

// Message handler for commands
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  try {
    // Hello command for #testing-hub channel
    if (content === '!hello' && message.channel.name === 'testing-hub') {
      await message.channel.send('Hello too');
      return;
    }

    // Trading idea command
    if (content.includes('!tradingidea') || content.includes('!idea') || content.includes('trading idea')) {
      await message.channel.send('🤖 **Analyzing current market conditions...**');
      
      // Send market overview
      const marketEmbed = createMarketOverviewEmbed();
      await message.channel.send({ embeds: [marketEmbed] });

      // Send top recommendations
      for (const recommendation of mockRecommendations.slice(0, 2)) {
        const recEmbed = createRecommendationEmbed(recommendation);
        await message.channel.send({ embeds: [recEmbed] });
      }

      return;
    }

    // Market analysis command
    if (content.includes('!market') || content.includes('market analysis')) {
      const marketEmbed = createMarketOverviewEmbed();
      await message.channel.send({ embeds: [marketEmbed] });
      return;
    }

    // Crypto analysis command (e.g., !btc, !eth, !sol)
    const cryptoMatch = content.match(/!(btc|eth|sol|ada)/);
    if (cryptoMatch) {
      const symbol = cryptoMatch[1].toUpperCase();
      const crypto = mockCryptoData.find(c => c.symbol === symbol);
      
      if (crypto) {
        const cryptoEmbed = createCryptoAnalysisEmbed(crypto);
        await message.channel.send({ embeds: [cryptoEmbed] });
      } else {
        await message.channel.send(`❌ Sorry, I don't have data for ${symbol} yet.`);
      }
      return;
    }

    // News command
    if (content.includes('!news') || content.includes('crypto news')) {
      const newsEmbed = createNewsEmbed();
      await message.channel.send({ embeds: [newsEmbed] });
      return;
    }

    // Help command
    if (content.includes('!help') || content.includes('!commands')) {
      const helpEmbed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('🤖 CryptoTrader Bot Commands')
        .setDescription('Available commands for crypto trading analysis')
        .addFields(
          { name: '!tradingidea', value: 'Get AI-powered trading recommendations', inline: false },
          { name: '!market', value: 'View current market overview', inline: false },
          { name: '!btc, !eth, !sol, !ada', value: 'Get technical analysis for specific crypto', inline: false },
          { name: '!news', value: 'Latest crypto news with sentiment analysis', inline: false },
          { name: '!help', value: 'Show this help message', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'CryptoTrader Bot • AI-Powered Trading Analysis' });

      await message.channel.send({ embeds: [helpEmbed] });
      return;
    }

    // Greeting responses
    if (content.includes('hello') || content.includes('hi') || content.includes('hey')) {
      await message.channel.send('👋 Hello! I\'m your AI crypto trading assistant. Type `!help` to see available commands or `!tradingidea` for today\'s recommendations!');
      return;
    }

  } catch (error) {
    console.error('Error handling message:', error);
    await message.channel.send('❌ Sorry, I encountered an error processing your request. Please try again.');
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});