import axios from 'axios';
import { CryptoData } from './types.js';
import { 
  logApiRequest, 
  logApiResponse, 
  startPerformanceTimer, 
  endPerformanceTimer,
  logFunctionEntry,
  logFunctionExit,
  log
} from './utils/logger.js';

// TradingView API endpoints
const TRADINGVIEW_API_BASE = 'https://scanner.tradingview.com';

// Helper function to get real-time crypto data from TradingView
export async function getRealTimeCryptoData(symbol: string, context?: string): Promise<CryptoData | null> {
  const timerId = startPerformanceTimer('getRealTimeCryptoData');
  logFunctionEntry('getRealTimeCryptoData', { symbol });
  
  try {
    log('INFO', `Fetching real-time data for ${symbol}...`);
    
    // Try multiple ticker formats for better success rate
    const tickerFormats = [
      `BINANCE:${symbol}USDT`,
      `BINANCE:${symbol}USD`,
      `COINBASE:${symbol}USD`,
      `KRAKEN:${symbol}USD`,
      `BITSTAMP:${symbol}USD`
    ];

    for (const ticker of tickerFormats) {
      try {
        log('INFO', `Trying TradingView ticker: ${ticker}`);
        
        const scannerData = {
          options: { lang: "en" },
          symbols: {
            query: { types: [] },
            tickers: [ticker]
          },
          columns: [
            "name", "close", "change", "change_abs", "volume", 
            "market_cap_basic", "RSI", "MACD.macd", "BB.upper", "BB.lower", "BB.basis"
          ],
          sort: { sortBy: "name", sortOrder: "asc" },
          range: [0, 1]
        };

        const endpoint = `${TRADINGVIEW_API_BASE}/america/scan`;
        logApiRequest({
          endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: scannerData,
          context
        });

        const response = await axios.post(`${TRADINGVIEW_API_BASE}/america/scan`, scannerData, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 8000
        });

        logApiResponse({
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          context
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
          const data = response.data.data[0].d;
          
          // Parse the data array
          const [
            name, price, changePercent, changeAbs, volume, 
            marketCap, rsi, macd, bbUpper, bbLower, bbMiddle
          ] = data;

          // Validate that we have essential data
          if (price && price > 0) {
            const cryptoData: CryptoData = {
              symbol: symbol,
              name: getCryptoName(symbol),
              price: price,
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

            log('INFO', `Successfully fetched TradingView data for ${symbol} via ${ticker}`, {
              price: price,
              change24h: changePercent?.toFixed(2) + '%',
              rsi: rsi?.toFixed(1)
            });

            logFunctionExit('getRealTimeCryptoData', cryptoData);
            endPerformanceTimer(timerId);
            return cryptoData;
          }
        }
      } catch (tickerError) {
        logApiResponse({
          status: tickerError.response?.status || 0,
          error: tickerError,
          context
        });
        log('WARN', `Failed to fetch from ${ticker}`, tickerError.message);
        continue; // Try next ticker format
      }
    }

    // If all TradingView attempts failed
    throw new Error('No data received from TradingView API with any ticker format');

  } catch (error) {
    log('ERROR', `Error fetching real-time data for ${symbol}`, error.message);
    
    // Try alternative API approach
    try {
      log('INFO', `Trying alternative data source for ${symbol}...`);
      return await getAlternativeData(symbol, context);
    } catch (altError) {
      log('ERROR', `Alternative API also failed for ${symbol}`, altError.message);
      logFunctionExit('getRealTimeCryptoData', null);
      endPerformanceTimer(timerId);
      return null;
    }
  }
}

// Alternative data source using a different endpoint
async function getAlternativeData(symbol: string, context?: string): Promise<CryptoData | null> {
  const timerId = startPerformanceTimer('getAlternativeData');
  logFunctionEntry('getAlternativeData', { symbol });
  
  try {
    log('INFO', `Trying alternative data source for ${symbol}...`);
    
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
      logFunctionExit('getAlternativeData', null);
      endPerformanceTimer(timerId);
      throw new Error(`No CoinGecko ID found for ${symbol}`);
    }

    const endpoint = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    logApiRequest({
      endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0'
      },
      context
    });

    const response = await axios.get(
      endpoint,
      { 
        timeout: 8000,
        headers: {
          'User-Agent': 'CryptoTrader-Bot/1.0'
        }
      }
    );

    logApiResponse({
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      context
    });

    const data = response.data[coinId];
    if (!data) {
      logFunctionExit('getAlternativeData', null);
      endPerformanceTimer(timerId);
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

    log('INFO', `Alternative API success for ${symbol}`, {
      price: data.usd,
      change24h: data.usd_24h_change?.toFixed(2) + '%'
    });

    logFunctionExit('getAlternativeData', cryptoData);
    endPerformanceTimer(timerId);
    return cryptoData;

  } catch (error) {
    log('ERROR', `Alternative API failed for ${symbol}`, error.message);
    logFunctionExit('getAlternativeData', null);
    endPerformanceTimer(timerId);
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
export async function getMultipleCryptoData(symbols: string[], context?: string): Promise<CryptoData[]> {
  const timerId = startPerformanceTimer('getMultipleCryptoData');
  logFunctionEntry('getMultipleCryptoData', { symbols, count: symbols.length });
  
  log('INFO', `Fetching data for multiple cryptos: ${symbols.join(', ')}`);
  
  // Add delay between requests to avoid rate limiting
  const results: CryptoData[] = [];
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    
    try {
      const data = await getRealTimeCryptoData(symbol, context);
      if (data) {
        results.push(data);
      }
    } catch (error) {
      log('ERROR', `Failed to fetch data for ${symbol}`, error.message);
    }
    
    // Add delay between requests (except for the last one)
    if (i < symbols.length - 1) {
      log('INFO', `Waiting 300ms before next request to avoid rate limits...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  log('INFO', `Successfully fetched data for ${results.length}/${symbols.length} cryptos`);
  logFunctionExit('getMultipleCryptoData', { successCount: results.length, totalCount: symbols.length });
  endPerformanceTimer(timerId);
  return results;

  /* Old parallel approach - keeping as backup
  const promises = symbols.map(symbol => getRealTimeCryptoData(symbol));
  const results = await Promise.allSettled(promises);
  
  const successfulResults = results
    .filter((result): result is PromiseFulfilledResult<CryptoData> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);

  console.log(`✅ Successfully fetched data for ${successfulResults.length}/${symbols.length} cryptos`);
  
  return successfulResults;
  */
}

// Function to test API connectivity
export async function testAPIConnection(): Promise<boolean> {
  const timerId = startPerformanceTimer('testAPIConnection');
  logFunctionEntry('testAPIConnection');
  
  try {
    log('INFO', 'Testing API connection...');
    const testData = await getRealTimeCryptoData('BTC', 'test connection');
    if (testData && testData.price > 0) {
      log('INFO', 'API connection test successful');
      logFunctionExit('testAPIConnection', true);
      endPerformanceTimer(timerId);
      return true;
    }
    logFunctionExit('testAPIConnection', false);
    endPerformanceTimer(timerId);
    return false;
  } catch (error) {
    log('ERROR', 'API connection test failed', error.message);
    logFunctionExit('testAPIConnection', false);
    endPerformanceTimer(timerId);
    return false;
  }
}