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
    
    // For self-signed certificates, we need to handle the request differently
    const response = await fetch(`${API_PROXY_BASE}/evaluated-recommendations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Frontend: Evaluated recommendations API returned ${response.status} ${response.statusText}`);
      throw new Error(errorData.error || `HTTP ${response.status} ${response.statusText}`);
    }
    
    const recommendations = await response.json();
    
    console.log(`✅ Frontend: Successfully received ${recommendations.length} evaluated recommendations`);
    console.log(`📊 Frontend: Recommendation statuses:`, {
      pending: recommendations.filter((r: TradingRecommendation) => r.status === 'pending').length,
      accurate: recommendations.filter((r: TradingRecommendation) => r.status === 'accurate').length,
      inaccurate: recommendations.filter((r: TradingRecommendation) => r.status === 'inaccurate').length,
      expired: recommendations.filter((r: TradingRecommendation) => r.status === 'expired').length
    });
    
    return recommendations;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluated recommendations via proxy:', (error as Error).message);
    console.error('🔍 Frontend: Evaluated recommendations error details:', {
      errorType: (error as Error).constructor.name,
      message: (error as Error).message,
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
  noEntryHit: number;
  accuracyRate: number;
}> {
  try {
    console.log('📈 Frontend: Requesting evaluation statistics via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/evaluation-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const stats = await response.json();
    console.log(`✅ Frontend: Successfully received evaluation statistics:`, stats);
    
    return stats;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluation statistics:', (error as Error).message);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 };
  }
}