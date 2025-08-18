import axios from 'axios';
import { 
  TechnicalIndicators, 
  TimeframeData, 
  EnhancedDerivativesMarketData,
  FibonacciLevels, 
  CandlestickData
} from './types.js';
import { 
  logApiRequest, 
  logApiResponse, 
  startPerformanceTimer, 
  endPerformanceTimer,
  logFunctionEntry,
  logFunctionExit,
  log
} from './utils/logger.js';

// Binance Futures API configuration
const BINANCE_FUTURES_API_BASE = 'https://fapi.binance.com';


// Function to fetch candlestick data from Binance Futures
export async function fetchCandlestickData(
  symbol: string, 
  interval: string = '1h', 
  limit: number = 100,
  context?: string
): Promise<CandlestickData[]> {
  const timerId = startPerformanceTimer('fetchCandlestickData');
  logFunctionEntry('fetchCandlestickData', { symbol, interval, limit });
  
  try {
    log('INFO', `Fetching ${limit} ${interval} candlesticks for ${symbol} from Binance Futures...`);
    
    const url = `${BINANCE_FUTURES_API_BASE}/fapi/v1/klines`;
    const params = {
      symbol: symbol.toUpperCase(),
      interval,
      limit
    };
    
    logApiRequest({
      endpoint: url,
      method: 'GET',
      params,
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      },
      context
    });
    
    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      }
    });
    
    logApiResponse({
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      context
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      logFunctionExit('fetchCandlestickData', []);
      endPerformanceTimer(timerId);
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
    
    log('INFO', `Successfully fetched ${candlesticks.length} candlesticks for ${symbol} (${interval})`);
    logFunctionExit('fetchCandlestickData', { count: candlesticks.length });
    endPerformanceTimer(timerId);
    return candlesticks;
    
  } catch (error) {
    log('ERROR', `Error fetching candlestick data for ${symbol} (${interval})`, error.message);
    
    if (error.response) {
      logApiResponse({
        status: error.response.status,
        statusText: error.response.statusText,
        error: error.response.data,
        context
      });
    }
    
    logFunctionExit('fetchCandlestickData', []);
    endPerformanceTimer(timerId);
    throw error;
  }
}

