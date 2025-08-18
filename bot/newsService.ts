import axios from 'axios';
import { NewsItem } from './types.js';
import { 
  logApiRequest, 
  logApiResponse, 
  startPerformanceTimer, 
  endPerformanceTimer,
  logFunctionEntry,
  logFunctionExit,
  log
} from './utils/logger.js';

// CoinDesk API configuration
const CRYPTOCOMPARE_API_BASE = 'https://min-api.cryptocompare.com';

interface CryptoCompareArticle {
  ID: number;
  TITLE: string;
  BODY?: string;
  PUBLISHED_ON: number;
  URL: string;
  SOURCE_DATA?: {
    name: string;
  };
  SENTIMENT?: string;
}

interface CryptoCompareResponse {
  Data: CryptoCompareArticle[];
  Err: any;
}

// Legacy interface for backward compatibility
interface CoinDeskArticle {
  ID: number;
  title: string;
  summary?: string;
  published_at: number;
  url: string;
  tags?: string[];
  authors?: Array<{
    name: string;
  }>;
}

interface CoinDeskResponse {
  data: CoinDeskArticle[];
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}

// Function to analyze sentiment from title and summary
function analyzeSentiment(title: string, body?: string): 'bullish' | 'bearish' | 'neutral' {
  const text = `${title} ${body || ''}`.toLowerCase();
  
  // Bullish keywords
  const bullishKeywords = [
    'surge', 'rally', 'bull', 'rise', 'gain', 'up', 'high', 'record', 'breakthrough',
    'adoption', 'institutional', 'etf', 'approval', 'positive', 'growth', 'increase',
    'soar', 'jump', 'climb', 'boost', 'optimistic', 'bullish', 'moon', 'pump'
  ];
  
  // Bearish keywords
  const bearishKeywords = [
    'crash', 'fall', 'drop', 'decline', 'bear', 'down', 'low', 'plunge', 'dump',
    'sell-off', 'correction', 'negative', 'loss', 'decrease', 'regulatory', 'ban',
    'hack', 'security', 'concern', 'warning', 'risk', 'bearish', 'fear', 'panic'
  ];
  
  let bullishScore = 0;
  let bearishScore = 0;
  
  // Count keyword matches
  bullishKeywords.forEach(keyword => {
    if (text.includes(keyword)) bullishScore++;
  });
  
  bearishKeywords.forEach(keyword => {
    if (text.includes(keyword)) bearishScore++;
  });
  
  // Determine sentiment
  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}

// Function to determine impact level based on keywords and content
function determineImpact(title: string, summary?: string): 'high' | 'medium' | 'low' {
  const text = `${title} ${summary || ''}`.toLowerCase();
  
  // High impact keywords
  const highImpactKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'federal reserve', 'fed', 'sec', 'etf',
    'regulation', 'ban', 'approval', 'institutional', 'blackrock', 'grayscale',
    'record', 'all-time high', 'crash', 'hack', 'major', 'breaking'
  ];
  
  // Medium impact keywords
  const mediumImpactKeywords = [
    'altcoin', 'defi', 'nft', 'trading', 'exchange', 'wallet', 'mining',
    'blockchain', 'crypto', 'market', 'price', 'volume', 'adoption'
  ];
  
  // Check for high impact
  for (const keyword of highImpactKeywords) {
    if (text.includes(keyword)) return 'high';
  }
  
  // Check for medium impact
  for (const keyword of mediumImpactKeywords) {
    if (text.includes(keyword)) return 'medium';
  }
  
  return 'low';
}

// Function to format timestamp
function formatTimestamp(publishedOn: number): string {
  const publishedDate = new Date(publishedOn * 1000); // Convert Unix timestamp to milliseconds
  const now = new Date();
  const diffMs = now.getTime() - publishedDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return publishedDate.toLocaleDateString();
  }
}

