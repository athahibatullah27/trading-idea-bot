import { GoogleGenerativeAI } from '@google/generative-ai';
import { CryptoData, NewsItem, MarketConditions, TradingRecommendation } from './types.js';
import { EnhancedDerivativesMarketData } from './derivativesDataService.js';
import dotenv from 'dotenv';
import { 
  logApiRequest, 
  logApiResponse, 
  startPerformanceTimer, 
  endPerformanceTimer,
  logFunctionEntry,
  logFunctionExit,
  log
} from './utils/logger.js';

dotenv.config();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export interface DerivativesTradeIdea {
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  riskReward: number;
  confidence: number;
  technicalReasoning: string[];
  symbol: string;
  timeframe: string;
}

export async function generateGeminiRecommendations(
  cryptoData: CryptoData[],
  news?: NewsItem[],
  marketConditions?: MarketConditions
): Promise<TradingRecommendation[]> {
  const timerId = startPerformanceTimer('generateGeminiRecommendations');
  logFunctionEntry('generateGeminiRecommendations', { 
    cryptoCount: cryptoData.length, 
    newsCount: news?.length || 0,
    hasMarketConditions: !!marketConditions 
  });
  
  try {
    log('INFO', 'Generating AI recommendations using Gemini...');
    
    if (!process.env.GEMINI_API_KEY) {
      log('ERROR', 'GEMINI_API_KEY is not configured');
      logFunctionExit('generateGeminiRecommendations', []);
      endPerformanceTimer(timerId);
      return [];
    }

    if (cryptoData.length === 0) {
      log('ERROR', 'No crypto data provided for Gemini analysis');
      logFunctionExit('generateGeminiRecommendations', []);
      endPerformanceTimer(timerId);
      return [];
    }

    // Construct the prompt for Gemini
    const prompt = buildGeminiPrompt(cryptoData, news, marketConditions);
    
    log('INFO', 'Sending prompt to Gemini API...');
    
    // Log API request (without sensitive data)
    logApiRequest({
      endpoint: 'Gemini AI API',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': '[REDACTED]'
      },
      body: {
        model: 'gemini-2.0-flash-exp',
        promptLength: prompt.length,
        cryptoSymbols: cryptoData.map(c => c.symbol)
      }
    });
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    logApiResponse('Gemini AI API', {
      status: 200,
      data: {
        responseLength: text.length,
        responsePreview: text.substring(0, 200) + '...'
      }
    });
    
    log('INFO', 'Received response from Gemini API');
    
    const recommendations = parseGeminiResponse(text, cryptoData);
    
    if (recommendations.length === 0) {
      log('ERROR', 'Failed to parse valid recommendations from Gemini');
      logFunctionExit('generateGeminiRecommendations', []);
      endPerformanceTimer(timerId);
      return [];
    }
    
    log('INFO', `Generated ${recommendations.length} AI recommendations`);
    logFunctionExit('generateGeminiRecommendations', { count: recommendations.length });
    endPerformanceTimer(timerId);
    return recommendations;
    
  } catch (error) {
    log('ERROR', 'Error generating Gemini recommendations', error.message);
    
    logApiResponse('Gemini AI API', {
      status: 500,
      error: error.message
    });
    
    logFunctionExit('generateGeminiRecommendations', []);
    endPerformanceTimer(timerId);
    return [];
  }
}

