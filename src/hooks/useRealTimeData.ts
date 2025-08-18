import { useState, useEffect, useCallback } from 'react';
import { TradingRecommendation } from '../types/trading';
import { 
  getEvaluatedRecommendationsFromAPI,
  getEvaluationStatsFromAPI
} from '../services/tradingService';

interface UseRealTimeDataReturn {
  recommendations: TradingRecommendation[];
  evaluationStats: {
    total: number;
    pending: number;
    accurate: number;
    inaccurate: number;
    expired: number;
    accuracyRate: number;
  };
  isLoading: boolean;
  lastUpdate: Date;
  refreshData: () => Promise<void>;
}

export function useRealTimeData(): UseRealTimeDataReturn {
  const [recommendations, setRecommendations] = useState<TradingRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [evaluationStats, setEvaluationStats] = useState({
    total: 0,
    pending: 0,
    accurate: 0,
    inaccurate: 0,
    expired: 0,
    accuracyRate: 0
  });

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing trade recommendation evaluation data...');
      
      // Get evaluated recommendations (this is now the primary focus)
      const newRecommendations = await getEvaluatedRecommendationsFromAPI();
      setRecommendations(newRecommendations);
      
      // Get evaluation statistics
      const newStats = await getEvaluationStatsFromAPI();
      setEvaluationStats(newStats);
      
      console.log(`✅ Dashboard refresh complete: ${newRecommendations.length} recommendations, ${newStats.total} total evaluations`);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      console.log('💡 Tip: Make sure the Discord bot is running with Supabase configured');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 10 minutes (less frequent since we're only showing evaluations)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    recommendations,
    evaluationStats,
    isLoading,
    lastUpdate,
    refreshData,
  };
}