// Function to calculate RSI with trend
function calculateRSIWithTrend(prices: number[], period: number = 14): { rsi: number; trend: 'rising' | 'falling' | 'flat' } {
  if (prices.length < period + 5) return { rsi: 50, trend: 'flat' }; // Need extra data for trend
  
  // Calculate RSI for multiple periods to determine trend
  const rsiValues: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const endIndex = prices.length - i;
    const slicedPrices = prices.slice(0, endIndex);
    
    if (slicedPrices.length < period + 1) continue;
    
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain and loss
    for (let j = 1; j <= period; j++) {
      const change = slicedPrices[j] - slicedPrices[j - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate RSI using Wilder's smoothing
    for (let j = period + 1; j < slicedPrices.length; j++) {
      const change = slicedPrices[j] - slicedPrices[j - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }
  }
  
  const currentRSI = rsiValues[0];
  const oldestRSI = rsiValues[rsiValues.length - 1];
  
  let trend: 'rising' | 'falling' | 'flat' = 'flat';
  const rsiDiff = currentRSI - oldestRSI;
  
  if (rsiDiff > 2) trend = 'rising';
  else if (rsiDiff < -2) trend = 'falling';
  
  return { rsi: currentRSI, trend };
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

// Function to calculate MACD with trend
function calculateMACDWithTrend(prices: number[]): { macd: number; signal: number; histogram: number; trend: 'rising' | 'falling' | 'flat' } {
  if (prices.length < 50) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    return { macd, signal: macd * 0.8, histogram: macd * 0.2, trend: 'flat' };
  }
  
  // Calculate MACD for multiple periods to determine trend
  const histogramValues: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const endIndex = prices.length - i;
    const slicedPrices = prices.slice(0, endIndex);
    
    if (slicedPrices.length < 26) continue;
    
    const ema12 = calculateEMA(slicedPrices, 12);
    const ema26 = calculateEMA(slicedPrices, 26);
    const macd = ema12 - ema26;
    const signal = macd * 0.8; // Simplified signal calculation
    const histogram = macd - signal;
    
    histogramValues.push(histogram);
  }
  
  const currentHistogram = histogramValues[0];
  const oldestHistogram = histogramValues[histogramValues.length - 1];
  
  let trend: 'rising' | 'falling' | 'flat' = 'flat';
  if (histogramValues.length >= 3) {
    const histogramDiff = currentHistogram - oldestHistogram;
    if (histogramDiff > 10) trend = 'rising';
    else if (histogramDiff < -10) trend = 'falling';
  }
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  const signal = macd * 0.8;
  const histogram = macd - signal;
  
  return { macd, signal, histogram, trend };
}

// Function to calculate Bollinger Bands with trend
function calculateBollingerBandsWithTrend(prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number; trend: 'expanding' | 'contracting' | 'flat' } {
  if (prices.length < period + 5) {
    const currentPrice = prices[prices.length - 1];
    return {
      upper: currentPrice * 1.02,
      middle: currentPrice,
      lower: currentPrice * 0.98,
      trend: 'flat'
    };
  }
  
  // Calculate Bollinger Bands for multiple periods to determine trend
  const bandWidths: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const endIndex = prices.length - i;
    const slicedPrices = prices.slice(Math.max(0, endIndex - period), endIndex);
    
    if (slicedPrices.length < period) continue;
    
    const middle = slicedPrices.reduce((sum, price) => sum + price, 0) / slicedPrices.length;
    const variance = slicedPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / slicedPrices.length;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = middle + (standardDeviation * stdDev);
    const lower = middle - (standardDeviation * stdDev);
    const bandWidth = ((upper - lower) / middle) * 100;
    
    bandWidths.push(bandWidth);
  }
  
  // Current Bollinger Bands calculation
  const recentPrices = prices.slice(-period);
  const middle = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  const upper = middle + (standardDeviation * stdDev);
  const lower = middle - (standardDeviation * stdDev);
  
  // Determine trend
  let trend: 'expanding' | 'contracting' | 'flat' = 'flat';
  if (bandWidths.length >= 3) {
    const currentWidth = bandWidths[0];
    const oldestWidth = bandWidths[bandWidths.length - 1];
    const widthDiff = ((currentWidth - oldestWidth) / oldestWidth) * 100;
    
    if (widthDiff > 5) trend = 'expanding';
    else if (widthDiff < -5) trend = 'contracting';
  }
  
  return { upper, middle, lower, trend };
}

// Function to find multiple support and resistance levels
function findMultipleSupportResistance(candlesticks: CandlestickData[]): { support: number[]; resistance: number[] } {
  if (candlesticks.length < 20) {
    const currentPrice = candlesticks[candlesticks.length - 1].close;
    return {
      support: [currentPrice * 0.95, currentPrice * 0.90],
      resistance: [currentPrice * 1.05, currentPrice * 1.10]
    };
  }
  
  const highs = candlesticks.map(c => c.high);
  const lows = candlesticks.map(c => c.low);
  
  // Find local highs and lows using a 5-candle window
  const localHighs: number[] = [];
  const localLows: number[] = [];
  
  for (let i = 2; i < candlesticks.length - 2; i++) {
    const current = candlesticks[i];
    const isLocalHigh = highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
                       highs[i] > highs[i+1] && highs[i] > highs[i+2];
    const isLocalLow = lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
                      lows[i] < lows[i+1] && lows[i] < lows[i+2];
    
    if (isLocalHigh) localHighs.push(highs[i]);
    if (isLocalLow) localLows.push(lows[i]);
  }
  
  // Sort and get the most significant levels
  const sortedHighs = localHighs.sort((a, b) => b - a).slice(0, 3);
  const sortedLows = localLows.sort((a, b) => a - b).slice(0, 3);
  
  // If we don't have enough levels, add some based on recent price action
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  
  const resistance = sortedHighs.length > 0 ? sortedHighs : [recentHigh];
  const support = sortedLows.length > 0 ? sortedLows : [recentLow];
  
  return { support, resistance };
}

