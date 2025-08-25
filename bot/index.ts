import { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { REST, Routes } from 'discord.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { TradingRecommendation, CryptoData, NewsItem } from './types.js';
import { getRealTimeCryptoData, getMultipleCryptoData, testAPIConnection } from './tradingview.js';
import { generateGeminiRecommendations } from './geminiService.js';
import { commands } from './commands.js';
import { fetchCoinDeskNews, testCoinDeskAPI } from './newsService.js';
import { getEnhancedDerivativesMarketData, testBinanceFuturesAPI } from './derivativesDataService.js';
import { generateDerivativesTradeIdea, DerivativesTradeIdea } from './geminiService.js';
import { buildEnhancedDerivativesTradePrompt } from './geminiService.js';
import { supabase } from './supabaseClient.js';
import { storeTradeRecommendation, evaluatePendingRecommendations, getEvaluationStats } from './evaluationService.js';
import { 
  logApiRequest, 
  logApiResponse, 
  logDatabaseOperation, 
  logDatabaseError,
  logDiscordInteraction, 
  startPerformanceTimer, 
  endPerformanceTimer, 
  logAppState,
  logFunctionEntry,
  logFunctionExit,
  log
} from './utils/logger.js';

// Load environment variables
dotenv.config();

// Log application startup
logAppState('STARTUP', { message: 'Crypto Trading Bot starting up...' });

// Create Express server for API proxy
const app = express();

// Configure CORS properly
app.use(cors({
  origin: [
    'https://inquisitive-gumdrop-7cbbda.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));

app.use(express.json());

// API endpoint for crypto data
app.get('/api/crypto-data', async (req, res) => {
  const timerId = startPerformanceTimer('crypto-data-endpoint');
  logApiRequest({
    endpoint: '/api/crypto-data',
    method: 'GET',
    params: req.query as Record<string, any>,
    headers: req.headers
  });
  
  try {
    const { symbol } = req.query;
    if (!symbol) {
      logApiResponse({ status: 400, data: { error: 'Symbol parameter is required' }, context: 'crypto data' });
      endPerformanceTimer(timerId);
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    const data = await getRealTimeCryptoData(symbol as string, 'crypto data');
    if (data) {
      logApiResponse({ status: 200, data, context: 'crypto data' });
      res.json(data);
    } else {
      logApiResponse({ status: 404, data: { error: `No data available for ${symbol}` }, context: 'crypto data' });
      res.status(404).json({ error: `No data available for ${symbol}` });
    }
  } catch (error) {
    console.error('API proxy error:', error);
    logApiResponse({ status: 500, error, data: { error: 'Internal server error' }, context: 'crypto data' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// API endpoint for multiple crypto data
app.get('/api/multiple-crypto-data', async (req, res) => {
  const timerId = startPerformanceTimer('multiple-crypto-data-endpoint');
  logApiRequest({
    endpoint: '/api/multiple-crypto-data',
    method: 'GET',
    params: req.query as Record<string, any>,
    headers: req.headers
  });
  
  try {
    const { symbols } = req.query;
    if (!symbols) {
      logApiResponse({ status: 400, data: { error: 'Symbols parameter is required' }, context: 'multiple crypto data' });
      endPerformanceTimer(timerId);
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }

    const symbolArray = (symbols as string).split(',');
    const data = await getMultipleCryptoData(symbolArray, 'multiple crypto data');
    logApiResponse({ status: 200, data, context: 'multiple crypto data' });
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    logApiResponse({ status: 500, error, data: { error: 'Internal server error' }, context: 'multiple crypto data' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// API endpoint for testing connection
app.get('/api/test-connection', async (req, res) => {
  const timerId = startPerformanceTimer('test-connection-endpoint');
  logApiRequest({
    endpoint: '/api/test-connection',
    method: 'GET',
    headers: req.headers
  });
  
  try {
    const isConnected = await testAPIConnection();
    logApiResponse({ status: 200, data: { connected: isConnected }, context: 'test connection' });
    res.json({ connected: isConnected });
  } catch (error) {
    console.error('API test error:', error);
    logApiResponse({ status: 500, error, data: { connected: false, error: 'Test failed' }, context: 'test connection' });
    res.status(500).json({ connected: false, error: 'Test failed' });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// API endpoint for Gemini-powered recommendations
app.get('/api/gemini-recommendations', async (req, res) => {
  const timerId = startPerformanceTimer('gemini-recommendations-endpoint');
  logApiRequest({
    endpoint: '/api/gemini-recommendations',
    method: 'GET',
    headers: req.headers
  });
  
  try {
    logFunctionEntry('generateGeminiRecommendations');
    
    // Fetch latest crypto data
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA'];
    const cryptoData = await getMultipleCryptoData(symbols, 'gemini recommendations');
    
    if (cryptoData.length === 0) {
      logApiResponse({ 
        status: 503, 
        data: { 
          error: 'Unable to fetch market data for analysis. Please try again later.',
          userMessage: 'Market data is currently unavailable. Please check back in a few minutes.'
        },
        context: 'gemini recommendations'
      });
      endPerformanceTimer(timerId);
      return res.status(503).json({ 
        error: 'Unable to fetch market data for analysis. Please try again later.',
        userMessage: 'Market data is currently unavailable. Please check back in a few minutes.'
      });
    }
    
    // Fetch real-time news from CoinDesk
    log('INFO', 'Fetching real-time news from CryptoCompare...');
    const realTimeNews = await fetchCoinDeskNews(5, 'gemini recommendations'); 
    
    if (realTimeNews.length > 0) {
      log('INFO', `Using ${realTimeNews.length} real-time news articles from CryptoCompare`);
    } else {
      log('WARN', 'CryptoCompare API unavailable, proceeding without news data');
    }
    
    // Generate recommendations using Gemini
    const recommendations = await generateGeminiRecommendations(
      cryptoData,
      realTimeNews.length > 0 ? realTimeNews : undefined, // Include real-time news only if available
      undefined,   // No market conditions (removed mock data)
      'gemini recommendations'
    );
    
    if (recommendations.length === 0) {
      logApiResponse({ 
        status: 503, 
        data: { 
          error: 'AI analysis service is temporarily unavailable. Please try again later.',
          userMessage: 'Our AI trading analysis is currently unavailable. This could be due to high demand or maintenance. Please try again in a few minutes.'
        },
        context: 'gemini recommendations'
      });
      endPerformanceTimer(timerId);
      return res.status(503).json({ 
        error: 'AI analysis service is temporarily unavailable. Please try again later.',
        userMessage: 'Our AI trading analysis is currently unavailable. This could be due to high demand or maintenance. Please try again in a few minutes.'
      });
    }
    
    // Store recommendations in Supabase with current prices as entry prices
    log('INFO', 'Storing recommendations in Supabase...', { count: recommendations.length });
    for (const recommendation of recommendations) {
      const cryptoData = await getRealTimeCryptoData(recommendation.crypto, 'gemini recommendations');
      const entryPrice = cryptoData?.price || recommendation.targetPrice;
      await storeTradeRecommendation(recommendation, entryPrice);
    }
    
    log('INFO', `Successfully generated ${recommendations.length} Gemini recommendations`);
    logFunctionExit('generateGeminiRecommendations', { count: recommendations.length });
    logApiResponse({ status: 200, data: recommendations, context: 'gemini recommendations' });
    res.json(recommendations);
    
  } catch (error) {
    console.error('Gemini recommendations error:', error);
    logApiResponse({ 
      status: 500, 
      error,
      data: { 
        error: 'AI analysis service encountered an error. Please try again later.',
        userMessage: 'We encountered an issue while analyzing the market. Please try again in a few minutes.'
      },
      context: 'gemini recommendations'
    });
    res.status(500).json({ 
      error: 'AI analysis service encountered an error. Please try again later.',
      userMessage: 'We encountered an issue while analyzing the market. Please try again in a few minutes.'
    });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// API endpoint for evaluated recommendations
app.get('/api/evaluated-recommendations', async (req, res) => {
  const timerId = startPerformanceTimer('evaluated-recommendations-endpoint');
  logApiRequest({
    endpoint: '/api/evaluated-recommendations',
    method: 'GET',
    headers: req.headers
  });
  
  try {
    logFunctionEntry('fetchEvaluatedRecommendations');
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations'
    });
    
    const { data: recommendations, error } = await supabase
      .from('trade_recommendations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 recommendations

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logApiResponse({ status: 500, error, data: { error: 'Failed to fetch recommendations' }, context: 'evaluation' });
      endPerformanceTimer(timerId);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: recommendations?.length || 0
    });

    // Transform data to match frontend expectations
    const transformedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      crypto: rec.symbol,
      action: rec.action,
      confidence: rec.confidence,
      targetPrice: parseFloat(rec.target_price),
      stopLoss: parseFloat(rec.stop_loss),
      reasoning: rec.reasoning,
      timeframe: rec.timeframe,
      riskLevel: rec.risk_level,
      status: rec.status,
      entryPrice: rec.entry_price ? parseFloat(rec.entry_price) : null,
      evaluationTimestamp: rec.evaluation_timestamp,
      createdAt: rec.created_at
    }));

    log('INFO', `Successfully fetched ${transformedRecommendations.length} recommendations`);
    logFunctionExit('fetchEvaluatedRecommendations', { count: transformedRecommendations.length });
    logApiResponse({ status: 200, data: transformedRecommendations, context: 'evaluation' });
    res.json(transformedRecommendations);
    
  } catch (error) {
    log('ERROR', 'Error fetching evaluated recommendations', error);
    logApiResponse({ status: 500, error, data: { error: 'Internal server error' }, context: 'evaluation' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// API endpoint for evaluation statistics
app.get('/api/evaluation-stats', async (req, res) => {
  const timerId = startPerformanceTimer('evaluation-stats-endpoint');
  logApiRequest({
    endpoint: '/api/evaluation-stats',
    method: 'GET',
    headers: req.headers
  });
  
  try {
    logFunctionEntry('getEvaluationStats');
    const stats = await getEvaluationStats();
    logFunctionExit('getEvaluationStats', stats);
    logApiResponse({ status: 200, data: stats, context: 'evaluation' });
    res.json(stats);
  } catch (error) {
    log('ERROR', 'Error fetching evaluation stats', error);
    logApiResponse({ status: 500, error, data: { error: 'Failed to fetch statistics' }, context: 'evaluation' });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  } finally {
    endPerformanceTimer(timerId);
  }
});

// Start the proxy server
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  logAppState('STARTUP', { message: `API proxy server running on port ${PORT}` });
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
  logAppState('STARTUP', { 
    message: `Discord bot is ready! Logged in as ${readyClient.user.tag}`,
    data: { 
      username: readyClient.user.tag,
      serverCount: readyClient.guilds.cache.size,
      userId: readyClient.user.id
    }
  });
  
  // Register slash commands
  registerSlashCommands();
  
  // Test API connection on startup
  testAPIConnection().then(isConnected => {
    if (isConnected) {
      logAppState('STARTUP', { message: 'Real-time data APIs are working' });
    } else {
      logAppState('STARTUP', { message: 'Real-time data APIs are not available, using fallback data' });
    }
  });
  
  // Test CoinDesk News API on startup
  testCoinDeskAPI().then(isConnected => {
    if (isConnected) {
      logAppState('STARTUP', { message: 'CryptoCompare News API is working' });
    } else {
      logAppState('STARTUP', { message: 'CryptoCompare News API is not available, using fallback news' });
    }
  });
  
  // Test Binance Futures API on startup
  testBinanceFuturesAPI().then(isConnected => {
    if (isConnected) {
      logAppState('STARTUP', { message: 'Binance Futures API is working' });
    } else {
      logAppState('STARTUP', { message: 'Binance Futures API is not available' });
    }
  });
  
  // Test Supabase connection on startup
  supabase.from('trade_recommendations').select('count', { count: 'exact', head: true }).then(({ error, count }) => {
    if (error) {
      logAppState('STARTUP', { message: 'Supabase connection failed', error });
    } else {
      logAppState('STARTUP', { 
        message: `Supabase connected successfully. Found ${count || 0} trade recommendations.`,
        data: { recommendationCount: count || 0 }
      });
    }
  });
  
  // Start evaluation scheduler at specific UTC hours (03:00, 07:00, 11:00, 15:00, 19:00, 23:00)
  logAppState('STARTUP', { message: 'Starting trade recommendation evaluation scheduler at specific UTC hours...' });
  scheduleEvaluationAtSpecificHours();
  
  // Set bot status
  client.user?.setActivity('crypto markets 📈', { type: 3 }); // 3 = Watching
});

// Function to calculate milliseconds until next evaluation time
function calculateNextEvaluationDelay(): number {
  const now = new Date();
  const currentUTCHour = now.getUTCHours();
  const currentUTCMinute = now.getUTCMinutes();
  const currentUTCSecond = now.getUTCSeconds();
  
  // Target evaluation hours in UTC
  const evaluationHours = [0, 4, 8, 12, 16, 20];
  
  // Find the next evaluation hour
  let nextHour = evaluationHours.find(hour => hour > currentUTCHour);
  
  // If no hour found today, use the first hour of tomorrow
  if (!nextHour) {
    nextHour = evaluationHours[0]; // 03:00 UTC next day
  }
  
  // Calculate target time
  const targetTime = new Date(now);
  targetTime.setUTCHours(nextHour, 0, 0, 0); // Set to target hour, 0 minutes, 0 seconds, 0 milliseconds
  
  // If target time is in the past (shouldn't happen with our logic, but safety check)
  if (targetTime <= now) {
    targetTime.setUTCDate(targetTime.getUTCDate() + 1);
  }
  
  const delayMs = targetTime.getTime() - now.getTime();
  
  logAppState('CONFIG', {
    message: 'Evaluation scheduler configuration',
    data: {
      currentTime: now.toISOString(),
      nextEvaluation: targetTime.toISOString(),
      delayMinutes: Math.round(delayMs / 1000 / 60)
    }
  });
  
  return delayMs;
}

// Function to schedule evaluations at specific UTC hours
function scheduleEvaluationAtSpecificHours(): void {
  const initialDelay = calculateNextEvaluationDelay();
  
  // Schedule the first evaluation
  setTimeout(() => {
    log('INFO', 'Running scheduled evaluation at UTC hour...');
    evaluatePendingRecommendations();
    
    // After the first evaluation, set up recurring evaluations every 4 hours
    setInterval(() => {
      log('INFO', 'Running scheduled evaluation (4-hour interval)...');
      evaluatePendingRecommendations();
    }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds
    
  }, initialDelay);
}

// Function to register slash commands
async function registerSlashCommands() {
  try {
    logAppState('STARTUP', { message: 'Started refreshing application (/) commands.' });
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);
    
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;
    
    if (!clientId) {
      logAppState('ERROR', { message: 'DISCORD_CLIENT_ID is not set in .env file' });
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
      logAppState('STARTUP', { 
        message: `Successfully registered ${commandsData.length} guild commands for server ${guildId}`,
        data: { commandCount: commandsData.length, guildId }
      });
    } else {
      // Register commands globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData }
      );
      logAppState('STARTUP', { 
        message: `Successfully registered ${commandsData.length} global commands`,
        data: { commandCount: commandsData.length }
      });
    }
  } catch (error) {
    logAppState('ERROR', { message: 'Error registering slash commands', error });
  }
}

// Add a Set to track processed interactions to prevent duplicates
const processedInteractions = new Set<string>();

// Helper function to build complete prompt for logging (same as in geminiService.ts)
function buildCompletePromptForLogging(marketData: any): string {
  const { symbol, timeframes, market } = marketData;
  
  return `You are an expert derivatives trader specializing in multi-timeframe technical analysis, with a primary focus on capital preservation and identifying high-probability setups. Your analysis must be solely based on the provided technical data using the FinCoT-TA (Financial Chain-of-Thought for Technical Analysis) Framework.

DATA:
{
    "symbol": "${symbol}",
    "dataTimestamp": "${marketData.dataTimestamp}",
    "4-HOUR TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['4h'].indicators.currentPrice.toFixed(5)},
      "Market Regime": "${timeframes['4h'].marketRegime}",
      "RSI (14)": ${timeframes['4h'].indicators.rsi.toFixed(1)},
      "RSI Trend": "${timeframes['4h'].indicators.rsiTrend}",
      "MACD": ${timeframes['4h'].indicators.macd.macd.toFixed(2)},
      "MACD Signal": ${timeframes['4h'].indicators.macd.signal.toFixed(2)},
      "MACD Histogram": ${timeframes['4h'].indicators.macd.histogram.toFixed(2)},
      "MACD Trend": "${timeframes['4h'].indicators.macd.trend}",
      "Bollinger Bands Upper": ${timeframes['4h'].indicators.bollinger.upper.toFixed(5)},
      "Bollinger Bands Middle": ${timeframes['4h'].indicators.bollinger.middle.toFixed(5)},
      "Bollinger Bands Lower": ${timeframes['4h'].indicators.bollinger.lower.toFixed(5)},
      "Bollinger Bands State": "${timeframes['4h'].indicators.bollinger.trend}",
      "EMA 20": ${timeframes['4h'].indicators.ema20.toFixed(5)},
      "EMA 50": ${timeframes['4h'].indicators.ema50.toFixed(5)},
      "EMA Trend": "${timeframes['4h'].indicators.emaTrend}",
      "Support Levels": [${timeframes['4h'].indicators.support.map(s => s.toFixed(5)).join(', ')}],
      "Resistance Levels": [${timeframes['4h'].indicators.resistance.map(r => r.toFixed(5)).join(', ')}],
      "Fibonacci Retracement": {
        "Swing High (0%)": ${timeframes['4h'].indicators.fibonacci.retracement.level_0.toFixed(5)},
        "23.6%": ${timeframes['4h'].indicators.fibonacci.retracement.level_236.toFixed(5)},
        "38.2%": ${timeframes['4h'].indicators.fibonacci.retracement.level_382.toFixed(5)},
        "50%": ${timeframes['4h'].indicators.fibonacci.retracement.level_500.toFixed(5)},
        "61.8%": ${timeframes['4h'].indicators.fibonacci.retracement.level_618.toFixed(5)},
        "78.6%": ${timeframes['4h'].indicators.fibonacci.retracement.level_786.toFixed(5)},
        "Swing Low (100%)": ${timeframes['4h'].indicators.fibonacci.retracement.level_1000.toFixed(5)}
      },
      "Fibonacci Extension": {
        "127.2%": ${timeframes['4h'].indicators.fibonacci.extension.level_1272.toFixed(5)},
        "161.8%": ${timeframes['4h'].indicators.fibonacci.extension.level_1618.toFixed(5)},
        "261.8%": ${timeframes['4h'].indicators.fibonacci.extension.level_2618.toFixed(5)}
      },
      "Fibonacci Trend": "${timeframes['4h'].indicators.fibonacci.trend}",
      "Recent Candles (OHLCV)": [${timeframes['4h'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
    "1-HOUR TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['1h'].indicators.currentPrice.toFixed(5)},
      "Market Regime": "${timeframes['1h'].marketRegime}",
      "RSI (14)": ${timeframes['1h'].indicators.rsi.toFixed(1)},
      "RSI Trend": "${timeframes['1h'].indicators.rsiTrend}",
      "MACD": ${timeframes['1h'].indicators.macd.macd.toFixed(2)},
      "MACD Signal": ${timeframes['1h'].indicators.macd.signal.toFixed(2)},
      "MACD Histogram": ${timeframes['1h'].indicators.macd.histogram.toFixed(2)},
      "MACD Trend": "${timeframes['1h'].indicators.macd.trend}",
      "Bollinger Bands Upper": ${timeframes['1h'].indicators.bollinger.upper.toFixed(5)},
      "Bollinger Bands Middle": ${timeframes['1h'].indicators.bollinger.middle.toFixed(5)},
      "Bollinger Bands Lower": ${timeframes['1h'].indicators.bollinger.lower.toFixed(5)},
      "Bollinger Bands State": "${timeframes['1h'].indicators.bollinger.trend}",
      "EMA 20": ${timeframes['1h'].indicators.ema20.toFixed(5)},
      "EMA 50": ${timeframes['1h'].indicators.ema50.toFixed(5)},
      "EMA Trend": "${timeframes['1h'].indicators.emaTrend}",
      "Support Levels": [${timeframes['1h'].indicators.support.map(s => s.toFixed(5)).join(', ')}],
      "Resistance Levels": [${timeframes['1h'].indicators.resistance.map(r => r.toFixed(5)).join(', ')}],
      "Fibonacci Retracement": {
        "Swing High (0%)": ${timeframes['1h'].indicators.fibonacci.retracement.level_0.toFixed(5)},
        "23.6%": ${timeframes['1h'].indicators.fibonacci.retracement.level_236.toFixed(5)},
        "38.2%": ${timeframes['1h'].indicators.fibonacci.retracement.level_382.toFixed(5)},
        "50%": ${timeframes['1h'].indicators.fibonacci.retracement.level_500.toFixed(5)},
        "61.8%": ${timeframes['1h'].indicators.fibonacci.retracement.level_618.toFixed(5)},
        "78.6%": ${timeframes['1h'].indicators.fibonacci.retracement.level_786.toFixed(5)},
        "Swing Low (100%)": ${timeframes['1h'].indicators.fibonacci.retracement.level_1000.toFixed(5)}
      },
      "Fibonacci Extension": {
        "127.2%": ${timeframes['1h'].indicators.fibonacci.extension.level_1272.toFixed(5)},
        "161.8%": ${timeframes['1h'].indicators.fibonacci.extension.level_1618.toFixed(5)},
        "261.8%": ${timeframes['1h'].indicators.fibonacci.extension.level_2618.toFixed(5)}
      },
      "Fibonacci Trend": "${timeframes['1h'].indicators.fibonacci.trend}",
      "Recent Candles (OHLCV)": [${timeframes['1h'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
      "Funding Rate": ${market.fundingRate.toFixed(3)}
    }
}

FINCOT-TA FRAMEWORK INSTRUCTIONS:

**MARKET REGIME MATRIX** (Use this to interpret signals contextually):

| Market Regime | Defining Indicators | Primary Signals to Prioritize | Secondary Confirmation Signals |
|---------------|-------------------|-------------------------------|--------------------------------|
| Trending (Bullish) | Price consistently above MA50 & MA200; EMA Trend = bullish | MA Crossover, Pullbacks to MA Support | Volume Confirmation, RSI > 50 |
| Trending (Bearish) | Price consistently below MA50 & MA200; EMA Trend = bearish | MA Crossover, Pullbacks to MA Resistance | Volume Confirmation, RSI < 50 |
| Ranging | Price moving between clear support/resistance levels | Support/Resistance tests; RSI overbought/oversold levels | Volume Profile analysis |
| Volatile | Bollinger Band Width > 1.5x average width; High ATR | Volatility-based signals; Order flow patterns | Volume spikes, Order book imbalances |
| Quiet | Bollinger Band Width < 0.8x average width; Low ATR | No-Trade Recommendation; Wait for breakouts | Low volume, Tight trading range |

**SIGNAL CONFLUENCE SCORE TABLE** (Use this to quantify setup strength):

| Signal Type | Weighting Score |
|-------------|----------------|
| MA Trend Alignment (4h and 1h EMAs aligned) | +2 |
| RSI Momentum (Aligned with Trend) | +2 |
| Volume Confirmation (Rising on Uptrend, etc.) | +3 |
| Candlestick Pattern (e.g., Hammer, Engulfing) | +3 |
| Fibonacci Retracement (61.8% or 50% Respect) | +4 |
| Chart Pattern (e.g., Bullish Flag, Cup & Handle) | +5 |
| Order Flow Signal (e.g., Absorption, Imbalance) | +5 |

**CONFIDENCE CALIBRATION RULES**:
- Total Confluence Score 15+: High Confidence (85-95%)
- Total Confluence Score 10-14: Medium-High (75-84%)
- Total Confluence Score 6-9: Medium (65-74%)
- Total Confluence Score <6: No Trade (confidence <75%)

**<thinking>**
**PHASE I: CONTEXTUAL & MARKET REGIME ANALYSIS**
First, I must identify the market regime for each timeframe using the Market Regime Matrix:

4-Hour Analysis:
- Market Regime: "${timeframes['4h'].marketRegime}"
- EMA Trend: "${timeframes['4h'].indicators.emaTrend}" (EMA20: ${timeframes['4h'].indicators.ema20.toFixed(0)} vs EMA50: ${timeframes['4h'].indicators.ema50.toFixed(0)})
- Price Position: Current price ${timeframes['4h'].indicators.currentPrice.toFixed(0)} relative to EMAs
- Confirmation: Assess alignment with Market Regime Matrix

1-Hour Analysis:
- Market Regime: "${timeframes['1h'].marketRegime}"
- EMA Trend: "${timeframes['1h'].indicators.emaTrend}" (EMA20: ${timeframes['1h'].indicators.ema20.toFixed(0)} vs EMA50: ${timeframes['1h'].indicators.ema50.toFixed(0)})
- Price Position: Current price ${timeframes['1h'].indicators.currentPrice.toFixed(0)} relative to EMAs
- Confirmation: Assess alignment with Market Regime Matrix

**REGIME CONFLICT ASSESSMENT**: Compare 4h vs 1h regimes and identify any conflicts. Per FinCoT-TA framework, prioritize the higher timeframe (4h) for primary trend direction.

**PHASE II: ADVANCED SIGNAL CONFLUENCE & QUANTIFICATION**
Systematically assess each signal type from the Signal Confluence Score Table:

1. **MA Trend Alignment** (+2 points): 
   - 4h: EMA20 vs EMA50 relationship
   - 1h: EMA20 vs EMA50 relationship
   - Assessment: Full/Partial/No alignment
   - Score: 0-2 points

2. **RSI Momentum** (+2 points):
   - 4h RSI: ${timeframes['4h'].indicators.rsi.toFixed(1)} (${timeframes['4h'].indicators.rsiTrend} trend)
   - 1h RSI: ${timeframes['1h'].indicators.rsi.toFixed(1)} (${timeframes['1h'].indicators.rsiTrend} trend)
   - Assessment: Aligned/Conflicting with trend
   - Score: 0-2 points

3. **Volume Confirmation** (+3 points):
   - Volume Trend: "${market.volumeTrend}"
   - Assessment: Supports/Contradicts price action
   - Score: 0-3 points

4. **Candlestick Pattern** (+3 points):
   - 4h: Analyze recent OHLCV data for patterns
   - 1h: Analyze recent OHLCV data for patterns
   - Assessment: Strong/Weak/No patterns
   - Score: 0-3 points

5. **Fibonacci Retracement** (+4 points):
   - 4h: Current price vs key Fibonacci levels
   - 1h: Current price vs key Fibonacci levels
   - Assessment: Strong/Weak confluence
   - Score: 0-4 points

6. **Chart Pattern** (+5 points):
   - Assessment: Identify any chart patterns
   - Score: 0-5 points

7. **Order Flow Signal** (+5 points):
   - Assessment: Based on available data
   - Score: 0-5 points

**TOTAL CONFLUENCE SCORE: [Calculate sum of all scores]**

**PHASE III: MULTI-TIMEFRAME VALIDATION**
- Primary Trend (4h): [Analysis]
- Secondary Confirmation (1h): [Analysis]
- Fibonacci Confluence: [Analysis]
- Volume: [Analysis]

**PHASE IV: EXPLICIT CONFLICT RESOLUTION**
**<reconciliation>**
Key conflicts identified:
1. [List any conflicts between timeframes or indicators]
2. [Additional conflicts]

Resolution Logic:
- [Explain how conflicts are resolved]
- [Prioritization logic]
- [Final reconciliation]

**PHASE V: CONFIDENCE CALIBRATION & FINAL DECISION**
- Total Confluence Score: [X] points
- Per calibration rules: [Confidence range]
- Risk-reward assessment for final decision

Entry Analysis:
- Current price: [Analysis]
- Potential target: [Analysis]
- Stop loss: [Analysis]

Risk-Reward Calculation:
- Entry: [Price]
- Target: [Price]
- Stop: [Price]
- Risk: [Amount], Reward: [Amount]
- R:R Ratio: [Ratio]:1

**DECISION**: [Final decision with reasoning]
**</thinking>**

**<output>**
Based on the FinCoT-TA framework analysis, provide your systematic assessment and final trade recommendation.

Respond ONLY with a valid JSON object in this exact format:
{ "direction": "long" | "short" | "no_trade_due_to_conflict", "entry": [price] | 0.0, "targetPrice": [price] | 0.0, "stopLoss": [price] | 0.0, "riskReward": [ratio] | 0.0, "confidence": [0-95] | "N/A", "technicalReasoning": [ "reason1", "reason2", "reason3", "reason4", "reason5", "reason6" ], "timeframe": "6-24 hours" | "No trade recommended" }

- Ensure all prices are realistic numbers with appropriate precision based on the asset's price level.
- If 'direction' is 'no_trade_due_to_conflict', set 'entry', 'targetPrice', 'stopLoss', and 'riskReward' to 0.0, and 'confidence' to 'N/A' or below 75%.
- 'confidence' must be between 75-95 for high-quality setups.
- 'riskReward' is a decimal (e.g., 3.0).
- 'technicalReasoning' must contain 5-6 items, explicitly focusing on market regime alignment, multi-timeframe analysis, Fibonacci confluences, trend alignment, momentum, and volume confirmation, ordered by their impact on the decision.
**</output>**`;
}
// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Create a unique key for this interaction to prevent duplicate processing
  const interactionKey = `${interaction.id}-${interaction.commandName}`;
  
  // Check if we've already processed this interaction
  if (processedInteractions.has(interactionKey)) {
    log('WARN', `Duplicate interaction detected for ${interaction.commandName}, skipping...`);
    return;
  }
  
  // Mark this interaction as processed
  processedInteractions.add(interactionKey);
  
  // Clean up old processed interactions (keep only last 100)
  if (processedInteractions.size > 100) {
    const oldestKey = processedInteractions.values().next().value;
    processedInteractions.delete(oldestKey);
  }

  // Log the command received
  logDiscordInteraction('COMMAND_RECEIVED', {
    commandName: interaction.commandName,
    userId: interaction.user.id,
    username: interaction.user.username,
    guildId: interaction.guildId || undefined,
    channelId: interaction.channelId
  });

  // Acknowledge the interaction immediately to prevent timeout
  logDiscordInteraction('DEFER_REPLY', { commandName: interaction.commandName });
  await interaction.deferReply();

  try {
    if (interaction.commandName === 'tradingidea') {
      const timerId = startPerformanceTimer('tradingidea-command');
      
      // Show initial loading message
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: 'Generating AI-powered trading recommendations...' 
      });
      await interaction.editReply('🔄 **Generating AI-powered trading recommendations...**\n*This may take a moment while I analyze the markets*');
      
      try {
        // Fetch recommendations from our API
        const response = await axios.get('http://localhost:3001/api/gemini-recommendations', {
          timeout: 30000 // 30 second timeout
        });
        
        const recommendations = response.data;
        
        if (!recommendations || recommendations.length === 0) {
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: 'No trading recommendations available at the moment.' 
          });
          await interaction.editReply('❌ **No trading recommendations available at the moment.**\n*Please try again in a few minutes.*');
          endPerformanceTimer(timerId);
          return;
        }
        
        // Update with success message
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: `Generated ${recommendations.length} AI trading recommendations!` 
        });
        await interaction.editReply(`✅ **Generated ${recommendations.length} AI trading recommendations!**`);
        
        // Send each recommendation as a separate embed
        for (const recommendation of recommendations) {
          const embed = createRecommendationEmbed(recommendation);
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: `Recommendation for ${recommendation.crypto}` 
          });
          await interaction.followUp({ embeds: [embed] });
        }
        
        endPerformanceTimer(timerId);
      } catch (apiError: any) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error: apiError 
        });
        
        // Check if it's a user-friendly error from our API
        if (apiError.response?.data?.userMessage) {
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: apiError.response.data.userMessage 
          });
          await interaction.editReply(`❌ **${apiError.response.data.userMessage}**`);
        } else {
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: 'Unable to generate recommendations at the moment.' 
          });
          await interaction.editReply('❌ **Unable to generate recommendations at the moment.**\n*Our AI analysis service may be experiencing high demand. Please try again in a few minutes.*');
        }
        endPerformanceTimer(timerId);
      }
      return;
    }
    
    if (interaction.commandName === 'market') {
      const timerId = startPerformanceTimer('market-command');
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: 'Fetching real-time market data...' 
      });
      await interaction.editReply('🔄 **Fetching real-time market data...**');
      
      try {
        const marketEmbed = await createMarketOverviewEmbed();
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'Market overview ready!' 
        });
        await interaction.editReply('✅ **Market overview ready!**');
        logDiscordInteraction('FOLLOW_UP', { 
          commandName: interaction.commandName, 
          message: 'Market overview embed' 
        });
        await interaction.followUp({ embeds: [marketEmbed] });
      } catch (error) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error 
        });
        await interaction.editReply('❌ **Unable to fetch market data at the moment. Please try again later.**');
      } finally {
        endPerformanceTimer(timerId);
      }
      return;
    }
    
    if (interaction.commandName === 'crypto') {
      const timerId = startPerformanceTimer('crypto-command');
      const symbol = interaction.options.getString('symbol')?.toUpperCase();
      if (!symbol) {
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'Please provide a valid cryptocurrency symbol.' 
        });
        await interaction.editReply('❌ Please provide a valid cryptocurrency symbol.');
        endPerformanceTimer(timerId);
        return;
      }
      
      // Show loading message
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: `Fetching live ${symbol} data...` 
      });
      await interaction.editReply(`🔄 **Fetching live ${symbol} data...**`);
      
      try {
        const realTimeCrypto = await getRealTimeCryptoData(symbol);
        
        if (realTimeCrypto && realTimeCrypto.price > 0) {
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: `Live ${symbol} analysis ready!` 
          });
          await interaction.editReply(`✅ **Live ${symbol} analysis ready!**`);
          const cryptoEmbed = createCryptoAnalysisEmbed(realTimeCrypto);
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: `${symbol} analysis embed` 
          });
          await interaction.followUp({ content: '', embeds: [cryptoEmbed] });
        } else {
          throw new Error('No real-time data available');
        }
      } catch (error) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error 
        });
        
        await interaction.editReply(`❌ **Sorry, could not fetch ${symbol} data. Please try again later.**`);
      } finally {
        endPerformanceTimer(timerId);
      }
      return;
    }
    
    if (interaction.commandName === 'price') {
      const timerId = startPerformanceTimer('price-command');
      const symbol = interaction.options.getString('symbol')?.toUpperCase();
      if (!symbol) {
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'Please provide a valid cryptocurrency symbol.' 
        });
        await interaction.editReply('❌ Please provide a valid cryptocurrency symbol.');
        endPerformanceTimer(timerId);
        return;
      }
      
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: `Getting ${symbol} price...` 
      });
      await interaction.editReply(`💰 **Getting ${symbol} price...**`);
      
      try {
        const crypto = await getRealTimeCryptoData(symbol);
        if (crypto && crypto.price > 0) {
          const changeEmoji = crypto.change24h > 0 ? '📈' : '📉';
          const changeColor = crypto.change24h > 0 ? '🟢' : '🔴';
          
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: `${crypto.name} price: $${crypto.price.toLocaleString()}` 
          });
          await interaction.editReply(
            `💰 **${crypto.name} (${symbol})**\n` +
            `**Price:** $${crypto.price.toLocaleString()}\n` +
            `**24h Change:** ${changeColor} ${crypto.change24h > 0 ? '+' : ''}${crypto.change24h.toFixed(2)}% ${changeEmoji}`
          );
        } else {
          throw new Error('No price data available');
        }
      } catch (error) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error 
        });
        await interaction.editReply(`❌ **Could not fetch ${symbol} price. Please try again later.**`);
      } finally {
        endPerformanceTimer(timerId);
      }
      return;
    }
    
    if (interaction.commandName === 'news') {
      const timerId = startPerformanceTimer('news-command');
      try {
        // Show loading message
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'Fetching latest crypto news...' 
        });
        await interaction.editReply('📰 **Fetching latest crypto news...**');
        
        // Fetch real-time news from CryptoCompare
        log('INFO', 'Slash command: Fetching real-time news from CryptoCompare...');
        const realTimeNews = await fetchCoinDeskNews(5); // Limit to 5 articles for Discord embed
        
        if (realTimeNews.length > 0) {
          log('INFO', `Slash command: Successfully fetched ${realTimeNews.length} real-time news articles`);
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: `Found ${realTimeNews.length} latest crypto news articles!` 
          });
          await interaction.editReply(`✅ **Found ${realTimeNews.length} latest crypto news articles!**`);
          const newsEmbed = createNewsEmbed(realTimeNews);
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: 'News embed with real-time articles' 
          });
          await interaction.followUp({ content: '', embeds: [newsEmbed] });
        } else {
          log('WARN', 'Slash command: CryptoCompare API returned no articles, using fallback');
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: 'Using cached news due to API limitations.' 
          });
          await interaction.editReply('⚠️ **Using cached news due to API limitations.**');
          const newsEmbed = createNewsEmbed();
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: 'News embed with cached articles' 
          });
          await interaction.followUp({ content: '', embeds: [newsEmbed] });
        }
      } catch (error) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error 
        });
        await interaction.editReply('⚠️ **Using cached news due to API error.**');
        const newsEmbed = createNewsEmbed();
        logDiscordInteraction('FOLLOW_UP', { 
          commandName: interaction.commandName, 
          message: 'News embed with cached articles (error fallback)' 
        });
        await interaction.followUp({ content: '', embeds: [newsEmbed] });
      } finally {
        endPerformanceTimer(timerId);
      }
      return;
    }
    
    if (interaction.commandName === 'test') {
      const timerId = startPerformanceTimer('test-command');
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: 'Testing API connections...' 
      });
      await interaction.editReply('🧪 **Testing API connections...**');
      
      const isWorking = await testAPIConnection();
      if (isWorking) {
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'API connections are working! Real-time data is available.' 
        });
        await interaction.editReply('✅ **API connections are working! Real-time data is available.**');
      } else {
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'API connections failed. Using cached data as fallback.' 
        });
        await interaction.editReply('❌ **API connections failed. Using cached data as fallback.**');
      }
      endPerformanceTimer(timerId);
      return;
    }
    
    if (interaction.commandName === 'help') {
      const timerId = startPerformanceTimer('help-command');
      const helpEmbed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('🤖 CryptoTrader Bot Commands')
        .setDescription('Available slash commands for crypto trading analysis')
        .addFields(
          { name: '/tradingidea', value: 'Get AI-powered trading recommendations', inline: false },
          { name: '/market', value: 'View current market overview', inline: false },
          { name: '/crypto [symbol]', value: 'Get technical analysis for specific crypto', inline: false },
          { name: '/price [symbol]', value: 'Get quick price for any crypto', inline: false },
          { name: '/news', value: 'Latest crypto news with sentiment analysis', inline: false },
          { name: '/test', value: 'Test API connectivity', inline: false },
          { name: '/help', value: 'Show this help message', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'CryptoTrader Bot • AI-Powered Trading Analysis' });

      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: 'Help embed' 
      });
      await interaction.editReply({ content: '', embeds: [helpEmbed] });
      endPerformanceTimer(timerId);
      return;
    }
    
    if (interaction.commandName === 'derivativetrade') {
      const timerId = startPerformanceTimer('derivativetrade-command');
      const symbol = interaction.options.getString('symbol')?.toUpperCase();
      if (!symbol) {
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: 'Please provide a valid derivatives symbol.' 
        });
        await interaction.editReply('❌ Please provide a valid derivatives symbol.');
        endPerformanceTimer(timerId);
        return;
      }
      
      // Normalize the symbol input
      const normalizedSymbol = symbol.toUpperCase().trim();
      
      // Basic validation for symbol format
      if (!/^[A-Z0-9]{2,10}(USDT|USD|BUSD)?$/i.test(normalizedSymbol)) {
        await interaction.editReply({
          embeds: [{
            color: 0xff6b6b,
            title: '❌ Invalid Symbol Format',
            description: `The symbol "${symbol}" doesn't appear to be a valid cryptocurrency symbol.`,
            fields: [
              {
                name: '📝 Valid Examples',
                value: '• BTCUSDT\n• ETHUSDT\n• SOLUSDT\n• ADAUSDT\n• BTC (will be converted to BTCUSDT)',
                inline: false
              },
              {
                name: '💡 Tips',
                value: '• Use standard symbols like BTC, ETH, SOL\n• USDT pairs are preferred for derivatives\n• Avoid special characters or spaces',
                inline: false
              }
            ],
            timestamp: new Date().toISOString()
          }]
        });
        return;
      }

      // Auto-append USDT if not present
      let finalSymbol = normalizedSymbol;
      if (!finalSymbol.endsWith('USDT') && !finalSymbol.endsWith('USD') && !finalSymbol.endsWith('BUSD')) {
        finalSymbol = finalSymbol + 'USDT';
      }

      // Show initial loading message
      logDiscordInteraction('EDIT_REPLY', { 
        commandName: interaction.commandName, 
        message: `Analyzing ${symbol} multi-timeframe market data...` 
      });
      await interaction.editReply(`🔄 **Analyzing ${symbol} multi-timeframe market data...**\n*Fetching 4h and 1h candlestick data and calculating enhanced technical indicators*`);
      
      try {
        // Fetch comprehensive market data
        log('INFO', `Requesting derivatives trade idea for ${finalSymbol} (original: ${symbol})`);
        
        // Update loading message
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: `Generating enhanced AI trade idea for ${symbol}...` 
        });
        log('INFO', `Processing derivatives trade request for ${finalSymbol} (user input: ${symbol})...`);
        log('INFO', `Fetching market data for ${finalSymbol}...`);
        const marketData = await getEnhancedDerivativesMarketData(finalSymbol, 'derivativetrade command');
        
        // Generate trade idea using Gemini
        log('INFO', `Generating AI trade idea for ${finalSymbol}...`);
        const tradeIdea = await generateDerivativesTradeIdea(marketData, 'derivativetrade command');
        
        if (!tradeIdea) {
          logDiscordInteraction('EDIT_REPLY', { 
            commandName: interaction.commandName, 
            message: `Unable to generate trade idea for ${finalSymbol}. Please try again later.`
          });
          await interaction.editReply(`❌ **Unable to generate trade idea for ${symbol}**\n*AI analysis service may be temporarily unavailable. Please try again in a few minutes.*`);
          endPerformanceTimer(timerId);
          return;
        }
        
        // Store valid trade ideas in Supabase (skip "no trade" recommendations)
        if (tradeIdea.confidence > 0 && tradeIdea.entry > 0) {
          try {
            // Calculate target price based on risk-reward ratio
            const riskAmount = Math.abs(tradeIdea.entry - tradeIdea.stopLoss);
            const targetPrice = tradeIdea.direction === 'long' ? 
              tradeIdea.entry + (riskAmount * tradeIdea.riskReward) :
              tradeIdea.entry - (riskAmount * tradeIdea.riskReward);
            
            // Map DerivativesTradeIdea to TradingRecommendation format
            const mappedRecommendation: TradingRecommendation = {
              crypto: tradeIdea.symbol,
              action: tradeIdea.direction === 'long' ? 'buy' : 'sell',
              confidence: tradeIdea.confidence,
              targetPrice: tradeIdea.targetPrice, // Use the actual target price from AI
              stopLoss: tradeIdea.stopLoss,
              reasoning: tradeIdea.technicalReasoning,
              timeframe: tradeIdea.timeframe,
              riskLevel: 'high' // Derivatives trading typically carries higher risk
            };
            
            // Store in Supabase with entry price
            const stored = await storeTradeRecommendation(mappedRecommendation, tradeIdea.entry);
            
            if (stored) {
              log('INFO', `Stored derivatives trade idea for ${symbol} in database`);
            } else {
              log('WARN', `Failed to store derivatives trade idea for ${symbol} in database`);
            }
          } catch (storeError) {
            log('ERROR', 'Error storing derivatives trade idea', storeError);
            // Don't fail the command if storage fails, just log the error
          }
        } else {
          log('INFO', `Skipping storage for ${symbol} - no trade recommendation (confidence: ${tradeIdea.confidence}%)`);
        }
        
        // Update with success message
        logDiscordInteraction('EDIT_REPLY', { 
          commandName: interaction.commandName, 
          message: `Generated enhanced multi-timeframe trade idea for ${symbol}! Confidence: ${tradeIdea.confidence}% • Direction: ${tradeIdea.direction.toUpperCase()}` 
        });
        await interaction.editReply(`✅ **Generated enhanced multi-timeframe trade idea for ${symbol}!**\n*Confidence: ${tradeIdea.confidence}% • Direction: ${tradeIdea.direction.toUpperCase()}*`);
        
        // Send the trade idea as an embed
        const tradeEmbed = createDerivativesTradeEmbed(tradeIdea, marketData);
        
        // Check if this is a "no trade" recommendation
        if (tradeIdea.confidence === 0 || tradeIdea.entry === 0) {
          // Create a special embed for no trade recommendations
          const noTradeEmbed = new EmbedBuilder()
            .setColor(0xffff00) // Yellow for caution
            .setTitle(`⚠️ NO TRADE RECOMMENDED - ${tradeIdea.symbol}`)
            .setDescription('**AI Analysis Complete** • No High-Probability Setup Identified')
            .addFields(
              { 
                name: '🔍 Analysis Result', 
                value: 'Conflicting signals or insufficient confluence detected', 
                inline: false 
              },
              { 
                name: '🤖 AI Reasoning', 
                value: tradeIdea.technicalReasoning.map(reason => `• ${reason}`).join('\n'), 
                inline: false 
              },
              {
                name: '💡 Recommendation',
                value: 'Wait for clearer market structure and stronger signal alignment before entering a position.',
                inline: false
              }
            )
            .setTimestamp()
            .setFooter({ text: 'CryptoTrader Bot • Enhanced Multi-Timeframe Analysis • Capital Preservation Priority' });
          
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: `No trade recommendation for ${tradeIdea.symbol}` 
          });
          await interaction.followUp({ embeds: [noTradeEmbed] });
        } else {
          logDiscordInteraction('FOLLOW_UP', { 
            commandName: interaction.commandName, 
            message: `${tradeIdea.direction.toUpperCase()} trade idea for ${tradeIdea.symbol}` 
          });
          await interaction.followUp({ embeds: [tradeEmbed] });
        }
        
        endPerformanceTimer(timerId);
      } catch (error: any) {
        logDiscordInteraction('ERROR', { 
          commandName: interaction.commandName, 
          error 
        });
        
        log('ERROR', `Error processing derivatives trade request for ${finalSymbol}`, error.message);
        
        // Check if it's a data fetching error (symbol not found)
        const isDataError = error.message.includes('No data received') || 
                           error.message.includes('Invalid response format') ||
                           error.message.includes('Error fetching candlestick data');
        
        if (isDataError) {
          await interaction.editReply({
            embeds: [{
              color: 0xff6b6b,
              title: '❌ Symbol Not Found',
              description: `Unable to find market data for "${finalSymbol}".`,
              fields: [
                {
                  name: '🔍 Possible Issues',
                  value: '• Symbol may not exist on Binance Futures\n• Symbol may be delisted or suspended\n• Temporary API connectivity issues',
                  inline: false
                },
                {
                  name: '💡 Suggestions',
                  value: '• Check the symbol spelling\n• Try popular symbols like BTCUSDT, ETHUSDT\n• Wait a moment and try again',
                  inline: false
                },
                {
                  name: '📊 Your Input',
                  value: `Original: "${symbol}"\nProcessed: "${finalSymbol}"`,
                  inline: false
                }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        } else {
          // Generic error handling
          await interaction.editReply({
            embeds: [{
              color: 0xff6b6b,
              title: '❌ Analysis Error',
              description: `An error occurred while analyzing ${finalSymbol}. Please try again later.`,
              fields: [
                {
                  name: '🔧 Technical Details',
                  value: error.message.length > 200 ? error.message.substring(0, 200) + '...' : error.message,
                  inline: false
                }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        }
        endPerformanceTimer(timerId);
      }
      return;
    }

    if (interaction.commandName === 'promptcheck') {
      try {
        // Only defer if not already deferred
        if (!interaction.deferred && !interaction.replied) {
          logDiscordInteraction('DEFER_REPLY', {
            commandName: interaction.commandName,
            message: 'Processing prompt logging request...'
          });
          
          await interaction.deferReply();
        }
        
        log('INFO', '🔍 PROMPT CHECK: Starting prompt logging process...');
        
        // Fetch sample market data for BTCUSDT
        const sampleMarketData = await getEnhancedDerivativesMarketData('BTCUSDT', 'promptcheck-debug');
        
        log('INFO', '🔍 PROMPT CHECK: Market data fetched, generating trade idea to capture prompt and response...');

        // Generate trade idea (this will log the complete prompt and Gemini's response)
        const tradeIdea = await generateDerivativesTradeIdea(sampleMarketData, 'promptcheck-debug');

        log('INFO', '🔍 PROMPT CHECK: Prompt logging completed successfully');
        
        // Send confirmation to Discord
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: '✅ **Prompt logging completed**\n\nCheck the bot console for:\n• Complete FinCoT-TA prompt\n• Gemini raw response\n• Parsed trade analysis'
          });
        } else {
          await interaction.reply({
            content: '✅ **Prompt logging completed**\n\nCheck the bot console for:\n• Complete FinCoT-TA prompt\n• Gemini raw response\n• Parsed trade analysis'
          });
        }
        
        logDiscordInteraction('EDIT_REPLY', {
          commandName: interaction.commandName,
          message: 'Prompt logging completed. Check bot console for detailed output.'
        });
        
      } catch (error) {
        // Remove from processed set if there was an error so it can be retried
        processedInteractions.delete(interactionKey);
        
        log('ERROR', '🔍 PROMPT CHECK: Error during prompt logging', error.message);
        
        logDiscordInteraction('ERROR', {
          commandName: interaction.commandName,
          error: error.message
        });

        await interaction.editReply({
          content: '❌ **Error during prompt logging**\n\nCheck the bot console for error details.',
        });
      }
      return;
    }
    
  } catch (error) {
    logDiscordInteraction('ERROR', { 
      commandName: interaction.commandName, 
      error 
    });
    try {
      if (interaction.deferred) {
        await interaction.editReply('❌ Sorry, I encountered an error processing your request. Please try again.');
      } else {
        await interaction.reply('❌ Sorry, I encountered an error processing your request. Please try again.');
      }
    } catch (replyError) {
      log('ERROR', 'Error sending error message', replyError);
    }
  }
});

// Helper function to create market overview embed
async function createMarketOverviewEmbed() {
  try {
    logFunctionEntry('createMarketOverviewEmbed');
    log('INFO', 'Fetching real-time market data for overview...');
    
    const majorCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'BNB'];
    const cryptoData = await getMultipleCryptoData(majorCryptos);
    
    if (cryptoData.length === 0) {
      throw new Error('No market data available');
    }
    
    // Calculate aggregate metrics
    const totalMarketCap = cryptoData.reduce((sum, crypto) => sum + crypto.marketCap, 0);
    const totalVolume = cryptoData.reduce((sum, crypto) => sum + crypto.volume, 0);
    const avgChange24h = cryptoData.reduce((sum, crypto) => sum + crypto.change24h, 0) / cryptoData.length;
    
    // Determine overall market sentiment based on average change
    const overallSentiment = avgChange24h > 2 ? 'Bullish 🟢' : 
                            avgChange24h < -2 ? 'Bearish 🔴' : 'Neutral 🟡';
    
    const embed = new EmbedBuilder()
      .setColor(avgChange24h > 0 ? 0x00ff00 : avgChange24h < 0 ? 0xff0000 : 0xffff00)
      .setTitle('📊 Live Market Overview')
      .setDescription(`Real-time data from ${cryptoData.length} major cryptocurrencies`)
      .addFields(
        { 
          name: '📈 Market Sentiment', 
          value: overallSentiment, 
          inline: true 
        },
        { 
          name: '📊 Avg 24h Change', 
          value: `${avgChange24h > 0 ? '+' : ''}${avgChange24h.toFixed(2)}%`, 
          inline: true 
        },
        { 
          name: '💰 Total Market Cap', 
          value: `$${(totalMarketCap / 1e12).toFixed(2)}T`, 
          inline: true 
        },
        { 
          name: '📈 24h Volume', 
          value: `$${(totalVolume / 1e9).toFixed(1)}B`, 
          inline: true 
        },
        {
          name: '🏆 Top Performers',
          value: cryptoData
            .sort((a, b) => b.change24h - a.change24h)
            .slice(0, 3)
            .map(crypto => `${crypto.symbol}: ${crypto.change24h > 0 ? '+' : ''}${crypto.change24h.toFixed(2)}%`)
            .join('\n'),
          inline: true
        },
        {
          name: '📉 Underperformers',
          value: cryptoData
            .sort((a, b) => a.change24h - b.change24h)
            .slice(0, 3)
            .map(crypto => `${crypto.symbol}: ${crypto.change24h > 0 ? '+' : ''}${crypto.change24h.toFixed(2)}%`)
            .join('\n'),
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({ text: 'CryptoTrader Bot • Live Market Data' });
  
    logFunctionExit('createMarketOverviewEmbed', { cryptoCount: cryptoData.length });
    return embed;
    
  } catch (error) {
    log('ERROR', 'Error creating market overview', error);
    
    // Return error embed
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Market Data Unavailable')
      .setDescription('Unable to fetch real-time market data at the moment')
      .addFields(
        { 
          name: '🔄 Try Again', 
          value: 'Market data services may be temporarily unavailable', 
          inline: false 
        }
      )
      .setTimestamp()
      .setFooter({ text: 'CryptoTrader Bot • Error State' });
  }
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
function createNewsEmbed(newsData?: NewsItem[]) {
  if (!newsData || newsData.length === 0) {
    return new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('📰 Crypto News')
      .setDescription('No news articles available at the moment')
      .setTimestamp()
      .setFooter({ text: 'CryptoTrader Bot • News Service' });
  }
  
  const newsToDisplay = newsData;
  const isRealTime = !!newsData;
  
  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`📰 ${isRealTime ? 'Live' : 'Cached'} Crypto News & Sentiment`)
    .setDescription(`${isRealTime ? 'Real-time' : 'Recent'} market-moving news with sentiment analysis`)
    .setTimestamp()
    .setFooter({ text: `CryptoTrader Bot • ${isRealTime ? 'Live' : 'Cached'} News Analysis` });
  
  newsToDisplay.forEach((news: NewsItem, index: number) => {
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

// Helper function to create derivatives trade idea embed
function createDerivativesTradeEmbed(tradeIdea: DerivativesTradeIdea, marketData: any) {
  const embed = new EmbedBuilder()
    .setColor(tradeIdea.direction === 'long' ? 0x00ff00 : 0xff0000)
    .setTitle(`🎯 ${tradeIdea.symbol} Derivatives Trade Idea`)
    .setTimestamp();

  // Handle no trade recommendation case
  if (tradeIdea.confidence === 0 || tradeIdea.entry === 0) {
    embed.setColor(0xffaa00) // Orange color for no trade
      .setTitle(`⚠️ ${tradeIdea.symbol} - No Trade Recommendation`)
      .addFields(
        { name: '📊 Analysis Result', value: 'No high-probability setup identified', inline: false },
        { name: '🎲 Confidence', value: `${tradeIdea.confidence}%`, inline: true },
        { name: '⏰ Timeframe', value: tradeIdea.timeframe, inline: true }
      );
    
    // Add truncated reasoning for no trade
    const reasoningText = tradeIdea.technicalReasoning
      .map(reason => `• ${reason}`)
      .join('\n');
    
    // Truncate to fit Discord's 1024 character limit
    const truncatedReasoning = reasoningText.length > 1000 
      ? reasoningText.substring(0, 1000) + '...' 
      : reasoningText;
    
    embed.addFields({ name: '🔍 Analysis Summary', value: truncatedReasoning });
    
  } else {
    // Add trade details for valid trades
    embed.addFields(
      { name: '📊 Direction', value: tradeIdea.direction.toUpperCase(), inline: true },
      { name: '🎯 Entry Price', value: `$${tradeIdea.entry.toLocaleString()}`, inline: true },
      { name: '🎯 Target Price', value: `$${tradeIdea.targetPrice.toLocaleString()}`, inline: true },
      { name: '🛡️ Stop Loss', value: `$${tradeIdea.stopLoss.toLocaleString()}`, inline: true },
      { name: '📈 Risk/Reward', value: `${tradeIdea.riskReward}:1`, inline: true },
      { name: '🎲 Confidence', value: `${tradeIdea.confidence}%`, inline: true },
      { name: '⏰ Timeframe', value: tradeIdea.timeframe, inline: true }
    );

    // Add technical reasoning with length limit
    const reasoningText = tradeIdea.technicalReasoning
      .map(reason => `• ${reason}`)
      .join('\n');
    
    // Truncate to fit Discord's 1024 character limit
    const truncatedReasoning = reasoningText.length > 1000 
      ? reasoningText.substring(0, 1000) + '...' 
      : reasoningText;
    
    embed.addFields({ name: '🔍 Technical Analysis', value: truncatedReasoning });
  }

  return embed;
}

// Message handler for commands
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  try {
    // Hello command for #testing-hub channel
    if (content === '!hello' && 'name' in message.channel && message.channel.name === 'testing-hub') {
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
      const marketEmbed = await createMarketOverviewEmbed();
      await message.channel.send({ embeds: [marketEmbed] });
      return;
    }

    // Crypto analysis command (e.g., !btc, !eth, !sol)
    const cryptoMatch = content.match(/!(btc|eth|sol|ada)/) as RegExpMatchArray | null;
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
        
        await loadingMsg.edit(`❌ **Sorry, could not fetch ${symbol} data. Please try again later.**`);
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
      } else {
        await message.channel.send('💡 **Usage:** `!price btc` or `!price eth` etc.');
      }
      return;
    }

    // Crypto analysis command (e.g., !btc, !eth, !sol) - This block was moved above
    const cryptoMatch2 = content.match(/!(btc|eth|sol|ada)/);
    if (cryptoMatch2) {
      const symbol = cryptoMatch2[1].toUpperCase();
      
      await message.channel.send(`💡 **Please use the slash command instead:** \`/crypto ${symbol.toLowerCase()}\` for better performance and real-time data.`);
      return;
    }

    // News command
    if (content.includes('!news') || content.includes('crypto news')) {
      const loadingMsg = await message.channel.send('📰 **Fetching latest crypto news...**');
      
      try {
        // Fetch real-time news from CryptoCompare
        const realTimeNews = await fetchCoinDeskNews(5); // Limit to 5 articles for Discord embed
        
        if (realTimeNews.length > 0) {
          await loadingMsg.edit(`✅ **Found ${realTimeNews.length} latest crypto news articles!**`);
          const newsEmbed = createNewsEmbed(realTimeNews);
          await message.channel.send({ embeds: [newsEmbed] });
        } else {
          await loadingMsg.edit('⚠️ **News service temporarily unavailable. Please try again later.**');
        }
      } catch (error) {
        console.error('Error fetching real-time news for !news command:', error);
        await loadingMsg.edit('⚠️ **News service temporarily unavailable. Please try again later.**');
      }
      return;
    }

    // Help command
    if (content.includes('!help') || content.includes('help')) {
      const helpEmbed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('🤖 CryptoTrader Bot Commands')
        .setDescription('Available commands for crypto trading analysis')
        .addFields(
          { name: '!tradingidea', value: 'Get AI-powered trading recommendations', inline: false },
          { name: '!market', value: 'View current market overview', inline: false },
          { name: '!btc, !eth, !sol, !ada', value: 'Get technical analysis for specific crypto', inline: false },
          { name: '!price [symbol]', value: 'Get quick price for any crypto', inline: false },
          { name: '!news', value: 'Latest crypto news with sentiment analysis', inline: false },
          { name: '!test', value: 'Test API connectivity', inline: false },
          { name: '!help', value: 'Show this help message', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'CryptoTrader Bot • AI-Powered Trading Analysis' });

      await message.channel.send({ embeds: [helpEmbed] });
      return;
    }

  } catch (error) {
    console.error('Error handling message:', error);
    await message.channel.send('❌ Sorry, I encountered an error processing your request. Please try again.');
  }
});

// Error handling
client.on(Events.Error, (error) => {
  logAppState('ERROR', { message: 'Discord client error', error });
});

process.on('unhandledRejection', (error) => {
  logAppState('ERROR', { message: 'Unhandled promise rejection', error });
});

// Login to Discord
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  logAppState('ERROR', { message: 'DISCORD_BOT_TOKEN is not set in .env file' });
  process.exit(1);
}

client.login(token).catch((error) => {
  logAppState('ERROR', { message: 'Failed to login to Discord', error });
  process.exit(1);
});