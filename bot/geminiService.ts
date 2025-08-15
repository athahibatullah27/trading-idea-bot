import { GoogleGenerativeAI } from '@google/generative-ai';
import { CryptoData, NewsItem, MarketConditions, TradingRecommendation } from '../src/types/trading.js';
import { EnhancedDerivativesMarketData } from './derivativesDataService.js';
import dotenv from 'dotenv';

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
  try {
    console.log('🤖 Generating AI recommendations using Gemini...');
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      return [];
    }

    if (cryptoData.length === 0) {
      console.error('❌ No crypto data provided for Gemini analysis');
      return [];
    }

    // Construct the prompt for Gemini
    const prompt = buildGeminiPrompt(cryptoData, news, marketConditions);
    
    console.log('📝 Sending prompt to Gemini API...');
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Received response from Gemini API');
    
    // Parse the JSON response
    const recommendations = parseGeminiResponse(text, cryptoData);
    
    if (recommendations.length === 0) {
      console.error('❌ Failed to parse valid recommendations from Gemini');
      return [];
    }
    
    console.log(`🎯 Generated ${recommendations.length} AI recommendations`);
    return recommendations;
    
  } catch (error) {
    console.error('❌ Error generating Gemini recommendations:', error.message);
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
    
    console.log('🔍 Cleaned JSON for parsing:', jsonText.substring(0, 200) + '...');
    
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
    
    console.log(`✅ Parsed ${validRecommendations.length} valid recommendations from Gemini`);
    return validRecommendations;
    
  } catch (error) {
    console.error('❌ Error parsing Gemini response:', error.message);
    console.log('📄 Raw response (first 500 chars):', text.substring(0, 500) + '...');
    console.log('📄 Raw response (last 500 chars):', '...' + text.substring(Math.max(0, text.length - 500)));
    
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
          console.log('🔄 Attempting to parse partial JSON...');
          const partialRecommendations = JSON.parse(partialJson);
          
          if (Array.isArray(partialRecommendations) && partialRecommendations.length > 0) {
            console.log('✅ Successfully parsed partial JSON with', partialRecommendations.length, 'recommendations');
            
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
              return validRecommendations;
            }
          }
        }
      }
    } catch (partialError) {
      console.log('❌ Partial JSON parsing also failed:', partialError.message);
    }
    
    return [];
  }
}

export async function generateDerivativesTradeIdea(
  marketData: EnhancedDerivativesMarketData
): Promise<DerivativesTradeIdea | null> {
  try {
    console.log(`🤖 Generating derivatives trade idea for ${marketData.symbol} using Gemini...`);
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      return null;
    }

    // Construct the prompt for derivatives trade analysis
    const prompt = buildEnhancedDerivativesTradePrompt(marketData);
    
    console.log('📝 Sending derivatives trade prompt to Gemini API...');
    
    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Received derivatives trade response from Gemini API');
    
    // Parse the JSON response
    const tradeIdea = parseDerivativesTradeResponse(text, marketData);
    
    if (!tradeIdea) {
      console.error('❌ Failed to parse valid trade idea from Gemini');
      return null;
    }
    
    console.log(`🎯 Generated derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol}`);
    return tradeIdea;
    
  } catch (error) {
    console.error('❌ Error generating derivatives trade idea:', error.message);
    return null;
  }
}

