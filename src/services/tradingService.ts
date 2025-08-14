import { CryptoData, NewsItem, TradingRecommendation, MarketConditions } from '../types/trading';
import { mockCryptoData, mockNews, mockRecommendations, mockMarketConditions } from '../data/mockData';

// API proxy base URL (your Discord bot's proxy server)
const API_PROXY_BASE = 'http://localhost:3001/api';

// Helper function to get real-time crypto data via proxy
export async function getRealTimeCryptoData(symbol: string): Promise<CryptoData | null> {
  try {
    console.log(`Fetching real-time data for ${symbol} via proxy...`);
    
    const response = await fetch(`${API_PROXY_BASE}/crypto-data?symbol=${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Successfully fetched real-time data for ${symbol} via proxy`);
    return data;

  } catch (error) {
    console.error(`❌ Error fetching real-time data for ${symbol}:`, error.message);
    
    // Fallback to mock data if proxy server is not available
    const mockData = mockCryptoData.find(crypto => crypto.symbol === symbol);
    if (mockData) {
      console.log(`📦 Using fallback mock data for ${symbol}`);
      return mockData;
    }
    
    return null;
  }
}

// Function to get multiple crypto data at once via proxy
export async function getMultipleCryptoData(symbols: string[]): Promise<CryptoData[]> {
  try {
    console.log(`🔄 Frontend: Fetching data for multiple cryptos via proxy: ${symbols.join(', ')}`);
    console.log(`🌐 Frontend: Attempting to connect to ${API_PROXY_BASE}/multiple-crypto-data`);
    
    const response = await fetch(`${API_PROXY_BASE}/multiple-crypto-data?symbols=${symbols.join(',')}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(15000) // 15 second timeout for multiple requests
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Frontend: Successfully fetched data for ${data.length}/${symbols.length} cryptos via proxy`);
    console.log(`📊 Frontend: Received data for:`, data.map(d => `${d.symbol}: $${d.price.toLocaleString()}`));
    return data;

  } catch (error) {
    console.error('❌ Frontend: Error fetching multiple crypto data via proxy:', error.message);
    console.error('🔍 Frontend: Error details:', {
      errorType: error.constructor.name,
      message: error.message,
      proxyUrl: `${API_PROXY_BASE}/multiple-crypto-data`,
      requestedSymbols: symbols
    });
    
    // Fallback to mock data if proxy server is not available
    const fallbackData = symbols.map(symbol => 
      mockCryptoData.find(crypto => crypto.symbol === symbol)
    ).filter(Boolean) as CryptoData[];
    
    if (fallbackData.length > 0) {
      console.log(`📦 Frontend: Using fallback mock data for ${fallbackData.length} cryptos`);
      console.log(`📊 Frontend: Mock data prices:`, fallbackData.map(d => `${d.symbol}: $${d.price.toLocaleString()}`));
      return fallbackData;
    }
    
    return [];
  }
}

// Function to test API connectivity via proxy
export async function testAPIConnection(): Promise<boolean> {
  try {
    console.log('🧪 Frontend: Testing API connection via proxy...');
    console.log(`🌐 Frontend: Testing connection to ${API_PROXY_BASE}/test-connection`);
    
    const response = await fetch(`${API_PROXY_BASE}/test-connection`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout for connection test
      signal: AbortSignal.timeout(5000) // 5 second timeout for connection test
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.connected) {
      console.log('✅ Frontend: API connection test successful via proxy');
      return true;
    }
    console.log('❌ Frontend: API connection test failed - backend reports not connected');
    return false;
  } catch (error) {
    console.log('❌ Frontend: API connection test failed via proxy:', error.message);
    console.error('🔍 Frontend: Connection test error details:', {
      errorType: error.constructor.name,
      message: error.message,
      proxyUrl: `${API_PROXY_BASE}/test-connection`
    });
    console.log('💡 Frontend: Make sure the Discord bot is running with: npm run bot');
    return false;
  }
}

// Function to get real-time news (mock for now, can be replaced with real news API)
export async function getRealTimeNews(): Promise<NewsItem[]> {
  // This would typically fetch from a real news API
  // For now, returning mock data with timestamps that reflect current time
  const now = new Date();
  const mockNews: NewsItem[] = [
    {
      title: "Bitcoin ETF sees record institutional inflows",
      sentiment: 'bullish',
      source: 'CoinDesk',
      timestamp: `${Math.floor((now.getTime() - Date.now() + 2 * 60 * 60 * 1000) / (60 * 60 * 1000))} hours ago`,
      impact: 'high'
    },
    {
      title: "Federal Reserve signals potential rate adjustments",
      sentiment: 'bullish',
      source: 'Reuters',
      timestamp: `${Math.floor((now.getTime() - Date.now() + 4 * 60 * 60 * 1000) / (60 * 60 * 1000))} hours ago`,
      impact: 'medium'
    },
    {
      title: "Ethereum network upgrade shows promising results",
      sentiment: 'bullish',
      source: 'CryptoSlate',
      timestamp: `${Math.floor((now.getTime() - Date.now() + 6 * 60 * 60 * 1000) / (60 * 60 * 1000))} hours ago`,
      impact: 'medium'
    },
    {
      title: "Major exchange reports security improvements",
      sentiment: 'neutral',
      source: 'BlockBeats',
      timestamp: `${Math.floor((now.getTime() - Date.now() + 8 * 60 * 60 * 1000) / (60 * 60 * 1000))} hours ago`,
      impact: 'low'
    },
    {
      title: "Solana ecosystem continues rapid expansion",
      sentiment: 'bullish',
      source: 'The Block',
      timestamp: `${Math.floor((now.getTime() - Date.now() + 12 * 60 * 60 * 1000) / (60 * 60 * 1000))} hours ago`,
      impact: 'medium'
    }
  ];

  return mockNews;
}

