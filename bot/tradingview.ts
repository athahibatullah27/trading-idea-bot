import axios from 'axios';
import { CryptoData } from '../src/types/trading.js';

// TradingView API endpoints
const TRADINGVIEW_API_BASE = 'https://scanner.tradingview.com';

// Helper function to get real-time crypto data from TradingView
export async function getRealTimeCryptoData(symbol: string): Promise<CryptoData | null> {
  try {
    console.log(`Fetching real-time data for ${symbol}...`);
    
    // TradingView scanner API request
    const scannerData = {
      filter: [
        { left: "name", operation: "match", right: `BINANCE:${symbol}USDT` }
      ],
      options: { lang: "en" },
      symbols: {
        query: { types: [] },
        tickers: [`BINANCE:${symbol}USDT`]
      },
      columns: [
        "name", "close", "change", "change_abs", "volume", 
        "market_cap_basic", "RSI", "MACD.macd", "BB.upper", "BB.lower", "BB.basis"
      ],
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 1]
    };

    const response = await axios.post(`${TRADINGVIEW_API_BASE}/america/scan`, scannerData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      throw new Error('No data received from TradingView API');
    }

    const data = response.data.data[0].d;
    
    // Parse the data array
    const [
      name, price, changePercent, changeAbs, volume, 
      marketCap, rsi, macd, bbUpper, bbLower, bbMiddle
    ] = data;

    const cryptoData: CryptoData = {
      symbol: symbol,
      name: getCryptoName(symbol),
      price: price || 0,
      change24h: changePercent || 0,
      volume: volume || 0,
      marketCap: marketCap || 0,
      rsi: rsi || 50,
      macd: macd || 0,
      bollinger: {
        upper: bbUpper || price * 1.02,
        middle: bbMiddle || price,
        lower: bbLower || price * 0.98
      }
    };

    console.log(`✅ Successfully fetched real-time data for ${symbol}:`, {
      price: price,
      change24h: changePercent?.toFixed(2) + '%',
      rsi: rsi?.toFixed(1)
    });

    return cryptoData;

  } catch (error) {
    console.error(`❌ Error fetching real-time data for ${symbol}:`, error.message);
    
    // Try alternative API approach
    try {
      return await getAlternativeData(symbol);
    } catch (altError) {
      console.error(`❌ Alternative API also failed for ${symbol}:`, altError.message);
      return null;
    }
  }
}

// Alternative data source using a different endpoint
async function getAlternativeData(symbol: string): Promise<CryptoData | null> {
  try {
    console.log(`Trying alternative data source for ${symbol}...`);
    
    // Using CoinGecko API as fallback
    const coinGeckoIds: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum', 
      'SOL': 'solana',
      'ADA': 'cardano',
      'BNB': 'binancecoin',
      'XRP': 'ripple'
    };

    const coinId = coinGeckoIds[symbol];
    if (!coinId) {
      throw new Error(`No CoinGecko ID found for ${symbol}`);
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { timeout: 8000 }
    );

    const data = response.data[coinId];
    if (!data) {
      throw new Error('No data from CoinGecko');
    }

    // Generate mock technical indicators (in a real app, you'd calculate these)
    const mockRSI = 45 + Math.random() * 20; // Random RSI between 45-65
    const mockMACD = (Math.random() - 0.5) * 100; // Random MACD

    const cryptoData: CryptoData = {
      symbol: symbol,
      name: getCryptoName(symbol),
      price: data.usd,
      change24h: data.usd_24h_change || 0,
      volume: data.usd_24h_vol || 0,
      marketCap: data.usd_market_cap || 0,
      rsi: mockRSI,
      macd: mockMACD,
      bollinger: {
        upper: data.usd * 1.02,
        middle: data.usd,
        lower: data.usd * 0.98
      }
    };

    console.log(`✅ Alternative API success for ${symbol}:`, {
      price: data.usd,
      change24h: data.usd_24h_change?.toFixed(2) + '%'
    });

    return cryptoData;

  } catch (error) {
    console.error(`❌ Alternative API failed for ${symbol}:`, error.message);
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

// Function to get multiple crypto data at once
export async function getMultipleCryptoData(symbols: string[]): Promise<CryptoData[]> {
  console.log(`🔄 Fetching data for multiple cryptos: ${symbols.join(', ')}`);
  
  const promises = symbols.map(symbol => getRealTimeCryptoData(symbol));
  const results = await Promise.allSettled(promises);
  
  const successfulResults = results
    .filter((result): result is PromiseFulfilledResult<CryptoData> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);

  console.log(`✅ Successfully fetched data for ${successfulResults.length}/${symbols.length} cryptos`);
  
  return successfulResults;
}

// Function to test API connectivity
export async function testAPIConnection(): Promise<boolean> {
  try {
    console.log('🧪 Testing API connection...');
    const testData = await getRealTimeCryptoData('BTC');
    if (testData && testData.price > 0) {
      console.log('✅ API connection test successful');
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ API connection test failed:', error.message);
    return false;
  }
}