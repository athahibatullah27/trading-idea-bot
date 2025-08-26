import { GoogleGenerativeAI } from '@google/generative-ai';
import { CryptoData, NewsItem, MarketConditions, TradingRecommendation } from './types.js';
import { EnhancedDerivativesMarketData } from './types.js';
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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-exp' });

export interface DerivativesTradeIdea {
  direction: 'long' | 'short';
  entry: number;
  targetPrice: number;
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
  marketConditions?: MarketConditions,
  context?: string
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
        model: 'gemini-2.5-flash-exp',
        promptLength: prompt.length,
        cryptoSymbols: cryptoData.map(c => c.symbol)
      },
      context
    });
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    logApiResponse({
      status: 200,
      data: {
        responseLength: text.length,
        responsePreview: text.substring(0, 200) + '...'
      },
      context
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
    
    logApiResponse({
      status: 500,
      error: error.message,
      context
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
  marketData: EnhancedDerivativesMarketData,
  context?: string
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
        model: 'gemini-2.5-flash-exp',
        promptLength: prompt.length,
        symbol: marketData.symbol,
        timeframes: Object.keys(marketData.timeframes)
      },
      context
    });
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // For promptcheck command, log the complete response
    if (context === 'promptcheck-debug') {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 PROMPT CHECK: COMPLETE GEMINI RESPONSE');
      console.log('='.repeat(80));
      console.log(text);
      console.log('='.repeat(80) + '\n');
    }
    
    logApiResponse({
      status: 200,
      data: {
        responseLength: text.length,
        responsePreview: text.substring(0, 200) + '...'
      },
      context
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
    
    logApiResponse({
      status: 500,
      error: error.message,
      context
    });
    
    logFunctionExit('generateDerivativesTradeIdea', null);
    endPerformanceTimer(timerId);
    return null;
  }
}

export function buildEnhancedDerivativesTradePrompt(marketData: EnhancedDerivativesMarketData): string {
  const { symbol, timeframes, market, btcContext } = marketData;
  
  return `You are an expert derivatives trader implementing the FinCoT-TA (Financial Chain-of-Thought Technical Analysis) framework. This systematic approach combines multi-timeframe analysis, signal confluence scoring, and structured reasoning for high-probability trade identification with capital preservation as the primary objective.

## FinCoT-TA FRAMEWORK OVERVIEW

The FinCoT-TA framework employs a systematic 6-step process:
1. **Macro Trend & Market Regime Classification** - Establish dominant market structure using Daily and 4h timeframes
2. **Multi-Timeframe Signal Alignment** - Analyze signals across Daily, 4h, and 1h timeframes
3. **High-Precision Signal Analysis (15m/30m)** - Use lowest timeframes to pinpoint precise entry
4. **Signal Confluence Scoring** - Weight and score technical signals
5. **Risk-Reward Assessment** - Calculate position sizing and risk parameters
6. **Structured Decision Output** - Generate systematic trade recommendation

## MARKET REGIME CLASSIFICATION MATRIX

| Regime | 4h Characteristics | 1h Characteristics | Trade Approach |
|--------|-------------------|-------------------|----------------|
| **Trending Bullish** | EMA20>EMA50, MACD>Signal, RSI 40-70 | Aligned with 4h, Volume confirms | Trend following, pullback entries |
| **Trending Bearish** | EMA20<EMA50, MACD<Signal, RSI 30-60 | Aligned with 4h, Volume confirms | Trend following, bounce shorts |
| **Ranging Volatile** | Price oscillating, BB expanding | High volatility, mixed signals | Range trading, breakout preparation |
| **Ranging Quiet** | Price consolidating, BB contracting | Low volatility, neutral momentum | Breakout anticipation, tight stops |
| **Consolidation** | Price near BB middle, low volatility | Sideways movement, decreasing volume | Await breakout, no position |
| **Breakout Pending** | BB contracting, volume increasing | Momentum building, RSI neutral | Prepare for directional move |

## SIGNAL CONFLUENCE SCORING SYSTEM

### Primary Signals (Weight: 25 points each)
- **Multi-Timeframe Trend Alignment**: Daily, 4h, and 1h trends in same direction
- **Volume Confirmation**: Above-average volume supporting price direction
- **Market Regime Consistency**: All timeframes show same regime type

### Secondary Signals (Weight: 15 points each)
- **Fibonacci Confluence**: Price at key Fib levels (38.2%, 50%, 61.8%)
- **Support/Resistance Reaction**: Price respecting key S/R levels
- **Momentum Alignment**: RSI and MACD trends supporting direction

### Tertiary Signals (Weight: 10 points each)
- **Bollinger Band Position**: Price relative to BB bands
- **EMA Alignment**: Price position relative to EMAs
- **Candlestick Patterns**: Reversal/continuation patterns at key levels

**Scoring Thresholds:**
- 85-100 points: High Confidence (85-95%)
- 70-84 points: Medium Confidence (75-84%)
- Below 70 points: No Trade (conflicting signals)

## VOLUME ANALYSIS FRAMEWORK

### Volume Trend Classification:
- **Significantly Above Average** (>150% avg): Strong institutional interest
- **Above Average** (120-150% avg): Moderate institutional interest  
- **Average** (80-120% avg): Normal retail activity
- **Below Average** (<80% avg): Low conviction, potential false signals

### Volume-Price Confirmation Matrix:
| Price Action | Volume | Signal Strength | Interpretation |
|-------------|--------|-----------------|----------------|
| Rising | Above Average | Strong Bullish | High confidence long |
| Rising | Below Average | Weak Bullish | Low confidence, potential reversal |
| Falling | Above Average | Strong Bearish | High confidence short |
| Falling | Below Average | Weak Bearish | Low confidence, potential bounce |

## RISK MANAGEMENT MATRIX

### Position Sizing Based on Confidence:
- **High Confidence (85-95%)**: 2-3% account risk
- **Medium Confidence (75-84%)**: 1-2% account risk
- **Low Confidence (<75%)**: No position

### Stop Loss Placement Hierarchy:
1. **Primary**: Below/above key Fibonacci levels
2. **Secondary**: Below/above major support/resistance
3. **Tertiary**: Beyond recent swing high/low
4. **Emergency**: 2-3% from entry (absolute maximum)

### Target Selection Framework:
1. **Conservative**: Next Fibonacci extension level
2. **Moderate**: 2:1 risk-reward minimum
3. **Aggressive**: Major resistance/support flip level

DATA:
{
    "symbol": "${symbol}",
    "dataTimestamp": "${marketData.dataTimestamp}",
    "1-DAY TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['1d'].indicators.currentPrice.toFixed(5)},
      "Market Regime": "${timeframes['1d'].marketRegime}",
      "RSI (14)": ${timeframes['1d'].indicators.rsi.toFixed(1)},
      "RSI Trend": "${timeframes['1d'].indicators.rsiTrend}",
      "MACD": ${timeframes['1d'].indicators.macd.macd.toFixed(2)},
      "MACD Signal": ${timeframes['1d'].indicators.macd.signal.toFixed(2)},
      "MACD Histogram": ${timeframes['1d'].indicators.macd.histogram.toFixed(2)},
      "MACD Trend": "${timeframes['1d'].indicators.macd.trend}",
      "Bollinger Bands Upper": ${timeframes['1d'].indicators.bollinger.upper.toFixed(5)},
      "Bollinger Bands Middle": ${timeframes['1d'].indicators.bollinger.middle.toFixed(5)},
      "Bollinger Bands Lower": ${timeframes['1d'].indicators.bollinger.lower.toFixed(5)},
      "Bollinger Bands State": "${timeframes['1d'].indicators.bollinger.trend}",
      "EMA 20": ${timeframes['1d'].indicators.ema20.toFixed(5)},
      "EMA 50": ${timeframes['1d'].indicators.ema50.toFixed(5)},
      "EMA Trend": "${timeframes['1d'].indicators.emaTrend}",
      "Support Levels": [${timeframes['1d'].indicators.support.map(s => s.toFixed(5)).join(', ')}],
      "Resistance Levels": [${timeframes['1d'].indicators.resistance.map(r => r.toFixed(5)).join(', ')}],
      "Fibonacci Retracement": {
        "Swing High (0%)": ${timeframes['1d'].indicators.fibonacci.retracement.level_0.toFixed(5)},
        "23.6%": ${timeframes['1d'].indicators.fibonacci.retracement.level_236.toFixed(5)},
        "38.2%": ${timeframes['1d'].indicators.fibonacci.retracement.level_382.toFixed(5)},
        "50%": ${timeframes['1d'].indicators.fibonacci.retracement.level_500.toFixed(5)},
        "61.8%": ${timeframes['1d'].indicators.fibonacci.retracement.level_618.toFixed(5)},
        "78.6%": ${timeframes['1d'].indicators.fibonacci.retracement.level_786.toFixed(5)},
        "Swing Low (100%)": ${timeframes['1d'].indicators.fibonacci.retracement.level_1000.toFixed(5)}
      },
      "Fibonacci Extension": {
        "127.2%": ${timeframes['1d'].indicators.fibonacci.extension.level_1272.toFixed(5)},
        "161.8%": ${timeframes['1d'].indicators.fibonacci.extension.level_1618.toFixed(5)},
        "261.8%": ${timeframes['1d'].indicators.fibonacci.extension.level_2618.toFixed(5)}
      },
      "Fibonacci Trend": "${timeframes['1d'].indicators.fibonacci.trend}",
      "Recent Candles (OHLCV)": [${timeframes['1d'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
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
    "30-MINUTE TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['30m'].indicators.currentPrice.toFixed(5)},
      "Market Regime": "${timeframes['30m'].marketRegime}",
      "RSI (14)": ${timeframes['30m'].indicators.rsi.toFixed(1)},
      "RSI Trend": "${timeframes['30m'].indicators.rsiTrend}",
      "MACD": ${timeframes['30m'].indicators.macd.macd.toFixed(2)},
      "MACD Signal": ${timeframes['30m'].indicators.macd.signal.toFixed(2)},
      "MACD Histogram": ${timeframes['30m'].indicators.macd.histogram.toFixed(2)},
      "MACD Trend": "${timeframes['30m'].indicators.macd.trend}",
      "Bollinger Bands Upper": ${timeframes['30m'].indicators.bollinger.upper.toFixed(5)},
      "Bollinger Bands Middle": ${timeframes['30m'].indicators.bollinger.middle.toFixed(5)},
      "Bollinger Bands Lower": ${timeframes['30m'].indicators.bollinger.lower.toFixed(5)},
      "Bollinger Bands State": "${timeframes['30m'].indicators.bollinger.trend}",
      "EMA 20": ${timeframes['30m'].indicators.ema20.toFixed(5)},
      "EMA 50": ${timeframes['30m'].indicators.ema50.toFixed(5)},
      "EMA Trend": "${timeframes['30m'].indicators.emaTrend}",
      "Support Levels": [${timeframes['30m'].indicators.support.map(s => s.toFixed(5)).join(', ')}],
      "Resistance Levels": [${timeframes['30m'].indicators.resistance.map(r => r.toFixed(5)).join(', ')}],
      "Fibonacci Retracement": {
        "Swing High (0%)": ${timeframes['30m'].indicators.fibonacci.retracement.level_0.toFixed(5)},
        "23.6%": ${timeframes['30m'].indicators.fibonacci.retracement.level_236.toFixed(5)},
        "38.2%": ${timeframes['30m'].indicators.fibonacci.retracement.level_382.toFixed(5)},
        "50%": ${timeframes['30m'].indicators.fibonacci.retracement.level_500.toFixed(5)},
        "61.8%": ${timeframes['30m'].indicators.fibonacci.retracement.level_618.toFixed(5)},
        "78.6%": ${timeframes['30m'].indicators.fibonacci.retracement.level_786.toFixed(5)},
        "Swing Low (100%)": ${timeframes['30m'].indicators.fibonacci.retracement.level_1000.toFixed(5)}
      },
      "Fibonacci Extension": {
        "127.2%": ${timeframes['30m'].indicators.fibonacci.extension.level_1272.toFixed(5)},
        "161.8%": ${timeframes['30m'].indicators.fibonacci.extension.level_1618.toFixed(5)},
        "261.8%": ${timeframes['30m'].indicators.fibonacci.extension.level_2618.toFixed(5)}
      },
      "Fibonacci Trend": "${timeframes['30m'].indicators.fibonacci.trend}",
      "Recent Candles (OHLCV)": [${timeframes['30m'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
    "15-MINUTE TIMEFRAME ANALYSIS": {
      "Current Price": ${timeframes['15m'].indicators.currentPrice.toFixed(5)},
      "Market Regime": "${timeframes['15m'].marketRegime}",
      "RSI (14)": ${timeframes['15m'].indicators.rsi.toFixed(1)},
      "RSI Trend": "${timeframes['15m'].indicators.rsiTrend}",
      "MACD": ${timeframes['15m'].indicators.macd.macd.toFixed(2)},
      "MACD Signal": ${timeframes['15m'].indicators.macd.signal.toFixed(2)},
      "MACD Histogram": ${timeframes['15m'].indicators.macd.histogram.toFixed(2)},
      "MACD Trend": "${timeframes['15m'].indicators.macd.trend}",
      "Bollinger Bands Upper": ${timeframes['15m'].indicators.bollinger.upper.toFixed(5)},
      "Bollinger Bands Middle": ${timeframes['15m'].indicators.bollinger.middle.toFixed(5)},
      "Bollinger Bands Lower": ${timeframes['15m'].indicators.bollinger.lower.toFixed(5)},
      "Bollinger Bands State": "${timeframes['15m'].indicators.bollinger.trend}",
      "EMA 20": ${timeframes['15m'].indicators.ema20.toFixed(5)},
      "EMA 50": ${timeframes['15m'].indicators.ema50.toFixed(5)},
      "EMA Trend": "${timeframes['15m'].indicators.emaTrend}",
      "Support Levels": [${timeframes['15m'].indicators.support.map(s => s.toFixed(5)).join(', ')}],
      "Resistance Levels": [${timeframes['15m'].indicators.resistance.map(r => r.toFixed(5)).join(', ')}],
      "Fibonacci Retracement": {
        "Swing High (0%)": ${timeframes['15m'].indicators.fibonacci.retracement.level_0.toFixed(5)},
        "23.6%": ${timeframes['15m'].indicators.fibonacci.retracement.level_236.toFixed(5)},
        "38.2%": ${timeframes['15m'].indicators.fibonacci.retracement.level_382.toFixed(5)},
        "50%": ${timeframes['15m'].indicators.fibonacci.retracement.level_500.toFixed(5)},
        "61.8%": ${timeframes['15m'].indicators.fibonacci.retracement.level_618.toFixed(5)},
        "78.6%": ${timeframes['15m'].indicators.fibonacci.retracement.level_786.toFixed(5)},
        "Swing Low (100%)": ${timeframes['15m'].indicators.fibonacci.retracement.level_1000.toFixed(5)}
      },
      "Fibonacci Extension": {
        "127.2%": ${timeframes['15m'].indicators.fibonacci.extension.level_1272.toFixed(5)},
        "161.8%": ${timeframes['15m'].indicators.fibonacci.extension.level_1618.toFixed(5)},
        "261.8%": ${timeframes['15m'].indicators.fibonacci.extension.level_2618.toFixed(5)}
      },
      "Fibonacci Trend": "${timeframes['15m'].indicators.fibonacci.trend}",
      "Recent Candles (OHLCV)": [${timeframes['15m'].price.recentOHLCV.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(5)}, "H": ${c.high.toFixed(5)}, "L": ${c.low.toFixed(5)}, "C": ${c.close.toFixed(5)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}]
    },
    "BITCOIN CONTEXT": {
      "BTCUSDT Price": ${btcContext.price.toFixed(2)},
      "BTC Dominance": ${btcContext.dominance.toFixed(1)},
      "BTC 24h Volume": ${btcContext.volume24h.toFixed(0)},
      "BTC Recent Candles 1h (OHLCV)": [${btcContext.recentCandles1h.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(2)}, "H": ${c.high.toFixed(2)}, "L": ${c.low.toFixed(2)}, "C": ${c.close.toFixed(2)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}],
      "BTC Recent Candles 4h (OHLCV)": [${btcContext.recentCandles4h.slice(-3).map(c => 
        `{"O": ${c.open.toFixed(2)}, "H": ${c.high.toFixed(2)}, "L": ${c.low.toFixed(2)}, "C": ${c.close.toFixed(2)}, "V": ${c.volume.toFixed(0)}}`
      ).join(', ')}],
      "BTC Data Timestamp": "${btcContext.dataTimestamp}"
    },
      "Funding Rate": ${market.fundingRate.toFixed(3)}
    }
}

## FinCoT-TA SYSTEMATIC ANALYSIS PROCESS

### STEP 1: MACRO TREND & MARKET REGIME CLASSIFICATION
**Objective**: Establish the dominant market structure using the Daily and 4h timeframes.

**Analysis Process:**
1. **Daily Regime Identification**: Classify using EMA alignment, MACD position, RSI range, and Bollinger Band state
2. **4-Hour Regime Confirmation**: Verify alignment or identify conflicts with the Daily regime
3. **Regime Consistency Score**: Award 25 points if Daily and 4h regimes align, 0 if conflicting

### STEP 2: MULTI-TIMEFRAME SIGNAL ALIGNMENT
**Objective**: Analyze technical signals across all timeframes. (Primary Score: 25 points)

**Analysis Process:**
1. **Trend Alignment**: Compare EMA trends, MACD directions, and RSI trends across Daily, 4h, and 1h timeframes. A trade is only valid if a clear bias (bullish/bearish) is present and confirmed by the higher timeframes.
2. **Volume Confirmation**: Apply Volume Analysis Framework to recent price action.
3. **Market Regime Consistency**: Verify all timeframes support the same directional bias.

### STEP 3: HIGH-PRECISION SIGNAL ANALYSIS (15m/30m)
**Objective**: Use the lowest timeframes to pinpoint a precise entry. (Tertiary Score: 10 points)

**Analysis Process:**
1. **Fibonacci Confluence**: Identify current price position relative to key Fib levels. Look for confluence where a low-timeframe Fib level aligns with a higher-timeframe support/resistance zone.
2. **Support/Resistance Reaction**: Analyze recent price behavior at identified S/R levels.
3. **Candlestick Patterns**: Analyze recent patterns for high-probability setups at key technical levels.

### STEP 4: SIGNAL CONFLUENCE SCORING
**Objective**: Calculate total confluence score and determine trade viability.

**Scoring Process:**
1. **Sum All Signal Scores**: Add primary (25pts), secondary (15pts), and tertiary (10pts) signals from all timeframes
2. **Apply Confidence Mapping**: Use scoring thresholds to determine confidence level
3. **Validate Minimum Threshold**: Require ≥70 points for any trade consideration

### STEP 5: RISK-REWARD ASSESSMENT
**Objective**: Apply Risk Management Matrix for position sizing and stop placement.

**Risk Assessment Process:**
1. **Entry Point Selection**: Use the highest confluence technical level identified on the 15m/30m chart
2. **Stop Loss Placement**: Apply Stop Loss Placement Hierarchy
3. **Target Selection**: Use Target Selection Framework based on confidence level
4. **Risk-Reward Calculation**: Ensure minimum 2:1 ratio for trade validity

### STEP 6: STRUCTURED DECISION OUTPUT
**Objective**: Generate systematic trade recommendation using FinCoT-TA conclusions.

**Decision Logic:**
- **IF** Total Score ≥85: High confidence trade (85-95% confidence)
- **ELSE IF** Total Score 70-84: Medium confidence trade (75-84% confidence)  
- **ELSE IF** Total Score <70: No trade due to insufficient confluence
- **AND** Risk-Reward must be ≥2:1 for any trade recommendation

## REQUIRED OUTPUT FORMAT

Respond with ONLY a valid JSON object in this exact format:

\`\`\`json
{
  "direction": "long" | "short" | "no_trade_due_to_conflict",
  "entry": 111500.50,
  "stopLoss": 110000.25,
  "targetPrice": 115000.75,
  "riskReward": 2.5,
  "confidence": 85,
  "confluenceScore": 87,
  "technicalReasoning": [
    "FinCoT-TA Step 1: Macro trend analysis shows [specific finding]",
    "FinCoT-TA Step 2: Multi-timeframe alignment indicates [specific finding]",
    "FinCoT-TA Step 2.5: Bitcoin correlation analysis shows [BTC influence assessment]",
    "FinCoT-TA Step 3: High-precision analysis pinpoints entry at [specific level]",
    "FinCoT-TA Step 4: Signal confluence score of [X] points confirms [direction]",
    "FinCoT-TA Step 5: Risk-reward ratio of [X]:1 meets minimum threshold",
    "FinCoT-TA Step 6: Volume analysis shows [specific confirmation]",
    "Key confluence: Price at [specific Fibonacci/S&R level] with [supporting factors]"
  ],
  "timeframe": "6-24 hours",
  "riskLevel": "medium",
  "marketRegime1d": "trending_bullish",
  "marketRegime4h": "trending_bullish",
  "marketRegime1h": "ranging_volatile",
  "volumeConfirmation": "above_average"
}
\`\`\`

**Critical Requirements:**
- All prices must be realistic numbers with appropriate precision
- Confidence must be 75-95 for valid trades, or 0 for no_trade_due_to_conflict
- ConfluenceScore must reflect actual signal scoring calculation
- TechnicalReasoning must contain 5-8 items, explicitly focusing on market regime alignment, multi-timeframe analysis, Fibonacci confluences, trend alignment, momentum, and volume confirmation, ordered by their impact on the decision
- Risk-reward ratio must be ≥2:1 for any trade recommendation
- If no trade, set entry/stopLoss/targetPrice to 0.0 and confidence to 0`;
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
        targetPrice: 0,
        stopLoss: 0,
        riskReward: 0,
        confidence: 0,
        technicalReasoning: tradeData.technicalReasoning 
          ? tradeData.technicalReasoning.map(reason => 
              reason.length > 150 ? reason.substring(0, 150) + '...' : reason
            ).slice(0, 4) // Limit to 4 reasons max
          : ['No high-probability setup identified due to conflicting signals'],
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
    
    // Calculate target price if not provided or invalid
    let targetPrice = 0;
    const entry = Math.max(0, parseFloat(tradeData.entry) || marketData.timeframes['1h'].indicators.currentPrice);
    const stopLoss = Math.max(0, parseFloat(tradeData.stopLoss) || marketData.timeframes['1h'].indicators.currentPrice * 0.95);
    let riskReward = Math.max(0, Math.round((tradeData.riskReward || 0) * 10) / 10);
    
    // Always use the targetPrice from Gemini if provided, otherwise calculate it
    if (tradeData.targetPrice && parseFloat(tradeData.targetPrice) > 0) {
      targetPrice = parseFloat(tradeData.targetPrice);
      // Use Gemini's risk/reward ratio directly if we have the target price from Gemini
      if (tradeData.riskReward && parseFloat(tradeData.riskReward) > 0) {
        riskReward = parseFloat(tradeData.riskReward);
      }
    } else if (entry > 0 && stopLoss > 0 && riskReward > 0) {
      // Calculate target price based on risk/reward ratio
      if (tradeData.direction === 'long') {
        // For long: target = entry + (entry - stopLoss) * riskReward
        const riskAmount = entry - stopLoss;
        targetPrice = entry + (riskAmount * riskReward);
      } else {
        // For short: target = entry - (stopLoss - entry) * riskReward
        const riskAmount = stopLoss - entry;
        targetPrice = entry - (riskAmount * riskReward);
      }
    } else {
      // Fallback: use a reasonable target based on direction
      if (tradeData.direction === 'long') {
        targetPrice = entry * 1.05; // 5% above entry
      } else {
        targetPrice = entry * 0.95; // 5% below entry
      }
    }
    
    // Only recalculate risk/reward if we don't have it from Gemini or if we calculated the target price
    if ((!tradeData.riskReward || parseFloat(tradeData.riskReward) <= 0) && entry > 0 && stopLoss > 0 && targetPrice > 0) {
      // Recalculate only if Gemini didn't provide a valid risk/reward ratio
      const riskAmount = Math.abs(entry - stopLoss);
      const rewardAmount = Math.abs(targetPrice - entry);
      if (riskAmount > 0 && rewardAmount > 0) {
        riskReward = Math.round((rewardAmount / riskAmount) * 10) / 10;
      }
    }
    
    // Validate and sanitize the trade idea
    const tradeIdea: DerivativesTradeIdea = {
      direction: ['long', 'short'].includes(tradeData.direction) ? tradeData.direction : 'long',
      entry: entry,
      stopLoss: stopLoss,
      targetPrice: targetPrice,
      riskReward: riskReward,
      confidence: confidence,
      technicalReasoning: Array.isArray(tradeData.technicalReasoning) ? 
        tradeData.technicalReasoning.slice(0, 6) : 
        ['Multi-timeframe technical analysis completed based on current market conditions'],
      symbol: marketData.symbol,
      timeframe: tradeData.timeframe || '6-24 hours'
    };
    
    log('INFO', `Parsed derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol} at $${tradeIdea.entry.toFixed(5)}, Target: $${tradeIdea.targetPrice.toFixed(5)}, R/R: ${tradeIdea.riskReward}:1 (Confidence: ${tradeIdea.confidence}%)`);
    logFunctionExit('parseDerivativesTradeResponse', tradeIdea);
    return tradeIdea;
    
  } catch (error) {
    log('ERROR', 'Error parsing derivatives trade response', error.message);
    log('ERROR', 'Raw response (first 500 chars):', text.substring(0, 500) + '...');
    logFunctionExit('parseDerivativesTradeResponse', null);
    return null;
  }
}