// Function to generate AI recommendations based on real data
export async function generateRecommendations(cryptoData: CryptoData[]): Promise<TradingRecommendation[]> {
  const recommendations: TradingRecommendation[] = [];

  for (const crypto of cryptoData.slice(0, 3)) {
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 50;
    let reasoning: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    // Simple AI logic based on technical indicators
    if (crypto.rsi < 30 && crypto.change24h > -5) {
      action = 'buy';
      confidence = 75 + Math.random() * 15;
      reasoning = [
        'RSI indicates oversold conditions',
        'Recent price decline may present buying opportunity',
        'Technical indicators suggest potential reversal',
        'Market sentiment showing signs of recovery'
      ];
      riskLevel = crypto.change24h < -10 ? 'high' : 'medium';
    } else if (crypto.rsi > 70 && crypto.change24h > 5) {
      action = 'sell';
      confidence = 70 + Math.random() * 20;
      reasoning = [
        'RSI indicates overbought conditions',
        'Strong recent gains suggest profit-taking opportunity',
        'Technical momentum may be slowing',
        'Risk management suggests securing profits'
      ];
      riskLevel = 'medium';
    } else if (crypto.change24h > 3 && crypto.rsi < 60) {
      action = 'buy';
      confidence = 65 + Math.random() * 20;
      reasoning = [
        'Positive price momentum with room for growth',
        'RSI levels suggest sustainable uptrend',
        'Market conditions favor continued growth',
        'Technical indicators align bullishly'
      ];
      riskLevel = crypto.change24h > 10 ? 'high' : 'medium';
    } else {
      reasoning = [
        'Mixed technical signals require patience',
        'Market consolidation phase detected',
        'Awaiting clearer directional signals',
        'Risk management favors current position'
      ];
      confidence = 55 + Math.random() * 15;
    }

    const targetPrice = action === 'buy' ? crypto.price * (1.05 + Math.random() * 0.1) :
                      action === 'sell' ? crypto.price * (0.9 + Math.random() * 0.05) :
                      crypto.price * (1.02 + Math.random() * 0.06);

    const stopLoss = action === 'buy' ? crypto.price * (0.92 - Math.random() * 0.05) :
                    action === 'sell' ? crypto.price * (1.08 + Math.random() * 0.05) :
                    crypto.price * (0.95 - Math.random() * 0.03);

    recommendations.push({
      crypto: crypto.symbol,
      action,
      confidence: Math.round(confidence),
      targetPrice: Math.round(targetPrice),
      stopLoss: Math.round(stopLoss),
      reasoning,
      timeframe: action === 'hold' ? '4-8 weeks' : '1-4 weeks',
      riskLevel
    });
  }

  return recommendations;
}

// Function to get current market conditions based on real data
export async function getMarketConditions(cryptoData: CryptoData[]): Promise<MarketConditions> {
  if (cryptoData.length === 0) {
    // Return default conditions if no data
    return {
      overall: 'neutral',
      volatility: 'medium',
      fearGreedIndex: 50,
      dominance: {
        btc: 54.2,
        eth: 17.8
      }
    };
  }

  // Calculate overall sentiment based on price changes
  const avgChange = cryptoData.reduce((sum, crypto) => sum + crypto.change24h, 0) / cryptoData.length;
  const overall = avgChange > 2 ? 'bullish' : avgChange < -2 ? 'bearish' : 'neutral';

  // Calculate volatility based on price changes
  const volatilityScore = cryptoData.reduce((sum, crypto) => sum + Math.abs(crypto.change24h), 0) / cryptoData.length;
  const volatility = volatilityScore > 5 ? 'high' : volatilityScore > 2 ? 'medium' : 'low';

  // Generate Fear & Greed Index based on market conditions
  let fearGreedIndex = 50;
  if (overall === 'bullish') fearGreedIndex += 20;
  if (overall === 'bearish') fearGreedIndex -= 20;
  if (volatility === 'high') fearGreedIndex -= 10;
  if (volatility === 'low') fearGreedIndex += 10;
  fearGreedIndex = Math.max(0, Math.min(100, fearGreedIndex + (Math.random() - 0.5) * 20));

  // Calculate dominance (simplified)
  const btcData = cryptoData.find(c => c.symbol === 'BTC');
  const ethData = cryptoData.find(c => c.symbol === 'ETH');
  
  // Only calculate dominance if we have valid market cap data
  let btcDominance = 54.2; // Default fallback
  let ethDominance = 17.8; // Default fallback
  
  if (btcData && ethData && btcData.marketCap > 0 && ethData.marketCap > 0) {
    // Use real market cap data to calculate actual dominance
    const totalMarketCap = cryptoData
      .filter(crypto => crypto.marketCap > 0)
      .reduce((sum, crypto) => sum + crypto.marketCap, 0);
    
    if (totalMarketCap > 0) {
      btcDominance = (btcData.marketCap / totalMarketCap) * 100;
      ethDominance = (ethData.marketCap / totalMarketCap) * 100;
      
      console.log(`📊 Calculated real dominance - BTC: ${btcDominance.toFixed(1)}%, ETH: ${ethDominance.toFixed(1)}%`);
    }
  } else {
    console.log('📦 Using fallback dominance values due to missing market cap data');
  }

  return {
    overall,
    volatility,
    fearGreedIndex: Math.round(fearGreedIndex),
    dominance: {
      btc: Math.round(btcDominance * 10) / 10,
      eth: Math.round(ethDominance * 10) / 10
    }
  };
}