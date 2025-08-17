import { TradingRecommendation } from '../types/trading';

// API proxy base URL - use environment variable with production default
const API_PROXY_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

console.log('🌐 Frontend: Using API base URL:', API_PROXY_BASE);

// Core functions for trade recommendation evaluation system

// Function to get evaluated recommendations from API
export async function getEvaluatedRecommendationsFromAPI(): Promise<TradingRecommendation[]> {
  try {
    console.log('📊 Frontend: Requesting evaluated recommendations via proxy...');
    console.log(`🌐 Frontend: Connecting to ${API_PROXY_BASE}/evaluated-recommendations`);
    
    const response = await fetch(`${API_PROXY_BASE}/evaluated-recommendations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Frontend: Evaluated recommendations API returned ${response.status} ${response.statusText}`);
      throw new Error(errorData.error || `HTTP ${response.status} ${response.statusText}`);
    }
    
    const recommendations = await response.json();
    
    console.log(`✅ Frontend: Successfully received ${recommendations.length} evaluated recommendations`);
    console.log(`📊 Frontend: Recommendation statuses:`, {
      pending: recommendations.filter(r => r.status === 'pending').length,
      accurate: recommendations.filter(r => r.status === 'accurate').length,
      inaccurate: recommendations.filter(r => r.status === 'inaccurate').length,
      expired: recommendations.filter(r => r.status === 'expired').length
    });
    
    return recommendations;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluated recommendations via proxy:', error.message);
    console.error('🔍 Frontend: Evaluated recommendations error details:', {
      errorType: error.constructor.name,
      message: error.message,
      proxyUrl: `${API_PROXY_BASE}/evaluated-recommendations`
    });
    
    // Return empty array - the UI will handle showing error state
    return [];
  }
}

// Function to get evaluation statistics from API
export async function getEvaluationStatsFromAPI(): Promise<{
  total: number;
  pending: number;
  accurate: number;
  inaccurate: number;
  expired: number;
  accuracyRate: number;
}> {
  try {
    console.log('📈 Frontend: Requesting evaluation statistics via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/evaluation-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const stats = await response.json();
    console.log(`✅ Frontend: Successfully received evaluation statistics:`, stats);
    
    return stats;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluation statistics:', error.message);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 };
  }
}