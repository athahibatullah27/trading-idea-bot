import { CryptoData, NewsItem, TradingRecommendation, MarketConditions, GeopoliticalFactor } from '../types/trading';

export const mockCryptoData: CryptoData[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67450.32,
    change24h: 2.45,
    volume: 28500000000,
    marketCap: 1330000000000,
    rsi: 58.7,
    macd: 1250.5,
    bollinger: {
      upper: 69500,
      middle: 67450,
      lower: 65400
    }
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3842.18,
    change24h: -1.23,
    volume: 15200000000,
    marketCap: 462000000000,
    rsi: 45.2,
    macd: -85.3,
    bollinger: {
      upper: 3950,
      middle: 3842,
      lower: 3734
    }
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    price: 198.45,
    change24h: 5.67,
    volume: 3400000000,
    marketCap: 93000000000,
    rsi: 72.3,
    macd: 12.8,
    bollinger: {
      upper: 205,
      middle: 198,
      lower: 191
    }
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    price: 1.08,
    change24h: -0.85,
    volume: 1200000000,
    marketCap: 38000000000,
    rsi: 38.9,
    macd: -0.02,
    bollinger: {
      upper: 1.12,
      middle: 1.08,
      lower: 1.04
    }
  }
];

export const mockNews: NewsItem[] = [
  {
    title: "BlackRock Bitcoin ETF sees record $2.1B inflow",
    sentiment: 'bullish',
    source: 'CoinDesk',
    timestamp: '2 hours ago',
    impact: 'high'
  },
  {
    title: "Federal Reserve hints at potential rate cuts in Q2 2025",
    sentiment: 'bullish',
    source: 'Reuters',
    timestamp: '4 hours ago',
    impact: 'medium'
  },
  {
    title: "Ethereum network congestion causes gas fees to spike",
    sentiment: 'bearish',
    source: 'CryptoSlate',
    timestamp: '6 hours ago',
    impact: 'medium'
  },
  {
    title: "Major crypto exchange reports security breach",
    sentiment: 'bearish',
    source: 'BlockBeats',
    timestamp: '8 hours ago',
    impact: 'high'
  },
  {
    title: "Solana ecosystem grows with new DeFi protocols",
    sentiment: 'bullish',
    source: 'The Block',
    timestamp: '12 hours ago',
    impact: 'medium'
  }
];

export const mockRecommendations: TradingRecommendation[] = [
  {
    crypto: 'BTC',
    action: 'buy',
    confidence: 78,
    targetPrice: 72000,
    stopLoss: 65000,
    reasoning: [
      'Strong institutional inflows from ETFs',
      'RSI indicates room for upward movement',
      'Breaking above key resistance level',
      'Positive macroeconomic factors'
    ],
    timeframe: '2-4 weeks',
    riskLevel: 'medium'
  },
  {
    crypto: 'SOL',
    action: 'buy',
    confidence: 85,
    targetPrice: 220,
    stopLoss: 180,
    reasoning: [
      'Ecosystem expansion and new partnerships',
      'Strong technical momentum',
      'Overbought RSI suggests caution but trend is strong',
      'High trading volume confirms interest'
    ],
    timeframe: '1-3 weeks',
    riskLevel: 'high'
  },
  {
    crypto: 'ETH',
    action: 'hold',
    confidence: 62,
    targetPrice: 4200,
    stopLoss: 3600,
    reasoning: [
      'Network congestion concerns',
      'Mixed technical signals',
      'Awaiting major protocol updates',
      'Strong long-term fundamentals'
    ],
    timeframe: '4-8 weeks',
    riskLevel: 'medium'
  }
];

export const mockMarketConditions: MarketConditions = {
  overall: 'bullish',
  volatility: 'medium',
  fearGreedIndex: 68,
  dominance: {
    btc: 54.2,
    eth: 17.8
  }
};

export const mockGeopoliticalFactors: GeopoliticalFactor[] = [
  {
    event: 'US Election Uncertainty',
    impact: 'neutral',
    severity: 6,
    affectedRegions: ['North America', 'Global Markets']
  },
  {
    event: 'China Economic Stimulus',
    impact: 'positive',
    severity: 7,
    affectedRegions: ['Asia Pacific', 'Global Markets']
  },
  {
    event: 'EU Crypto Regulation Updates',
    impact: 'positive',
    severity: 5,
    affectedRegions: ['Europe']
  }
];