function buildGeminiPrompt(
  cryptoData: CryptoData[],
  news?: NewsItem[],
  marketConditions?: MarketConditions
): string {
  const cryptoDataText = cryptoData.map(crypto => 
    `${crypto.name} (${crypto.symbol}):
    - Current Price: $${crypto.price.toLocaleString()}
    - 24h Change: ${crypto.change24h.toFixed(2)}%
    - Volume: $${(crypto.volume / 1e9).toFixed(1)}B
    - Market Cap: $${(crypto.marketCap / 1e9).toFixed(1)}B
    - RSI: ${crypto.rsi.toFixed(1)}
    - MACD: ${crypto.macd.toFixed(1)}
    - Bollinger Bands: Upper $${crypto.bollinger.upper.toLocaleString()}, Middle $${crypto.bollinger.middle.toLocaleString()}, Lower $${crypto.bollinger.lower.toLocaleString()}`
  ).join('\n\n');

  const newsText = news ? news.slice(0, 3).map(item => 
    `- ${item.title} (${item.sentiment} sentiment, ${item.impact} impact)`
  ).join('\n') : 'No recent news available';

  const marketText = marketConditions ? 
    `Overall: ${marketConditions.overall}, Volatility: ${marketConditions.volatility}, Fear & Greed: ${marketConditions.fearGreedIndex}` :
    'Market conditions not available';

  return `You are an expert cryptocurrency trading analyst. Based on the following market data, provide trading recommendations for each cryptocurrency.

MARKET DATA:
${cryptoDataText}

RECENT NEWS:
${newsText}

MARKET CONDITIONS:
${marketText}

INSTRUCTIONS:
1. Analyze each cryptocurrency's technical indicators (RSI, MACD, Bollinger Bands, price action)
2. Consider the overall market sentiment and recent news
3. Provide a trading recommendation (buy, sell, or hold) for each crypto
4. Include confidence level (0-100%), target price, stop loss, timeframe, and risk level
5. Provide 3-4 specific reasons for each recommendation

IMPORTANT: Respond ONLY with a valid JSON array in this exact format:
[
  {
    "crypto": "BTC",
    "action": "buy",
    "confidence": 75,
    "targetPrice": 125000,
    "stopLoss": 115000,
    "reasoning": [
      "Strong technical momentum with RSI in healthy range",
      "Breaking above key resistance levels",
      "Positive market sentiment supports upward movement",
      "Volume confirms institutional interest"
    ],
    "timeframe": "2-4 weeks",
    "riskLevel": "medium"
  }
]

Ensure all prices are realistic numbers without commas, confidence is 0-100, action is "buy"/"sell"/"hold", riskLevel is "low"/"medium"/"high", and reasoning has 3-4 items.`;
}