// Function to calculate Fibonacci retracement and extension levels
function calculateFibonacciLevels(candlesticks: CandlestickData[]): {
  retracement: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_786: number;
    level_1000: number;
  };
  extension: {
    level_1272: number;
    level_1618: number;
    level_2618: number;
  };
  swingHigh: number;
  swingLow: number;
  trend: 'bullish_retracement' | 'bearish_retracement' | 'extension_phase' | 'no_clear_swing';
} {
  if (candlesticks.length < 20) {
    const currentPrice = candlesticks[candlesticks.length - 1].close;
    return {
      retracement: {
        level_0: currentPrice * 1.05,
        level_236: currentPrice * 1.038,
        level_382: currentPrice * 1.024,
        level_500: currentPrice * 1.012,
        level_618: currentPrice * 0.995,
        level_786: currentPrice * 0.978,
        level_1000: currentPrice * 0.95
      },
      extension: {
        level_1272: currentPrice * 1.08,
        level_1618: currentPrice * 1.12,
        level_2618: currentPrice * 1.25
      },
      swingHigh: currentPrice * 1.05,
      swingLow: currentPrice * 0.95,
      trend: 'no_clear_swing'
    };
  }

  // Find significant swing high and swing low using a 10-candle window
  let swingHigh = 0;
  let swingLow = Number.MAX_VALUE;
  let swingHighIndex = -1;
  let swingLowIndex = -1;

  // Look for swing points in the last 50 candles for better significance
  const lookbackPeriod = Math.min(50, candlesticks.length);
  const startIndex = candlesticks.length - lookbackPeriod;

  for (let i = startIndex + 5; i < candlesticks.length - 5; i++) {
    const current = candlesticks[i];
    
    // Check for swing high (highest point in 5-candle window on each side)
    let isSwingHigh = true;
    for (let j = i - 5; j <= i + 5; j++) {
      if (j !== i && candlesticks[j].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }
    
    // Check for swing low (lowest point in 5-candle window on each side)
    let isSwingLow = true;
    for (let j = i - 5; j <= i + 5; j++) {
      if (j !== i && candlesticks[j].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }
    
    if (isSwingHigh && current.high > swingHigh) {
      swingHigh = current.high;
      swingHighIndex = i;
    }
    
    if (isSwingLow && current.low < swingLow) {
      swingLow = current.low;
      swingLowIndex = i;
    }
  }

  // If no clear swings found, use recent high/low
  if (swingHigh === 0 || swingLow === Number.MAX_VALUE) {
    const recentCandles = candlesticks.slice(-20);
    swingHigh = Math.max(...recentCandles.map(c => c.high));
    swingLow = Math.min(...recentCandles.map(c => c.low));
  }

  const currentPrice = candlesticks[candlesticks.length - 1].close;
  const range = swingHigh - swingLow;

  // Determine trend based on swing timing and current price position
  let trend: 'bullish_retracement' | 'bearish_retracement' | 'extension_phase' | 'no_clear_swing' = 'no_clear_swing';
  
  if (swingHighIndex > swingLowIndex) {
    // Most recent swing is high, likely in bearish retracement
    if (currentPrice < swingHigh && currentPrice > swingLow) {
      trend = 'bearish_retracement';
    } else if (currentPrice < swingLow) {
      trend = 'extension_phase';
    }
  } else if (swingLowIndex > swingHighIndex) {
    // Most recent swing is low, likely in bullish retracement
    if (currentPrice > swingLow && currentPrice < swingHigh) {
      trend = 'bullish_retracement';
    } else if (currentPrice > swingHigh) {
      trend = 'extension_phase';
    }
  }

  // Calculate Fibonacci retracement levels
  const retracement = {
    level_0: swingHigh,                           // 0% - Swing High
    level_236: swingHigh - (range * 0.236),      // 23.6%
    level_382: swingHigh - (range * 0.382),      // 38.2%
    level_500: swingHigh - (range * 0.500),      // 50%
    level_618: swingHigh - (range * 0.618),      // 61.8%
    level_786: swingHigh - (range * 0.786),      // 78.6%
    level_1000: swingLow                         // 100% - Swing Low
  };

  // Calculate Fibonacci extension levels (beyond the swing range)
  const extension = {
    level_1272: swingLow - (range * 0.272),      // 127.2%
    level_1618: swingLow - (range * 0.618),      // 161.8%
    level_2618: swingLow - (range * 1.618)       // 261.8%
  };

  return {
    retracement,
    extension,
    swingHigh,
    swingLow,
    trend
  };
}

// Function to identify market regime based on technical indicators
function identifyMarketRegime(indicators: TechnicalIndicators): 'trending_bullish' | 'trending_bearish' | 'ranging_volatile' | 'ranging_quiet' | 'consolidation' | 'breakout_pending' {
  const {
    rsi,
    rsiTrend,
    macd,
    bollinger,
    emaTrend,
    currentPrice,
    volumeTrend,
    priceChange24h
  } = indicators;

  // Determine if market is trending or ranging
  const isTrending = emaTrend !== 'neutral' && 
                    (macd.trend === 'rising' || macd.trend === 'falling') &&
                    Math.abs(priceChange24h) > 2; // Significant price movement

  const isVolatile = bollinger.trend === 'expanding' || 
                    (volumeTrend === 'significantly above average' || volumeTrend === 'above average') ||
                    Math.abs(priceChange24h) > 5;

  const isQuiet = bollinger.trend === 'contracting' && 
                 volumeTrend === 'below average' &&
                 Math.abs(priceChange24h) < 1;

  // Check for potential breakout conditions
  const isBreakoutPending = bollinger.trend === 'contracting' && 
                           volumeTrend === 'above average' &&
                           (rsi > 45 && rsi < 55) && // RSI in neutral zone
                           Math.abs(priceChange24h) < 2;

  // Check for consolidation (price near Bollinger middle, low volatility)
  const isConsolidation = Math.abs(currentPrice - indicators.bollinger.middle) / indicators.bollinger.middle < 0.01 &&
                         bollinger.trend === 'contracting' &&
                         Math.abs(priceChange24h) < 1.5;

  // Determine regime based on conditions
  if (isBreakoutPending) {
    return 'breakout_pending';
  }
  
  if (isConsolidation) {
    return 'consolidation';
  }
  
  if (isTrending) {
    if (emaTrend === 'bullish' && macd.macd > macd.signal && rsiTrend === 'rising') {
      return 'trending_bullish';
    } else if (emaTrend === 'bearish' && macd.macd < macd.signal && rsiTrend === 'falling') {
      return 'trending_bearish';
    }
  }
  
  // If not clearly trending, determine ranging type
  if (isVolatile) {
    return 'ranging_volatile';
  } else if (isQuiet) {
    return 'ranging_quiet';
  }
  
  // Default to ranging volatile if conditions are mixed
  return 'ranging_volatile';
}

// Function to calculate volume trend
function calculateVolumeTrend(candlesticks: CandlestickData[]): { volumeTrend: 'significantly above average' | 'above average' | 'average' | 'below average'; averageVolume: number } {
  if (candlesticks.length < 7) {
    const currentVolume = candlesticks[candlesticks.length - 1]?.volume || 0;
    return { volumeTrend: 'average', averageVolume: currentVolume };
  }
  
  // Calculate 7-day average volume (assuming 24 candles per day for 1h timeframe)
  const lookbackPeriod = Math.min(168, candlesticks.length); // 7 days * 24 hours
  const recentVolumes = candlesticks.slice(-lookbackPeriod).map(c => c.volume);
  const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
  
  // Get current volume (last 24 candles average)
  const currentPeriod = Math.min(24, candlesticks.length);
  const currentVolumes = candlesticks.slice(-currentPeriod).map(c => c.volume);
  const currentVolume = currentVolumes.reduce((sum, vol) => sum + vol, 0) / currentVolumes.length;
  
  const volumeRatio = currentVolume / averageVolume;
  
  let volumeTrend: 'significantly above average' | 'above average' | 'average' | 'below average';
  
  if (volumeRatio >= 1.5) volumeTrend = 'significantly above average';
  else if (volumeRatio >= 1.2) volumeTrend = 'above average';
  else if (volumeRatio >= 0.8) volumeTrend = 'average';
  else volumeTrend = 'below average';
  
  return { volumeTrend, averageVolume };
}

// Function to calculate all technical indicators with trends
export function calculateEnhancedTechnicalIndicators(candlesticks: CandlestickData[]): TechnicalIndicators {
  if (candlesticks.length === 0) {
    throw new Error('No candlestick data provided for technical analysis');
  }
  
  const closePrices = candlesticks.map(c => c.close);
  const currentPrice = closePrices[closePrices.length - 1];
  const previousPrice = closePrices[closePrices.length - 2] || currentPrice;
  const priceChange24h = ((currentPrice - previousPrice) / previousPrice) * 100;
  
  // Calculate volume for last 24 hours (approximate)
  const volume24h = candlesticks.slice(-24).reduce((sum, c) => sum + c.volume, 0);
  
  const { rsi, trend: rsiTrend } = calculateRSIWithTrend(closePrices);
  const { macd, signal, histogram, trend: macdTrend } = calculateMACDWithTrend(closePrices);
  const { upper, middle, lower, trend: bollingerTrend } = calculateBollingerBandsWithTrend(closePrices);
  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const { support, resistance } = findMultipleSupportResistance(candlesticks);
  const { volumeTrend, averageVolume } = calculateVolumeTrend(candlesticks);
  const fibonacciLevels = calculateFibonacciLevels(candlesticks);
  
  // Determine EMA trend
  let emaTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema20 > ema50 && currentPrice > ema20) emaTrend = 'bullish';
  else if (ema20 < ema50 && currentPrice < ema20) emaTrend = 'bearish';
  
  return {
    rsi,
    rsiTrend,
    macd: {
      macd,
      signal,
      histogram,
      trend: macdTrend
    },
    bollinger: {
      upper,
      middle,
      lower,
      trend: bollingerTrend
    },
    ema20,
    ema50,
    emaTrend,
    support,
    resistance,
    fibonacci: fibonacciLevels,
    currentPrice,
    priceChange24h,
    volume24h,
    volumeTrend,
    averageVolume
  };
}

// Function to get enhanced multi-timeframe derivatives market data
export async function getEnhancedDerivativesMarketData(symbol: string, context?: string): Promise<EnhancedDerivativesMarketData> {
  const timerId = startPerformanceTimer('getEnhancedDerivativesMarketData');
  logFunctionEntry('getEnhancedDerivativesMarketData', { symbol });
  
  try {
    log('INFO', `Fetching enhanced multi-timeframe market data for ${symbol}...`);
    
    // Fetch candlestick data for both timeframes
    const [candlesticks4h, candlesticks1h] = await Promise.all([
      fetchCandlestickData(symbol, '4h', 100, context),
      fetchCandlestickData(symbol, '1h', 200, context) // More data for better volume analysis
    ]);
    
    // Calculate technical indicators for both timeframes
    const indicators4h = calculateEnhancedTechnicalIndicators(candlesticks4h);
    const indicators1h = calculateEnhancedTechnicalIndicators(candlesticks1h);
    
    // Identify market regimes for both timeframes
    const marketRegime4h = identifyMarketRegime(indicators4h);
    const marketRegime1h = identifyMarketRegime(indicators1h);
    
    // Prepare recent OHLCV data
    const recentOHLCV4h = candlesticks4h.slice(-5).map(c => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      timestamp: c.openTime
    }));
    
    const recentOHLCV1h = candlesticks1h.slice(-5).map(c => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      timestamp: c.openTime
    }));
    
    // Use 1h data for overall market info since it's more recent
    const marketInfo = {
      fundingRate: 0.01, // Placeholder - would need separate API call
      volume24h: indicators1h.volume24h,
      volumeTrend: indicators1h.volumeTrend,
      averageVolume: indicators1h.averageVolume
    };
    
    const enhancedData: EnhancedDerivativesMarketData = {
      symbol,
      dataTimestamp: new Date().toISOString(),
      timeframes: {
        '4h': {
          timeframe: '4h',
          marketRegime: marketRegime4h,
          price: {
            currentPrice: indicators4h.currentPrice,
            recentOHLCV: recentOHLCV4h
          },
          indicators: indicators4h
        },
        '1h': {
          timeframe: '1h',
          marketRegime: marketRegime1h,
          price: {
            currentPrice: indicators1h.currentPrice,
            recentOHLCV: recentOHLCV1h
          },
          indicators: indicators1h
        }
      },
      market: marketInfo
    };
    
    log('INFO', `Successfully calculated enhanced multi-timeframe analysis for ${symbol}:`);
    log('INFO', `4h: Price $${indicators4h.currentPrice.toLocaleString()}, RSI ${indicators4h.rsi.toFixed(1)} (${indicators4h.rsiTrend})`);
    log('INFO', `1h: Price $${indicators1h.currentPrice.toLocaleString()}, RSI ${indicators1h.rsi.toFixed(1)} (${indicators1h.rsiTrend})`);
    log('INFO', `Market Regimes - 4h: ${marketRegime4h}, 1h: ${marketRegime1h}`);
    log('INFO', `Volume: ${indicators1h.volumeTrend}`);
    
    logFunctionExit('getEnhancedDerivativesMarketData', { 
      symbol, 
      price4h: indicators4h.currentPrice, 
      price1h: indicators1h.currentPrice,
      regime4h: marketRegime4h,
      regime1h: marketRegime1h
    });
    endPerformanceTimer(timerId);
    return enhancedData;
    
  } catch (error) {
    log('ERROR', `Error getting enhanced derivatives market data for ${symbol}`, error.message);
    logFunctionExit('getEnhancedDerivativesMarketData', null);
    endPerformanceTimer(timerId);
    throw error;
  }
}

