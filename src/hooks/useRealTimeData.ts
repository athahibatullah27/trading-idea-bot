import { useState, useEffect, useCallback } from 'react';
import { CryptoData, NewsItem, TradingRecommendation, MarketConditions, GeopoliticalFactor } from '../types/trading';
import { 
  getMultipleCryptoData, 
  getRealTimeNews, 
  getGeminiRecommendationsFromAPI,
  getMarketConditions,
  testAPIConnection 
} from '../services/tradingService';
import { mockGeopoliticalFactors } from '../data/mockData';

interface UseRealTimeDataReturn {
  cryptoData: CryptoData[];
  news: NewsItem[];
  recommendations: TradingRecommendation[];
  marketConditions: MarketConditions;
  geopoliticalFactors: GeopoliticalFactor[];
  isLoading: boolean;
  isApiConnected: boolean;
  lastUpdate: Date;
  refreshData: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

export function useRealTimeData(): UseRealTimeDataReturn {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [recommendations, setRecommendations] = useState<TradingRecommendation[]>([]);
  const [marketConditions, setMarketConditions] = useState<MarketConditions>({
    overall: 'neutral',
    volatility: 'medium',
    fearGreedIndex: 50,
    dominance: { btc: 54.2, eth: 17.8 }
  });
  const [geopoliticalFactors] = useState<GeopoliticalFactor[]>(mockGeopoliticalFactors);
  const [isLoading, setIsLoading] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const connected = await testAPIConnection();
      setIsApiConnected(connected);
      return connected;
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsApiConnected(false);
      return false;
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing real-time data...');
      
      // Test connection first
      const connected = await testConnection();
      
      // Fetch crypto data
      const symbols = ['BTC', 'ETH', 'SOL', 'ADA'];
      const newCryptoData = await getMultipleCryptoData(symbols);
      
      if (newCryptoData.length > 0) {
        setCryptoData(newCryptoData);
        
        // Get Gemini-powered recommendations
        const newRecommendations = await getGeminiRecommendationsFromAPI();
        setRecommendations(newRecommendations);
        
        // Update market conditions based on real data
        const newMarketConditions = await getMarketConditions(newCryptoData);
        setMarketConditions(newMarketConditions);
        
        if (connected) {
          console.log(`✅ Successfully updated ${newCryptoData.length} cryptocurrencies with live data`);
        } else {
          console.log(`📦 Successfully updated ${newCryptoData.length} cryptocurrencies with fallback data`);
        }
      } else {
        console.log('⚠️ No data available from any source, keeping existing data');
      }
      
      // Fetch news (currently mock, but timestamped)
      const newNews = await getRealTimeNews();
      setNews(newNews);
      
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      console.log('💡 Tip: Make sure the Discord bot is running on your VPS with the proxy server');
    } finally {
      setIsLoading(false);
    }
  }, [testConnection]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    cryptoData,
    news,
    recommendations,
    marketConditions,
    geopoliticalFactors,
    isLoading,
    isApiConnected,
    lastUpdate,
    refreshData,
    testConnection
  };
}