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

export interface FibonacciLevels {
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
}

export interface NewsItem {
  title: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  source: string;
  timestamp: string;
  impact: 'high' | 'medium' | 'low';
}

export interface MarketConditions {
  overall: 'bullish' | 'bearish' | 'neutral';
  volatility: 'low' | 'medium' | 'high';
  fearGreedIndex: number;
  dominance: {
    btc: number;
    eth: number;
  };
}

export interface TechnicalIndicators {
  rsi: number;
  rsiTrend: 'rising' | 'falling' | 'flat';
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'rising' | 'falling' | 'flat';
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    trend: 'expanding' | 'contracting' | 'flat';
  };
  ema20: number;
  ema50: number;
  emaTrend: 'bullish' | 'bearish' | 'neutral';
  support: number[];
  resistance: number[];
  fibonacci: FibonacciLevels;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  volumeTrend: 'significantly above average' | 'above average' | 'average' | 'below average';
  averageVolume: number;
}

export interface TimeframeData {
  timeframe: string;
  marketRegime: 'trending_bullish' | 'trending_bearish' | 'ranging_volatile' | 'ranging_quiet' | 'consolidation' | 'breakout_pending';
  price: {
    currentPrice: number;
    recentOHLCV: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      timestamp: number;
    }>;
  };
  indicators: TechnicalIndicators;
}

export interface EnhancedDerivativesMarketData {
  symbol: string;
  dataTimestamp: string;
  timeframes: {
    '4h': TimeframeData;
    '1h': TimeframeData;
  };
  market: {
    fundingRate: number;
    volume24h: number;
    volumeTrend: string;
    averageVolume: number;
  };
}