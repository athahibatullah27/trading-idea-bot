import axios from 'axios';

// Binance Futures API configuration
const BINANCE_FUTURES_API_BASE = 'https://fapi.binance.com';

export interface CandlestickData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  ema20: number;
  ema50: number;
  support: number;
  resistance: number;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
}

export interface DerivativesMarketData {
  symbol: string;
  candlesticks: CandlestickData[];
  technicalIndicators: TechnicalIndicators;
  marketInfo: {
    fundingRate?: number;
    openInterest?: number;
    markPrice?: number;
  };
}

// Function to fetch candlestick data from Binance Futures
export async function fetchCandlestickData(
  symbol: string, 
  interval: string = '1h', 
  limit: number = 100
): Promise<CandlestickData[]> {
  try {
    console.log(`📊 Fetching ${limit} ${interval} candlesticks for ${symbol} from Binance Futures...`);
    
    const url = `${BINANCE_FUTURES_API_BASE}/fapi/v1/klines`;
    const params = {
      symbol: symbol.toUpperCase(),
      interval,
      limit
    };
    
    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format from Binance API');
    }
    
    const candlesticks: CandlestickData[] = response.data.map((candle: any[]) => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: candle[6],
      quoteAssetVolume: parseFloat(candle[7]),
      numberOfTrades: candle[8],
      takerBuyBaseAssetVolume: parseFloat(candle[9]),
      takerBuyQuoteAssetVolume: parseFloat(candle[10])
    }));
    
    console.log(`✅ Successfully fetched ${candlesticks.length} candlesticks for ${symbol}`);
    return candlesticks;
    
  } catch (error) {
    console.error(`❌ Error fetching candlestick data for ${symbol}:`, error.message);
    throw error;
  }
}

// Function to calculate RSI
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Default neutral RSI
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate RSI using Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Function to calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

// Function to calculate MACD
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // For signal line, we need MACD values over time, but for simplicity we'll use a basic approximation
  const signal = macd * 0.8; // Simplified signal line
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

// Function to calculate Bollinger Bands
function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    const currentPrice = prices[prices.length - 1];
    return {
      upper: currentPrice * 1.02,
      middle: currentPrice,
      lower: currentPrice * 0.98
    };
  }
  
  const recentPrices = prices.slice(-period);
  const middle = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    upper: middle + (standardDeviation * stdDev),
    middle,
    lower: middle - (standardDeviation * stdDev)
  };
}

// Function to find support and resistance levels
function findSupportResistance(candlesticks: CandlestickData[]): { support: number; resistance: number } {
  if (candlesticks.length < 10) {
    const currentPrice = candlesticks[candlesticks.length - 1].close;
    return {
      support: currentPrice * 0.95,
      resistance: currentPrice * 1.05
    };
  }
  
  const highs = candlesticks.map(c => c.high);
  const lows = candlesticks.map(c => c.low);
  
  // Simple support/resistance calculation based on recent highs and lows
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  
  return { support, resistance };
}

// Function to calculate all technical indicators
export function calculateTechnicalIndicators(candlesticks: CandlestickData[]): TechnicalIndicators {
  if (candlesticks.length === 0) {
    throw new Error('No candlestick data provided for technical analysis');
  }
  
  const closePrices = candlesticks.map(c => c.close);
  const currentPrice = closePrices[closePrices.length - 1];
  const previousPrice = closePrices[closePrices.length - 2] || currentPrice;
  const priceChange24h = ((currentPrice - previousPrice) / previousPrice) * 100;
  
  // Calculate volume for last 24 hours (approximate)
  const volume24h = candlesticks.slice(-24).reduce((sum, c) => sum + c.volume, 0);
  
  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);
  const bollinger = calculateBollingerBands(closePrices);
  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const { support, resistance } = findSupportResistance(candlesticks);
  
  return {
    rsi,
    macd,
    bollinger,
    ema20,
    ema50,
    support,
    resistance,
    currentPrice,
    priceChange24h,
    volume24h
  };
}

// Function to get comprehensive derivatives market data
export async function getDerivativesMarketData(symbol: string): Promise<DerivativesMarketData> {
  try {
    console.log(`🔄 Fetching comprehensive market data for ${symbol}...`);
    
    // Fetch candlestick data (last 100 hours for good technical analysis)
    const candlesticks = await fetchCandlestickData(symbol, '1h', 100);
    
    // Calculate technical indicators
    const technicalIndicators = calculateTechnicalIndicators(candlesticks);
    
    // TODO: Fetch additional market info like funding rate, open interest
    // For now, we'll use placeholder values
    const marketInfo = {
      fundingRate: 0.01, // Placeholder
      openInterest: 1000000, // Placeholder
      markPrice: technicalIndicators.currentPrice
    };
    
    console.log(`✅ Successfully calculated technical indicators for ${symbol}:`, {
      price: technicalIndicators.currentPrice.toLocaleString(),
      rsi: technicalIndicators.rsi.toFixed(1),
      change24h: technicalIndicators.priceChange24h.toFixed(2) + '%'
    });
    
    return {
      symbol,
      candlesticks,
      technicalIndicators,
      marketInfo
    };
    
  } catch (error) {
    console.error(`❌ Error getting derivatives market data for ${symbol}:`, error.message);
    throw error;
  }
}

// Function to test Binance Futures API connectivity
export async function testBinanceFuturesAPI(): Promise<boolean> {
  try {
    console.log('🧪 Testing Binance Futures API connectivity...');
    
    const response = await axios.get(`${BINANCE_FUTURES_API_BASE}/fapi/v1/ping`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Binance Futures API test successful');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Binance Futures API test failed:', error.message);
    return false;
  }
}