function parseGeminiResponse(text: string, cryptoData: CryptoData[]): TradingRecommendation[] {
  logFunctionEntry('parseGeminiResponse', { 
    textLength: text.length, 
    cryptoCount: cryptoData.length 
  });
  
  try {
    // Clean the response text to extract JSON
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Additional cleaning for potential formatting issues
    jsonText = jsonText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Find the JSON array bounds more reliably
    const startIndex = jsonText.indexOf('[');
    const lastIndex = jsonText.lastIndexOf(']');
    
    if (startIndex === -1 || lastIndex === -1 || startIndex >= lastIndex) {
      throw new Error('No valid JSON array found in response');
    }
    
    // Extract only the JSON array part
    jsonText = jsonText.substring(startIndex, lastIndex + 1);
    
    log('INFO', 'Cleaned JSON for parsing:', jsonText.substring(0, 200) + '...');
    
    // Parse the JSON
    const recommendations: TradingRecommendation[] = JSON.parse(jsonText);
    
    if (!Array.isArray(recommendations)) {
      throw new Error('Response is not an array');
    }
    
    // Validate and sanitize the recommendations
    const validRecommendations = recommendations
      .filter(rec => rec.crypto && rec.action && rec.confidence !== undefined)
      .map(rec => ({
        crypto: rec.crypto.toUpperCase(),
        action: ['buy', 'sell', 'hold'].includes(rec.action) ? rec.action : 'hold',
        confidence: Math.max(0, Math.min(100, Math.round(rec.confidence))),
        targetPrice: Math.max(0, Math.round(rec.targetPrice || 0)),
        stopLoss: Math.max(0, Math.round(rec.stopLoss || 0)),
        reasoning: Array.isArray(rec.reasoning) ? rec.reasoning.slice(0, 4) : ['AI analysis completed'],
        timeframe: rec.timeframe || '1-4 weeks',
        riskLevel: ['low', 'medium', 'high'].includes(rec.riskLevel) ? rec.riskLevel : 'medium'
      }))
      .filter(rec => cryptoData.some(crypto => crypto.symbol === rec.crypto));
    
    log('INFO', `Parsed ${validRecommendations.length} valid recommendations from Gemini`);
    logFunctionExit('parseGeminiResponse', { count: validRecommendations.length });
    return validRecommendations;
    
  } catch (error) {
    log('ERROR', 'Error parsing Gemini response', error.message);
    log('ERROR', 'Raw response (first 500 chars):', text.substring(0, 500) + '...');
    log('ERROR', 'Raw response (last 500 chars):', '...' + text.substring(Math.max(0, text.length - 500)));
    
    // Try to extract partial JSON if possible
    try {
      const startIndex = text.indexOf('[');
      if (startIndex !== -1) {
        // Try to find a complete JSON object within the response
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let endIndex = -1;
        
        for (let i = startIndex; i < text.length; i++) {
          const char = text[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '[') braceCount++;
            if (char === ']') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i;
                break;
              }
            }
          }
        }
        
        if (endIndex !== -1) {
          const partialJson = text.substring(startIndex, endIndex + 1);
          log('INFO', 'Attempting to parse partial JSON...');
          const partialRecommendations = JSON.parse(partialJson);
          
          if (Array.isArray(partialRecommendations) && partialRecommendations.length > 0) {
            log('INFO', `Successfully parsed partial JSON with ${partialRecommendations.length} recommendations`);
            
            // Apply the same validation as above
            const validRecommendations = partialRecommendations
              .filter(rec => rec.crypto && rec.action && rec.confidence !== undefined)
              .map(rec => ({
                crypto: rec.crypto.toUpperCase(),
                action: ['buy', 'sell', 'hold'].includes(rec.action) ? rec.action : 'hold',
                confidence: Math.max(0, Math.min(100, Math.round(rec.confidence))),
                targetPrice: Math.max(0, Math.round(rec.targetPrice || 0)),
                stopLoss: Math.max(0, Math.round(rec.stopLoss || 0)),
                reasoning: Array.isArray(rec.reasoning) ? rec.reasoning.slice(0, 4) : ['AI analysis completed'],
                timeframe: rec.timeframe || '1-4 weeks',
                riskLevel: ['low', 'medium', 'high'].includes(rec.riskLevel) ? rec.riskLevel : 'medium'
              }))
              .filter(rec => cryptoData.some(crypto => crypto.symbol === rec.crypto));
            
            if (validRecommendations.length > 0) {
              logFunctionExit('parseGeminiResponse', { count: validRecommendations.length });
              return validRecommendations;
            }
          }
        }
      }
    } catch (partialError) {
      log('ERROR', 'Partial JSON parsing also failed', partialError.message);
    }
    
    logFunctionExit('parseGeminiResponse', []);
    return [];
  }
}

export async function generateDerivativesTradeIdea(
  marketData: EnhancedDerivativesMarketData
): Promise<DerivativesTradeIdea | null> {
  const timerId = startPerformanceTimer('generateDerivativesTradeIdea');
  logFunctionEntry('generateDerivativesTradeIdea', { symbol: marketData.symbol });
  
  try {
    log('INFO', `Generating derivatives trade idea for ${marketData.symbol} using Gemini...`);
    
    if (!process.env.GEMINI_API_KEY) {
      log('ERROR', 'GEMINI_API_KEY is not configured');
      logFunctionExit('generateDerivativesTradeIdea', null);
      endPerformanceTimer(timerId);
      return null;
    }

    // Construct the prompt for derivatives trade analysis
    const prompt = buildEnhancedDerivativesTradePrompt(marketData);
    
    log('INFO', 'Sending derivatives trade prompt to Gemini API...');
    
    // Log API request (without sensitive data)
    logApiRequest({
      endpoint: 'Gemini AI API (Derivatives)',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': '[REDACTED]'
      },
      body: {
        model: 'gemini-2.0-flash-exp',
        promptLength: prompt.length,
        symbol: marketData.symbol,
        timeframes: Object.keys(marketData.timeframes)
      }
    });
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    logApiResponse('Gemini AI API (Derivatives)', {
      status: 200,
      data: {
        responseLength: text.length,
        responsePreview: text.substring(0, 200) + '...'
      }
    });
    
    log('INFO', 'Received derivatives trade response from Gemini API');
    
    // Parse the JSON response
    const tradeIdea = parseDerivativesTradeResponse(text, marketData);
    
    if (!tradeIdea) {
      log('ERROR', 'Failed to parse valid trade idea from Gemini');
      logFunctionExit('generateDerivativesTradeIdea', null);
      endPerformanceTimer(timerId);
      return null;
    }
    
    log('INFO', `Generated derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol}`);
    logFunctionExit('generateDerivativesTradeIdea', { 
      direction: tradeIdea.direction, 
      confidence: tradeIdea.confidence 
    });
    endPerformanceTimer(timerId);
    return tradeIdea;
    
  } catch (error) {
    log('ERROR', 'Error generating derivatives trade idea', error.message);
    
    logApiResponse('Gemini AI API (Derivatives)', {
      status: 500,
      error: error.message
    });
    
    logFunctionExit('generateDerivativesTradeIdea', null);
    endPerformanceTimer(timerId);
    return null;
  }
}

