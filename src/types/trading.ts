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