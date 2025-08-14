import axios from 'axios';
import { NewsItem } from '../src/types/trading.js';

// CoinDesk API configuration
const COINDESK_API_BASE = 'https://data-api.coindesk.com';

interface CoinDeskArticle {
  id: string;
  title: string;
  summary?: string;
  published_at: string;
  updated_at: string;
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
function analyzeSentiment(title: string, summary?: string): 'bullish' | 'bearish' | 'neutral' {
  const text = `${title} ${summary || ''}`.toLowerCase();
  
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
function formatTimestamp(publishedAt: string): string {
  const publishedDate = new Date(publishedAt);
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
  try {
    console.log(`📰 Fetching ${limit} latest news articles from CoinDesk...`);
    
    const response = await axios.get<CoinDeskResponse>(
      `${COINDESK_API_BASE}/news/v1/article/list`,
      {
        params: {
          limit: limit,
          // You can add more parameters here if needed
          // sort: 'published_at',
          // order: 'desc'
        },
        headers: {
          'User-Agent': 'CryptoTrader-Bot/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response format from CoinDesk API');
    }
    
    const articles = response.data.data;
    console.log(`✅ Successfully fetched ${articles.length} articles from CoinDesk`);
    
    // Convert CoinDesk articles to our NewsItem format
    const newsItems: NewsItem[] = articles.map((article: CoinDeskArticle) => {
      const sentiment = analyzeSentiment(article.title, article.summary);
      const impact = determineImpact(article.title, article.summary);
      const timestamp = formatTimestamp(article.published_at);
      
      return {
        title: article.title,
        sentiment: sentiment,
        source: 'CoinDesk',
        timestamp: timestamp,
        impact: impact
      };
    });
    
    console.log(`📊 Processed news sentiment analysis:`, {
      bullish: newsItems.filter(n => n.sentiment === 'bullish').length,
      bearish: newsItems.filter(n => n.sentiment === 'bearish').length,
      neutral: newsItems.filter(n => n.sentiment === 'neutral').length
    });
    
    return newsItems;
    
  } catch (error) {
    console.error('❌ Error fetching news from CoinDesk API:', error.message);
    
    if (error.response) {
      console.error('📄 CoinDesk API response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Return empty array on error - calling code can handle fallback
    return [];
  }
}

// Function to test CoinDesk API connectivity
export async function testCoinDeskAPI(): Promise<boolean> {
  try {
    console.log('🧪 Testing CoinDesk API connectivity...');
    
    const response = await axios.get(
      `${COINDESK_API_BASE}/news/v1/article/list?limit=1`,
      {
        headers: {
          'User-Agent': 'CryptoTrader-Bot/1.0',
          'Accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout for test
      }
    );
    
    if (response.status === 200 && response.data && response.data.data) {
      console.log('✅ CoinDesk API test successful');
      return true;
    }
    
    console.log('❌ CoinDesk API test failed - invalid response');
    return false;
    
  } catch (error) {
    console.log('❌ CoinDesk API test failed:', error.message);
    return false;
  }
}