// Main function to fetch news from CoinDesk API
export async function fetchCoinDeskNews(limit: number = 10): Promise<NewsItem[]> {
  const timerId = startPerformanceTimer('fetchCoinDeskNews');
  logFunctionEntry('fetchCoinDeskNews', { limit });
  
  try {
    log('INFO', `Fetching ${limit} latest news articles from CryptoCompare API...`);
    
    const url = `${CRYPTOCOMPARE_API_BASE}/data/v2/news/?lang=EN&sortOrder=latest&limit=${limit}`;
    log('INFO', `CryptoCompare API URL: ${url}`);
    
    logApiRequest({
      endpoint: url,
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    const response = await axios.get<CryptoCompareResponse>(
      url,
      {
        headers: {
          'User-Agent': 'CryptoTrader-Bot/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    logApiResponse(url, {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });
    
    log('INFO', `CryptoCompare API Response Status: ${response.status}`);
    log('INFO', `CryptoCompare API Response Data (first 500 chars): ${JSON.stringify(response.data).substring(0, 500)}`);
    
    // Handle response structure - CryptoCompare uses lowercase fields in Data array
    let articles: CryptoCompareArticle[] = [];
    
    if (response.data.Data && Array.isArray(response.data.Data)) {
      // CryptoCompare structure: response.data.Data contains articles with lowercase fields
      const rawArticles = response.data.Data;
      
      // Convert lowercase fields to uppercase for consistency
      articles = rawArticles.map((item: any) => ({
        ID: item.ID || item.id || 0,
        TITLE: item.TITLE || item.title || '',
        BODY: item.BODY || item.body || '',
        PUBLISHED_ON: item.PUBLISHED_ON || item.published_on || Date.now() / 1000,
        URL: item.URL || item.url || '',
        SOURCE_DATA: item.SOURCE_DATA || item.source_data || { name: 'CryptoCompare' },
        SENTIMENT: item.SENTIMENT || item.sentiment || ''
      }));
      
      log('INFO', `Successfully fetched ${articles.length} articles from CryptoCompare`);
      log('INFO', `Sample article fields:`, {
        ID: rawArticles[0]?.ID,
        TITLE: (rawArticles[0]?.TITLE)?.substring(0, 50) + '...',
        PUBLISHED_ON: rawArticles[0]?.PUBLISHED_ON,
        SENTIMENT: rawArticles[0]?.SENTIMENT
      });
    } else {
      log('ERROR', 'CryptoCompare API returned invalid structure', response.data);
      logFunctionExit('fetchCoinDeskNews', []);
      endPerformanceTimer(timerId);
      throw new Error('Invalid response format from CryptoCompare API');
    }
    
    // Limit articles to requested amount to avoid Discord embed limits
    const limitedArticles = articles.slice(0, limit);
    log('INFO', `Using ${limitedArticles.length} articles (limited from ${articles.length})`);
    
    // Convert CryptoCompare articles to our NewsItem format
    const newsItems: NewsItem[] = limitedArticles.map((article: CryptoCompareArticle) => {
      // Use CryptoCompare's built-in sentiment if available, otherwise analyze
      let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (article.SENTIMENT) {
        sentiment = article.SENTIMENT.toLowerCase() === 'positive' ? 'bullish' :
                   article.SENTIMENT.toLowerCase() === 'negative' ? 'bearish' : 'neutral';
      } else {
        sentiment = analyzeSentiment(article.TITLE, article.BODY);
      }
      
      const impact = determineImpact(article.TITLE, article.BODY);
      const timestamp = formatTimestamp(article.PUBLISHED_ON);
      
      // Extract source name from URL or use default
      let sourceName = 'CryptoCompare';
      if (article.URL) {
        try {
          const urlObj = new URL(article.URL);
          const hostname = urlObj.hostname.replace('www.', '');
          
          // Map common hostnames to readable names
          const sourceMap: { [key: string]: string } = {
            'coindesk.com': 'CoinDesk',
            'cointelegraph.com': 'Cointelegraph',
            'cryptodaily.co.uk': 'Crypto Daily',
            'investing.com': 'Investing.com',
            'coinpaper.com': 'CoinPaper',
            'decrypt.co': 'Decrypt',
            'theblock.co': 'The Block',
            'cryptoslate.com': 'CryptoSlate'
          };
          
          sourceName = sourceMap[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
        } catch (error) {
          // If URL parsing fails, try to get from SOURCE_DATA
          sourceName = article.SOURCE_DATA?.name || 'CryptoCompare';
        }
      }
      
      return {
        title: article.TITLE,
        sentiment: sentiment,
        source: sourceName,
        timestamp: timestamp,
        impact: impact
      };
    });
    
    log('INFO', `Processed news sentiment analysis:`, {
      bullish: newsItems.filter(n => n.sentiment === 'bullish').length,
      bearish: newsItems.filter(n => n.sentiment === 'bearish').length,
      neutral: newsItems.filter(n => n.sentiment === 'neutral').length
    });
    
    logFunctionExit('fetchCoinDeskNews', { count: newsItems.length });
    endPerformanceTimer(timerId);
    return newsItems;
    
  } catch (error) {
    log('ERROR', 'Error fetching news from CryptoCompare API', error.message);
    
    if (error.response) {
      logApiResponse(error.config?.url || 'unknown', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
        error: error.response.data
      });
      
      log('ERROR', 'CryptoCompare API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data).substring(0, 1000)
      });
    } else if (error.request) {
      log('ERROR', 'CryptoCompare API request failed:', {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    } else {
      log('ERROR', 'CryptoCompare API error details', error);
    }
    
    // Return empty array on error - calling code can handle fallback
    logFunctionExit('fetchCoinDeskNews', []);
    endPerformanceTimer(timerId);
    return [];
  }
}

// Function to test CryptoCompare API connectivity
export async function testCoinDeskAPI(): Promise<boolean> {
  const timerId = startPerformanceTimer('testCoinDeskAPI');
  logFunctionEntry('testCoinDeskAPI');
  
  try {
    log('INFO', 'Testing CryptoCompare News API connectivity...');
    const testUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&limit=1`;
    log('INFO', `Testing CryptoCompare URL: ${testUrl}`);
    
    logApiRequest({
      endpoint: testUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoTrader-Bot/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    const response = await axios.get(
      testUrl,
      {
        headers: {
          'User-Agent': 'CryptoTrader-Bot/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout for test
      }
    );
    
    logApiResponse(testUrl, {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });
    
    log('INFO', `CryptoCompare Test Response Status: ${response.status}`);
    log('INFO', `CryptoCompare Test Response Data: ${JSON.stringify(response.data).substring(0, 200)}`);
    
    if (response.status === 200 && response.data && response.data.Data && Array.isArray(response.data.Data)) {
      log('INFO', 'CryptoCompare News API test successful');
      logFunctionExit('testCoinDeskAPI', true);
      endPerformanceTimer(timerId);
      return true;
    }
    
    log('ERROR', 'CryptoCompare API test failed - invalid response structure');
    log('ERROR', `Expected: response.data.Data, Got: ${typeof response.data}, Keys: ${Object.keys(response.data || {})}`);
    logFunctionExit('testCoinDeskAPI', false);
    endPerformanceTimer(timerId);
    return false;
    
  } catch (error) {
    log('ERROR', 'CryptoCompare API test failed', error.message);
    
    if (error.response) {
      logApiResponse(error.config?.url || 'unknown', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        error: error.response.data
      });
      
      log('ERROR', 'Test response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data).substring(0, 500)
      });
    }
    
    logFunctionExit('testCoinDeskAPI', false);
    endPerformanceTimer(timerId);
    return false;
  }
}