// Function to test Binance Futures API connectivity
export async function testBinanceFuturesAPI(): Promise<boolean> {
  const timerId = startPerformanceTimer('testBinanceFuturesAPI');
  logFunctionEntry('testBinanceFuturesAPI');
  
  try {
    log('INFO', 'Testing Binance Futures API connectivity...');
    
    const testUrl = `${BINANCE_FUTURES_API_BASE}/fapi/v1/ping`;
    logApiRequest({
      endpoint: testUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      },
      context: 'test connection'
    });
    
    const response = await axios.get(`${BINANCE_FUTURES_API_BASE}/fapi/v1/ping`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      }
    });
    
    logApiResponse({
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      context: 'test connection'
    });
    
    if (response.status === 200) {
      log('INFO', 'Binance Futures API test successful');
      logFunctionExit('testBinanceFuturesAPI', true);
      endPerformanceTimer(timerId);
      return true;
    }
    
    logFunctionExit('testBinanceFuturesAPI', false);
    endPerformanceTimer(timerId);
    return false;
  } catch (error) {
    log('ERROR', 'Binance Futures API test failed', error.message);
    
    if (error.response) {
      logApiResponse({
        status: error.response.status,
        statusText: error.response.statusText,
        error: error.response.data,
        context: 'test connection'
      });
    }
    
    logFunctionExit('testBinanceFuturesAPI', false);
    endPerformanceTimer(timerId);
    return false;
  }
}