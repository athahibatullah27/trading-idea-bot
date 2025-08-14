import TradingView from 'tradingview-api';
import { CryptoData } from '../src/types/trading.js';

// Initialize TradingView client
const tv = new TradingView();

// Helper function to get technical indicators
async function getTechnicalIndicators(symbol: string) {
  try {
    // Get RSI indicator
    const rsiIndicator = await tv.getIndicator('RSI', `BINANCE:${symbol}USDT`, {
      period: 14
    });
    
    // Get MACD indicator
    const macdIndicator = await tv.getIndicator('MACD', `BINANCE:${symbol}USDT`, {
      fast_period: 12,
      slow_period: 26,
      signal_period: 9
    });

    // Get Bollinger Bands
    const bbIndicator = await tv.getIndicator('BB', `BINANCE:${symbol}USDT`, {
      period: 20,
      stddev: 2
    });

    return {
      rsi: rsiIndicator?.data?.[0]?.value || 50,
      macd: macdIndicator?.data?.[0]?.histogram || 0,
      bollinger: {
        upper: bbIndicator?.data?.[0]?.upper || 0,
        middle: bbIndicator?.data?.[0]?.middle || 0,
        lower: bbIndicator?.data?.[0]?.lower || 0
      }
    };
  } catch (error) {
    console.error(`Error fetching indicators for ${symbol}:`, error);
    return {
      rsi: 50,
      macd: 0,
      bollinger: { upper: 0, middle: 0, lower: 0 }
    };
  }
}

// Function to get real-time crypto data
export async function getRealTimeCryptoData(symbol: string): Promise<CryptoData | null> {
  try {
    console.log(`Fetching real-time data for ${symbol}...`);
    
    // Get current price and basic data
    const chart = await tv.getChart({
      symbol: `BINANCE:${symbol}USDT`,
      timeframe: '1D',
      range: 2
    });

    if (!chart || !chart.data || chart.data.length < 2) {
      throw new Error('Insufficient chart data');
    }

    const currentData = chart.data[chart.data.length - 1];
    const previousData = chart.data[chart.data.length - 2];
    
    const currentPrice = currentData.close;
    const previousPrice = previousData.close;
    const change24h = ((currentPrice - previousPrice) / previousPrice) * 100;

    // Get technical indicators
    const indicators = await getTechnicalIndicators(symbol);

    // Get volume data (approximate from chart data)
    const volume = currentData.volume || 1000000000; // Fallback volume

    // Estimate market cap (this would need a separate API call for accuracy)
    const estimatedMarketCap = currentPrice * getCirculatingSupply(symbol);

    const cryptoData: CryptoData = {
      symbol: symbol,
      name: getCryptoName(symbol),
      price: currentPrice,
      change24h: change24h,
      volume: volume,
      marketCap: estimatedMarketCap,
      rsi: indicators.rsi,
      macd: indicators.macd,
      bollinger: indicators.bollinger
    };

    console.log(`Successfully fetched data for ${symbol}:`, {
      price: currentPrice,
      change24h: change24h.toFixed(2) + '%'
    });

    return cryptoData;

  } catch (error) {
    console.error(`Error fetching real-time data for ${symbol}:`, error);
    return null;
  }
}

// Helper function to get crypto full names
function getCryptoName(symbol: string): string {
  const names: { [key: string]: string } = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'SOL': 'Solana',
    'ADA': 'Cardano',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'DOGE': 'Dogecoin',
    'MATIC': 'Polygon',
    'DOT': 'Polkadot',
    'AVAX': 'Avalanche'
  };
  return names[symbol] || symbol;
}

// Helper function to get approximate circulating supply (for market cap estimation)
function getCirculatingSupply(symbol: string): number {
  const supplies: { [key: string]: number } = {
    'BTC': 19700000,
    'ETH': 120000000,
    'SOL': 400000000,
    'ADA': 35000000000,
    'BNB': 150000000,
    'XRP': 53000000000,
    'DOGE': 140000000000,
    'MATIC': 9000000000,
    'DOT': 1200000000,
    'AVAX': 350000000
  };
  return supplies[symbol] || 1000000000;
}

// Function to get multiple crypto data at once
export async function getMultipleCryptoData(symbols: string[]): Promise<CryptoData[]> {
  const promises = symbols.map(symbol => getRealTimeCryptoData(symbol));
  const results = await Promise.allSettled(promises);
  
  return results
    .filter((result): result is PromiseFulfilledResult<CryptoData> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}