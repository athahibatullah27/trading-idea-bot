import { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { REST, Routes } from 'discord.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { 
  mockCryptoData, 
  mockNews, 
  mockMarketConditions,
  mockGeopoliticalFactors 
} from '../src/data/mockData.js';
import { TradingRecommendation, CryptoData, NewsItem } from '../src/types/trading.js';
import { getRealTimeCryptoData, getMultipleCryptoData, testAPIConnection } from './tradingview.js';
import { generateGeminiRecommendations } from './geminiService.js';
import { getMarketConditions } from '../src/services/tradingService.js';

// Load environment variables
dotenv.config();

// Create Express server for API proxy
const app = express();
app.use(cors());
app.use(express.json());

// API endpoint for crypto data
app.get('/api/crypto-data', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    const data = await getRealTimeCryptoData(symbol as string);
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: `No data available for ${symbol}` });
    }
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for multiple crypto data
app.get('/api/multiple-crypto-data', async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }

    const symbolArray = (symbols as string).split(',');
    const data = await getMultipleCryptoData(symbolArray);
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for testing connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const isConnected = await testAPIConnection();
    res.json({ connected: isConnected });
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({ connected: false, error: 'Test failed' });
  }
});

// API endpoint for Gemini-powered recommendations
app.get('/api/gemini-recommendations', async (req, res) => {
  try {
    console.log('🤖 Generating Gemini recommendations...');
    
    // Fetch latest crypto data
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA'];
    const cryptoData = await getMultipleCryptoData(symbols);
    
    if (cryptoData.length === 0) {
      return res.status(503).json({ 
        error: 'Unable to fetch market data for analysis. Please try again later.',
        userMessage: 'Market data is currently unavailable. Please check back in a few minutes.'
      });
    }
    
    // Generate recommendations using Gemini
    const recommendations = await generateGeminiRecommendations(
      cryptoData,
      mockNews.slice(0, 3), // Include recent news
      mockMarketConditions   // Include market conditions
    );
    
    if (recommendations.length === 0) {
      return res.status(503).json({ 
        error: 'AI analysis service is temporarily unavailable. Please try again later.',
        userMessage: 'Our AI trading analysis is currently unavailable. This could be due to high demand or maintenance. Please try again in a few minutes.'
      });
    }
    
    console.log(`✅ Successfully generated ${recommendations.length} Gemini recommendations`);
    res.json(recommendations);
    
  } catch (error) {
    console.error('Gemini recommendations error:', error);
    res.status(500).json({ 
      error: 'AI analysis service encountered an error. Please try again later.',
      userMessage: 'We encountered an issue while analyzing the market. Please try again in a few minutes.'
    });
  }
});