function buildEnhancedDerivativesTradePrompt(marketData: EnhancedDerivativesMarketData): string {
  const { symbol, timeframes, market } = marketData;
  
  return `You are an expert derivatives trader specializing in multi-timeframe technical analysis, with a primary focus on capital preservation and identifying high-probability setups. Your analysis must be solely based on the provided technical data.

DATA:
{
    "symbol": "${symbol}",
    "dataTimestamp": "${marketData.dataTimestamp}",
    "4-HOUR TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['4h'].indicators.currentPrice.toFixed(5)},
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
      "Recent Candles (OHLCV)": [${timeframes['4h'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
    "1-HOUR TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['1h'].indicators.currentPrice.toFixed(5)},
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
      "Recent Candles (OHLCV)": [${timeframes['1h'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
    "MARKET CONDITIONS": {
      "24h Volume": ${market.volume24h.toFixed(0)},
      "Volume Trend": "${market.volumeTrend}",
      "Average Volume": ${market.averageVolume.toFixed(0)},
      "Funding Rate": ${market.fundingRate.toFixed(3)}
    }
}

INSTRUCTIONS FOR ANALYSIS:

**<thinking>**
**Expert Analytical Process:** Apply a systematic, top-down multi-timeframe analysis, prioritizing capital preservation.

**Step 1: Establish Primary Trend (4-Hour Timeframe - Highest Priority):**
 - Analyze the 4-hour EMA trend, MACD trend, and recent OHLCV to determine the dominant market direction (bullish, bearish, or ranging).
 - Identify major 4-hour support and resistance levels. This timeframe provides the foundational context; all subsequent lower timeframe analysis MUST align with this primary trend for a high-confidence trade idea.
 - *Self-assessment:* Is the 4-hour trend direction clear and unambiguous? If not, note the ambiguity as a potential reason for a 'No Trade Idea'.

**Step 2: Confirm Momentum and Setup (1-Hour Timeframe - Secondary Priority):**
 - Analyze the 1-hour EMA trend, MACD, and RSI. Crucially, assess if these indicators and their trends *align* with the established 4-hour trend. Strong alignment across timeframes is paramount for high confidence.
 - Identify key 1-hour support and resistance levels. Observe price action (OHLCV) reacting to or approaching these levels.
 - Evaluate 1-hour RSI trend (rising/falling) and its position relative to overbought (70) and oversold (30) thresholds. A rising RSI from below 30 is a stronger bullish signal than a rising RSI above 70, which may indicate overextension and potential reversal.
 - Analyze 1-hour MACD for bullish/bearish crossovers and the histogram's trend (increasing/decreasing momentum). Confirm if it is reinforcing momentum in the direction of the 4-hour trend.
 - Interpret Bollinger Bands: Are they expanding (increasing volatility) or contracting (decreasing volatility)? Is price breaking out or consolidating within the bands?
 - *Self-assessment:* Do 1-hour signals strongly confirm the 4-hour trend, or are there conflicts? If conflicts exist, prioritize the 4-hour trend. If the conflict is significant and persistent, this may lead to a 'No Trade Idea'.

**Step 3: Candlestick and Volume Confirmation (Both Timeframes):**
 - Examine recent OHLCV data for significant candlestick patterns (e.g., Bullish Engulfing, Hammer, Shooting Star, Bearish Engulfing) specifically at identified key support/resistance levels. Interpret their implications in the context of the established multi-timeframe trend.
 - Analyze the 24h Volume and Volume Trend. Significantly *above average volume* (e.g., 84000 vs 50000) *confirming* price movements (e.g., rising price on rising volume for long setups, falling price on rising volume for short setups) adds the highest confidence to the trade idea. Below average volume or volume divergence from price action indicates lower confidence or potential false signals.
 - *Self-assessment:* Does volume unequivocally confirm price action and the trend? Are identified candlestick patterns strong and positioned at relevant price levels?

**Step 4: Confluence Assessment and Explicit Signal Weighting:**
 - Systematically weigh the strength of each aligned signal. Assign the *highest importance* to Multi-Timeframe Trend Alignment (4h and 1h in same direction) and Volume Confirmation.
 - Assign *medium importance* to strong momentum indicator alignment (RSI trend, MACD crossover/histogram) and price action at key support/resistance levels.
 - Assign *lower importance* to individual candlestick patterns unless they occur at critical support/resistance with strong volume.
 - Identify the strongest technical setup by assessing the overall confluence of aligned, weighted signals. A setup with 3-5 strongly confirming indicators is generally more successful.
 - *Self-assessment:* Is there overwhelming, weighted evidence for a clear directional bias? Or are signals mixed, ambiguous, or lacking sufficient confluence?

**Step 5: Risk Management and Decision Formulation:**
 - Based on the strongest setup and its confluence, determine the optimal entry price. Consider current market structure and recent price action (e.g., a pullback to a key EMA or established support/resistance level).
 - Precisely place the stop-loss using multiple support/resistance levels to ensure robust risk management and minimize potential losses.
 - Calculate the Risk-Reward Ratio. If the calculated ratio is less than 2:1, the trade idea is considered invalid for a high-confidence setup. In such cases, state 'No Trade Idea'.
 - *Self-assessment:* Is the proposed trade idea robust from a risk management perspective? Does it meet the minimum 2:1 risk-reward ratio? Is capital preservation prioritized?

**Step 6: Final Confidence Calibration and Trade Idea Decision:**
 - **If** 4h and 1h timeframes align, AND there is strong confluence of 3+ weighted signals, AND the risk-reward is >= 2:1, **THEN** provide a high-confidence trade idea (75-95%). The confidence score should directly reflect the strength of confluence and alignment.
 - **ELSE IF** timeframes conflict, OR indicators are mixed/ambiguous, OR risk-reward is < 2:1, **THEN** state 'No Trade Idea' and provide detailed explanation for abstention due to lack of a high-probability setup or unfavorable risk. In such cases, the 'confidence' field should be explicitly stated as 'N/A' or below 75%.
 - Formulate 5-6 specific technical reasons in the 'technicalReasoning' array. Prioritize the most impactful and aligned signals, justifying the chosen trade direction and the assigned confidence level.
**</thinking>**

IMPORTANT NOTES:
- Use TREND analysis (rising/falling RSI, MACD trend, Bollinger expansion/contraction) with full contextual awareness.
- Consider VOLUME CONFIRMATION (significantly above average volume on trending moves = higher confidence) as a critical validation.
- Focus on RECENT PRICE ACTION from candlestick data, especially reactions at support/resistance.
- Ensure risk-reward ratio is at least 2:1 for all high-confidence trades.
- Maintain HIGH PRECISION for all prices (up to 5 decimal places for accuracy).

**<output>**
Respond ONLY with a valid JSON object in this exact format:
{ "direction": "long" | "short" | "no_trade_due_to_conflict", "entry": 119000.50000 | 0.0, "stopLoss": 117500.25000 | 0.0, "riskReward": 3.0 | 0.0, "confidence": 85 | "N/A", "technicalReasoning": [ "reason1", "reason2",... ], "timeframe": "6-24 hours" }

- Ensure all prices are realistic numbers with high precision (up to 5 decimal places).
- If 'direction' is 'no_trade_due_to_conflict', set 'entry', 'stopLoss', and 'riskReward' to 0.0, and 'confidence' to 'N/A' or below 75%, with 'technicalReasoning' explaining the lack of a clear setup or conflicting signals.
- 'confidence' must be between 75-95 for high-quality setups. 'riskReward' is a decimal (e.g., 3.0).
- 'technicalReasoning' must contain 5-6 items, explicitly focusing on multi-timeframe analysis, trend alignment, momentum, and volume confirmation, ordered by their impact on the decision.
**</output>**`;
}

