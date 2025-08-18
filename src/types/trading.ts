// Core types for trade recommendation evaluation system

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