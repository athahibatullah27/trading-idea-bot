// Bot-specific types for the Discord bot
// This file contains types that are only used by the bot

export interface TradingRecommendation {
  id?: string;
  crypto: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string[];
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
  status?: 'pending' | 'accurate' | 'inaccurate' | 'expired';
  entryPrice?: number;
  evaluationTimestamp?: string;
  createdAt?: string;
}

export interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  rsi: number;
  macd: number;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface NewsItem {
  title: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  source: string;
  fibonacci: {
    retracement: {
      level_0: number;      // 0% (swing high)
      level_236: number;    // 23.6%
      level_382: number;    // 38.2%
      level_500: number;    // 50%
      level_618: number;    // 61.8%
      level_786: number;    // 78.6%
      level_1000: number;   // 100% (swing low)
    };
    extension: {
      level_1272: number;   // 127.2%
      level_1618: number;   // 161.8%
      level_2618: number;   // 261.8%
    };
    swingHigh: number;
    swingLow: number;
    trend: 'bullish_retracement' | 'bearish_retracement' | 'extension_phase' | 'no_clear_swing';
  };
  timestamp: string;
  impact: 'high' | 'medium' | 'low';
}

export interface MarketConditions {
  overall: 'bullish' | 'bearish' | 'neutral';
  marketRegime: 'trending_bullish' | 'trending_bearish' | 'ranging_volatile' | 'ranging_quiet' | 'consolidation' | 'breakout_pending';
  volatility: 'low' | 'medium' | 'high';
  fearGreedIndex: number;
  dominance: {
    btc: number;
    eth: number;
  };
}