function parseDerivativesTradeResponse(text: string, marketData: EnhancedDerivativesMarketData): DerivativesTradeIdea | null {
  logFunctionEntry('parseDerivativesTradeResponse', { 
    textLength: text.length, 
    symbol: marketData.symbol 
  });
  
  try {
    // Clean the response text to extract JSON
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Additional cleaning for potential formatting issues
    jsonText = jsonText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Find the JSON object bounds
    const startIndex = jsonText.indexOf('{');
    const lastIndex = jsonText.lastIndexOf('}');
    
    if (startIndex === -1 || lastIndex === -1 || startIndex >= lastIndex) {
      throw new Error('No valid JSON object found in response');
    }
    
    // Extract only the JSON object part
    jsonText = jsonText.substring(startIndex, lastIndex + 1);
    
    log('INFO', 'Cleaned JSON for parsing:', jsonText.substring(0, 200) + '...');
    
    // Parse the JSON
    const tradeData = JSON.parse(jsonText);
    
    // Handle the new "no_trade_due_to_c\onflict" direction
    if (tradeData.direction === 'no_trade_due_to_conflict') {
      log('WARN', 'AI determined no trade due to conflicting signals');
      logFunctionExit('parseDerivativesTradeResponse', { direction: 'no_trade' });
      return {
        direction: 'long', // Default to long for display purposes
        entry: 0,
        stopLoss: 0,
        riskReward: 0,
        confidence: 0,
        technicalReasoning: tradeData.technicalReasoning || ['No high-probability setup identified due to conflicting signals'],
        symbol: marketData.symbol,
        timeframe: 'No trade recommended'
      };
    }
    
    // Handle confidence as either number or "N/A"
    let confidence = 80; // Default fallback
    if (tradeData.confidence === 'N/A' || tradeData.confidence === null) {
      confidence = 0; // Set to 0 to indicate no trade
    } else if (typeof tradeData.confidence === 'number') {
      confidence = Math.max(0, Math.min(95, Math.round(tradeData.confidence)));
    }
    
    // Validate and sanitize the trade idea
    const tradeIdea: DerivativesTradeIdea = {
      direction: ['long', 'short'].includes(tradeData.direction) ? tradeData.direction : 'long',
      entry: Math.max(0, parseFloat((tradeData.entry || marketData.timeframes['1h'].indicators.currentPrice).toFixed(5))),
      stopLoss: Math.max(0, parseFloat((tradeData.stopLoss || marketData.timeframes['1h'].indicators.currentPrice * 0.95).toFixed(5))),
      riskReward: Math.max(0, Math.round((tradeData.riskReward || 0) * 10) / 10),
      confidence: confidence,
      technicalReasoning: Array.isArray(tradeData.technicalReasoning) ? 
        tradeData.technicalReasoning.slice(0, 6) : 
        ['Multi-timeframe technical analysis completed based on current market conditions'],
      symbol: marketData.symbol,
      timeframe: tradeData.timeframe || '6-24 hours'
    };
    
    log('INFO', `Parsed derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol} at $${tradeIdea.entry.toFixed(5)} (Confidence: ${tradeIdea.confidence}%)`);
    logFunctionExit('parseDerivativesTradeResponse', tradeIdea);
    return tradeIdea;
    
  } catch (error) {
    log('ERROR', 'Error parsing derivatives trade response', error.message);
    log('ERROR', 'Raw response (first 500 chars):', text.substring(0, 500) + '...');
    logFunctionExit('parseDerivativesTradeResponse', null);
    return null;
  }
}