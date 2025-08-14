import { GoogleGenerativeAI } from '@google/generative-ai';
import { CryptoData, NewsItem, MarketConditions, TradingRecommendation } from '../src/types/trading.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    
    // Parse the JSON
    const recommendations: TradingRecommendation[] = JSON.parse(jsonText);
    
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
    console.log('📄 Raw response:', text.substring(0, 500) + '...');
    return [];
  }
}