import { GoogleGenerativeAI } from '@google/generative-ai';
import { CryptoData, NewsItem, MarketConditions, TradingRecommendation } from '../src/types/trading.js';
import { DerivativesMarketData } from './derivativesDataService.js';
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
  marketData: DerivativesMarketData
): Promise<DerivativesTradeIdea | null> {
  try {
    console.log(`🤖 Generating derivatives trade idea for ${marketData.symbol} using Gemini...`);
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      return null;
    }

    // Construct the prompt for derivatives trade analysis
    const prompt = buildDerivativesTradePrompt(marketData);
    
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

function buildDerivativesTradePrompt(marketData: DerivativesMarketData): string {
  const { symbol, technicalIndicators, marketInfo } = marketData;
  
  return `You are an expert derivatives trader specializing in technical analysis. Based on the following technical data for ${symbol}, provide a trade idea using ONLY technical analysis.

TECHNICAL DATA FOR ${symbol}:
- Current Price: $${technicalIndicators.currentPrice.toLocaleString()}
- 24h Price Change: ${technicalIndicators.priceChange24h.toFixed(2)}%
- RSI (14): ${technicalIndicators.rsi.toFixed(1)}
- MACD: ${technicalIndicators.macd.macd.toFixed(2)} (Signal: ${technicalIndicators.macd.signal.toFixed(2)}, Histogram: ${technicalIndicators.macd.histogram.toFixed(2)})
- Bollinger Bands: Upper $${technicalIndicators.bollinger.upper.toLocaleString()}, Middle $${technicalIndicators.bollinger.middle.toLocaleString()}, Lower $${technicalIndicators.bollinger.lower.toLocaleString()}
- EMA 20: $${technicalIndicators.ema20.toLocaleString()}
- EMA 50: $${technicalIndicators.ema50.toLocaleString()}
- Support Level: $${technicalIndicators.support.toLocaleString()}
- Resistance Level: $${technicalIndicators.resistance.toLocaleString()}
- 24h Volume: ${technicalIndicators.volume24h.toFixed(0)}
- Funding Rate: ${(marketInfo.fundingRate || 0) * 100}%
- Mark Price: $${(marketInfo.markPrice || technicalIndicators.currentPrice).toLocaleString()}

INSTRUCTIONS:
1. Analyze ONLY the technical indicators provided above
2. Determine if this is a LONG or SHORT opportunity
3. Set appropriate entry price based on current market structure
4. Calculate stop loss using technical levels (support/resistance, Bollinger Bands, etc.)
5. Determine risk-reward ratio (target profit / stop loss risk)
6. Provide confidence level (0-100%) based on technical signal strength
7. Give 4-5 specific technical reasons for the trade

IMPORTANT: 
- Base your analysis ONLY on technical indicators, price action, and chart patterns
- Do NOT consider fundamental analysis, news, or market sentiment
- Focus on derivatives trading principles (leverage, funding rates, etc.)
- Ensure risk-reward ratio is at least 1.5:1

Respond ONLY with a valid JSON object in this exact format:
{
  "direction": "long",
  "entry": 118500,
  "stopLoss": 117000,
  "riskReward": 2.5,
  "confidence": 75,
  "technicalReasoning": [
    "RSI showing oversold conditions at 28, indicating potential reversal",
    "Price bouncing off lower Bollinger Band support",
    "MACD histogram showing bullish divergence",
    "EMA 20 acting as dynamic support level",
    "Volume spike confirms buying interest at current levels"
  ],
  "timeframe": "4-12 hours"
}

Ensure all prices are realistic numbers without commas, direction is "long" or "short", confidence is 0-100, riskReward is a decimal (e.g., 2.5), and technicalReasoning has 4-5 items.`;
}

function parseDerivativesTradeResponse(text: string, marketData: DerivativesMarketData): DerivativesTradeIdea | null {
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
      entry: Math.max(0, Math.round(tradeData.entry || marketData.technicalIndicators.currentPrice)),
      stopLoss: Math.max(0, Math.round(tradeData.stopLoss || marketData.technicalIndicators.currentPrice * 0.95)),
      riskReward: Math.max(1, Math.round((tradeData.riskReward || 2) * 10) / 10),
      confidence: Math.max(0, Math.min(100, Math.round(tradeData.confidence || 50))),
      technicalReasoning: Array.isArray(tradeData.technicalReasoning) ? 
        tradeData.technicalReasoning.slice(0, 5) : 
        ['Technical analysis completed based on current market conditions'],
      symbol: marketData.symbol,
      timeframe: tradeData.timeframe || '4-12 hours'
    };
    
    console.log(`✅ Parsed derivatives trade idea: ${tradeIdea.direction.toUpperCase()} ${tradeIdea.symbol} at $${tradeIdea.entry}`);
    return tradeIdea;
    
  } catch (error) {
    console.error('❌ Error parsing derivatives trade response:', error.message);
    console.log('📄 Raw response (first 500 chars):', text.substring(0, 500) + '...');
    return null;
  }
}