function buildEnhancedDerivativesTradePrompt(marketData: EnhancedDerivativesMarketData): string {
  const { symbol, timeframes, market } = marketData;
  
  return `You are an expert derivatives trader specializing in multi-timeframe technical analysis. Based on the following comprehensive technical data for ${symbol}, provide a high-confidence trade idea using ONLY technical analysis.

MULTI-TIMEFRAME TECHNICAL DATA FOR ${symbol}:
Data Timestamp: ${marketData.dataTimestamp}

4-HOUR TIMEFRAME ANALYSIS:
- Current Price: $${timeframes['4h'].indicators.currentPrice.toLocaleString()}
- RSI (14): ${timeframes['4h'].indicators.rsi.toFixed(1)} (${timeframes['4h'].indicators.rsiTrend})
- MACD: ${timeframes['4h'].indicators.macd.macd.toFixed(2)} (Signal: ${timeframes['4h'].indicators.macd.signal.toFixed(2)}, Histogram: ${timeframes['4h'].indicators.macd.histogram.toFixed(2)}, Trend: ${timeframes['4h'].indicators.macd.trend})
- Bollinger Bands: Upper $${timeframes['4h'].indicators.bollinger.upper.toLocaleString()}, Middle $${timeframes['4h'].indicators.bollinger.middle.toLocaleString()}, Lower $${timeframes['4h'].indicators.bollinger.lower.toLocaleString()} (${timeframes['4h'].indicators.bollinger.trend})
- EMA 20: $${timeframes['4h'].indicators.ema20.toLocaleString()}
- EMA 50: $${timeframes['4h'].indicators.ema50.toLocaleString()}
- EMA Trend: ${timeframes['4h'].indicators.emaTrend}
- Support Levels: [${timeframes['4h'].indicators.support.map(s => '$' + s.toLocaleString()).join(', ')}]
- Resistance Levels: [${timeframes['4h'].indicators.resistance.map(r => '$' + r.toLocaleString()).join(', ')}]
- Recent Candles (OHLCV): ${timeframes['4h'].price.recentOHLCV.slice(-3).map(c => 
    `[O:$${c.open.toLocaleString()}, H:$${c.high.toLocaleString()}, L:$${c.low.toLocaleString()}, C:$${c.close.toLocaleString()}, V:${c.volume.toFixed(0)}]`
  ).join(', ')}

1-HOUR TIMEFRAME ANALYSIS:
- Current Price: $${timeframes['1h'].indicators.currentPrice.toLocaleString()}
- RSI (14): ${timeframes['1h'].indicators.rsi.toFixed(1)} (${timeframes['1h'].indicators.rsiTrend})
- MACD: ${timeframes['1h'].indicators.macd.macd.toFixed(2)} (Signal: ${timeframes['1h'].indicators.macd.signal.toFixed(2)}, Histogram: ${timeframes['1h'].indicators.macd.histogram.toFixed(2)}, Trend: ${timeframes['1h'].indicators.macd.trend})
- Bollinger Bands: Upper $${timeframes['1h'].indicators.bollinger.upper.toLocaleString()}, Middle $${timeframes['1h'].indicators.bollinger.middle.toLocaleString()}, Lower $${timeframes['1h'].indicators.bollinger.lower.toLocaleString()} (${timeframes['1h'].indicators.bollinger.trend})
- EMA 20: $${timeframes['1h'].indicators.ema20.toLocaleString()}
- EMA 50: $${timeframes['1h'].indicators.ema50.toLocaleString()}
- EMA Trend: ${timeframes['1h'].indicators.emaTrend}
- Support Levels: [${timeframes['1h'].indicators.support.map(s => '$' + s.toLocaleString()).join(', ')}]
- Resistance Levels: [${timeframes['1h'].indicators.resistance.map(r => '$' + r.toLocaleString()).join(', ')}]
- Recent Candles (OHLCV): ${timeframes['1h'].price.recentOHLCV.slice(-3).map(c => 
    `[O:$${c.open.toLocaleString()}, H:$${c.high.toLocaleString()}, L:$${c.low.toLocaleString()}, C:$${c.close.toLocaleString()}, V:${c.volume.toFixed(0)}]`
  ).join(', ')}

MARKET CONDITIONS:
- 24h Volume: ${market.volume24h.toFixed(0)}
- Volume Trend: ${market.volumeTrend}
- Average Volume: ${market.averageVolume.toFixed(0)}
- Funding Rate: ${(market.fundingRate * 100).toFixed(3)}%

INSTRUCTIONS:
1. Perform MULTI-TIMEFRAME ANALYSIS: Compare 4h and 1h timeframes for trend alignment
2. Analyze indicator TRENDS (rising/falling/flat) not just current values
3. Consider recent CANDLESTICK PATTERNS from the OHLCV data
4. Use VOLUME ANALYSIS to confirm price movements
5. Identify the STRONGEST technical setup with highest probability
6. Set entry price based on current market structure and recent price action
7. Use MULTIPLE support/resistance levels for precise stop loss placement
8. Provide confidence level (75-95%) based on timeframe alignment and signal strength
9. Give 5-6 specific technical reasons focusing on trend alignment and momentum

IMPORTANT:
- HIGHER CONFIDENCE when 4h and 1h timeframes align (same direction)
- LOWER CONFIDENCE when timeframes conflict or indicators are mixed
- Use TREND analysis (rising/falling RSI, MACD trend, Bollinger expansion/contraction)
- Consider VOLUME CONFIRMATION (above average volume = higher confidence)
- Focus on RECENT PRICE ACTION from candlestick data
- Ensure risk-reward ratio is at least 2:1 for high-confidence trades

Respond ONLY with a valid JSON object in this exact format:
{
  "direction": "long",
  "entry": 119000,
  "stopLoss": 117500,
  "riskReward": 3.0,
  "confidence": 85,
  "technicalReasoning": [
    "4h and 1h RSI both showing rising trend, indicating strengthening momentum",
    "4h MACD histogram trend rising while 1h MACD confirms bullish crossover",
    "Price action showing higher lows pattern in recent 1h candles",
    "Volume significantly above average confirming institutional interest",
    "4h EMA trend bullish with price above both EMAs, 1h alignment confirms",
    "Multiple support levels provide strong risk management at current entry"
  ],
  "timeframe": "6-24 hours"
}

Ensure all prices are realistic numbers without commas, direction is "long" or "short", confidence is 75-95 for high-quality setups, riskReward is a decimal (e.g., 3.0), and technicalReasoning has 5-6 items focusing on multi-timeframe analysis.`;
}

function parseDerivativesTradeResponse(text: string, marketData: EnhancedDerivativesMarketData): DerivativesTradeIdea | null {
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
    
    console.log('🔍 Cleaned JSON for parsing:', jsonText.substring(0, 200) + '...');
    
    // Parse the JSON
    const tradeData = JSON.parse(jsonText);
    
    // Validate and sanitize the trade idea
    const tradeIdea: DerivativesTradeIdea = {
      direction: ['long', 'short'].includes(tradeData.direction) ? tradeData.direction : 'long',
      entry: Math.max(0, Math.round(tradeData.entry || marketData.timeframes['1h'].indicators.currentPrice)),
      stopLoss: Math.max(0, Math.round(tradeData.stopLoss || marketData.timeframes['1h'].indicators.currentPrice * 0.95)),
      riskReward: Math.max(1, Math.round((tradeData.riskReward || 2) * 10) / 10),
      confidence: Math.max(75, Math.min(95, Math.round(tradeData.confidence || 80))),
      technicalReasoning: Array.isArray(tradeData.technicalReasoning) ? 
        tradeData.technicalReasoning.slice(0, 6) : 
        ['Multi-timeframe technical analysis completed based on current market conditions'],
      symbol: marketData.symbol,
      timeframe: tradeData.timeframe || '6-24 hours'
    };
    
    console.log(`✅ Parsed derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol} at $${tradeIdea.entry}`);
    return tradeIdea;
    
  } catch (error) {
    console.error('❌ Error parsing derivatives trade response:', error.message);
    console.log('📄 Raw response (first 500 chars):', text.substring(0, 500) + '...');
    return null;
  }
}