// Start the proxy server
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌐 API proxy server running on port ${PORT}`);
});

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
  
  // Register slash commands
  registerSlashCommands();
  
  // Test API connection on startup
  testAPIConnection().then(isConnected => {
    if (isConnected) {
      console.log('🌐 Real-time data APIs are working');
    } else {
      console.log('⚠️ Real-time data APIs are not available, using fallback data');
    }
  });
  
  // Set bot status
  client.user?.setActivity('crypto markets 📈', { type: 3 }); // 3 = Watching
});

// Function to register slash commands
async function registerSlashCommands() {
  try {
    console.log('🔄 Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);
    
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;
    
    if (!clientId) {
      console.error('❌ DISCORD_CLIENT_ID is not set in .env file');
      return;
    }
    
    // Convert commands to JSON
    const commandsData = commands.map(command => command.toJSON());
    
    if (guildId) {
      // Register commands for a specific guild (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );
      console.log(`✅ Successfully registered ${commandsData.length} guild commands for server ${guildId}`);
    } else {
      // Register commands globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData }
      );
      console.log(`✅ Successfully registered ${commandsData.length} global commands`);
    }
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

// Helper function to create market overview embed
function createMarketOverviewEmbed(marketConditions = mockMarketConditions) {
  const embed = new EmbedBuilder()
    .setColor(marketConditions.overall === 'bullish' ? 0x00ff00 : 
             marketConditions.overall === 'bearish' ? 0xff0000 : 0xffff00)
    .setTitle('📊 Market Overview')
    .setDescription('Current crypto market conditions')
    .addFields(
      { 
        name: '📈 Market Sentiment', 
        value: `${marketConditions.overall.toUpperCase()}`, 
        inline: true 
      },
      { 
        name: '⚡ Volatility', 
        value: `${marketConditions.volatility.toUpperCase()}`, 
        inline: true 
      },
      { 
        name: '😱 Fear & Greed Index', 
        value: `${marketConditions.fearGreedIndex}/100`, 
        inline: true 
      },
      { 
        name: '₿ BTC Dominance', 
        value: `${marketConditions.dominance.btc}%`, 
        inline: true 
      },
      { 
        name: '⟠ ETH Dominance', 
        value: `${marketConditions.dominance.eth}%`, 
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
    // Legacy support for !tradingidea (redirect to slash command)
    if (content.includes('!tradingidea') || content.includes('!idea') || content.includes('trading idea')) {
      await message.channel.send('🔄 **The bot now uses slash commands!** Please use `/tradingidea` instead of `!tradingidea` for better performance and features.');
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
      
      // Try to get real-time data first
      const loadingMsg = await message.channel.send(`🔄 **Fetching live ${symbol} data...**`);
      
      try {
        const realTimeCrypto = await getRealTimeCryptoData(symbol);
        
        if (realTimeCrypto && realTimeCrypto.price > 0) {
          await loadingMsg.edit(`✅ **Live ${symbol} analysis ready!**`);
          const cryptoEmbed = createCryptoAnalysisEmbed(realTimeCrypto);
          await message.channel.send({ embeds: [cryptoEmbed] });
        } else {
          throw new Error('No real-time data available');
        }
      } catch (error) {
        console.error(`Error fetching real-time data for ${symbol}:`, error);
        
        // Fallback to mock data
        const crypto = mockCryptoData.find(c => c.symbol === symbol);
        if (crypto) {
          await loadingMsg.edit(`⚠️ **Using cached ${symbol} data due to API limitations.**`);
          const cryptoEmbed = createCryptoAnalysisEmbed(crypto);
          await message.channel.send({ embeds: [cryptoEmbed] });
        } else {
          await loadingMsg.edit(`❌ **Sorry, I don't have data for ${symbol} yet.**`);
        }
      }
      return;
    }

    // Real-time test command (for debugging)
    if (content.includes('!test') || content.includes('!apitest')) {
      const testMsg = await message.channel.send('🧪 **Testing API connections...**');
      
      const isWorking = await testAPIConnection();
      if (isWorking) {
        await testMsg.edit('✅ **API connections are working! Real-time data is available.**');
      } else {
        await testMsg.edit('❌ **API connections failed. Using cached data as fallback.**');
      }
      return;
    }

    // Quick price command
    if (content.includes('!price')) {
      const priceMatch = content.match(/!price\s+(btc|eth|sol|ada|bnb|xrp)/i);
      if (priceMatch) {
        const symbol = priceMatch[1].toUpperCase();
        const loadingMsg = await message.channel.send(`💰 **Getting ${symbol} price...**`);
        
        try {
          const crypto = await getRealTimeCryptoData(symbol);
          if (crypto && crypto.price > 0) {
            const changeEmoji = crypto.change24h > 0 ? '📈' : '📉';
            const changeColor = crypto.change24h > 0 ? '🟢' : '🔴';
            
            await loadingMsg.edit(
              `💰 **${crypto.name} (${symbol})**\n` +
              `**Price:** $${crypto.price.toLocaleString()}\n` +
              `**24h Change:** ${changeColor} ${crypto.change24h > 0 ? '+' : ''}${crypto.change24h.toFixed(2)}% ${changeEmoji}`
            );
          } else {
            throw new Error('No price data available');
          }
        } catch (error) {
          await loadingMsg.edit(`❌ **Could not fetch ${symbol} price. Please try again later.**`);
        }
        return;
      } else {
        await message.channel.send('💡 **Usage:** `!price btc` or `!price eth` etc.');
        return;
      }
    }

    // Crypto analysis command (e.g., !btc, !eth, !sol) - This block was moved above
    const cryptoMatch2 = content.match(/!(btc|eth|sol|ada)/);
    if (cryptoMatch2) {
      const symbol = cryptoMatch2[1].toUpperCase();
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
          { name: '!price [crypto]', value: 'Get quick price for any crypto (e.g., !price btc)', inline: false },
          { name: '!news', value: 'Latest crypto news with sentiment analysis', inline: false },
          { name: '!test', value: 'Test API connectivity', inline: false },
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